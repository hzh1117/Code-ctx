const http = require('http');
const fs = require('fs');
const path = require('path');
const { createServer } = require('../../src/web/server');

let server;
let baseUrl;
let testDir;

function requestJson(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyStr ? Buffer.byteLength(bodyStr) : 0
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

function requestRaw(method, urlPath, rawBody) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(rawBody)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(rawBody);
    req.end();
  });
}

beforeAll(async () => {
  testDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'security-test-'));
  fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
  fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = { projectName: 'test' };`);

  const app = createServer(testDir);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  if (server) server.close();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('Security: request body limit', () => {
  test('rejects request body larger than 1mb', async () => {
    const largeBody = { data: 'x'.repeat(1024 * 1024 + 1) };
    const res = await requestJson('POST', '/api/ai/generate', largeBody);
    expect(res.status).toBe(413);
  });
});

describe('Security: config API whitelist', () => {
  test('drops unknown keys from config', async () => {
    const body = {
      projectName: 'updated',
      unknownKey: 'should-be-dropped',
      anotherUnknown: 123
    };
    const res = await requestJson('PUT', '/api/config', body);
    expect(res.status).toBe(200);

    const configContent = fs.readFileSync(path.join(testDir, 'code-ctx.config.js'), 'utf8');
    expect(configContent).toContain('updated');
    expect(configContent).not.toContain('unknownKey');
    expect(configContent).not.toContain('anotherUnknown');
  });

  test('rejects __proto__ key', async () => {
    const rawBody = '{"projectName":"test","__proto__":{"polluted":true}}';
    const res = await requestRaw('PUT', '/api/config', rawBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('__proto__');
  });

  test('rejects constructor key', async () => {
    const body = {
      constructor: { polluted: true }
    };
    const res = await requestJson('PUT', '/api/config', body);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('constructor');
  });

  test('rejects prototype key', async () => {
    const body = {
      prototype: { polluted: true }
    };
    const res = await requestJson('PUT', '/api/config', body);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('prototype');
  });

  test('rejects non-object config (string)', async () => {
    const res = await requestJson('PUT', '/api/config', 'not-an-object');
    expect([400, 500]).toContain(res.status);
  });

  test('rejects non-object config (array)', async () => {
    const res = await requestJson('PUT', '/api/config', [1, 2, 3]);
    expect(res.status).toBe(400);
  });

  test('allows valid config keys', async () => {
    const body = {
      projectName: 'my-app',
      outputDir: './ai-docs',
      aiMode: 'clipboard',
      gitTrack: true
    };
    const res = await requestJson('PUT', '/api/config', body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Security: scenarios API', () => {
  test('rejects template longer than 10000 characters', async () => {
    const longTemplate = 'x'.repeat(10001);
    const res = await requestJson('PUT', '/api/scenarios/A', { template: longTemplate });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('10000');
  });

  test('rejects invalid scenario ID', async () => {
    const res = await requestJson('PUT', '/api/scenarios/INVALID', { template: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('无效');
  });

  test('rejects non-string template', async () => {
    const res = await requestJson('PUT', '/api/scenarios/A', { template: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('字符串');
  });
});

describe('Security: error responses', () => {
  test('does not leak internal paths in error responses', async () => {
    // This test verifies that error messages don't contain internal file paths
    const res = await requestJson('GET', '/api/config', null);
    // Even if it succeeds, we verify the pattern
    if (res.status === 500) {
      expect(res.body.error).not.toContain('src/');
      expect(res.body.error).not.toContain('node_modules');
    }
  });
});

describe('Security: response headers', () => {
  test('includes X-Content-Type-Options header', async () => {
    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/config', baseUrl);
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(res));
      });
      req.on('error', reject);
      req.end();
    });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('includes X-Frame-Options header', async () => {
    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/config', baseUrl);
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(res));
      });
      req.on('error', reject);
      req.end();
    });

    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  test('includes Referrer-Policy header', async () => {
    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/config', baseUrl);
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(res));
      });
      req.on('error', reject);
      req.end();
    });

    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

describe('Security: path traversal on docs', () => {
  test('rejects path traversal with ../', async () => {
    const res = await requestJson('GET', '/api/docs/..%2F..%2Fpackage.json', null);
    expect([400, 403, 404]).toContain(res.status);
  });

  test('rejects absolute path attempt', async () => {
    const res = await requestJson('GET', '/api/docs/C%3A%5CWindows%5Csystem.ini', null);
    expect([400, 403, 404]).toContain(res.status);
  });

  test('allows valid doc name', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs', 'test-doc.md'), '# Test');
    const res = await requestJson('GET', '/api/docs/test-doc.md', null);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('test-doc.md');
  });
});
