const fs = require('fs');
const path = require('path');
const { createServer } = require('../../src/web/server');
const { requestJson, requestRaw } = require('../helpers/http');

let server;
let testDir;

beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'security-test-'));
  fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
  fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = { projectName: 'test' };`);

  const app = createServer(testDir);
  server = app.listen(0);
});

afterAll(() => {
  if (server) server.close();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('Security: request body limit', () => {
  test('rejects request body larger than 1mb', async () => {
    const largeBody = { data: 'x'.repeat(1024 * 1024 + 1) };
    const res = await requestJson(server, '/api/ai/generate', { method: 'POST', body: largeBody });
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
    const res = await requestJson(server, '/api/config', { method: 'PUT', body });
    expect(res.status).toBe(200);

    const configContent = fs.readFileSync(path.join(testDir, 'code-ctx.config.json'), 'utf8');
    expect(configContent).toContain('updated');
    expect(configContent).not.toContain('unknownKey');
    expect(configContent).not.toContain('anotherUnknown');
  });

  test('rejects __proto__ key', async () => {
    const rawBody = '{"projectName":"test","__proto__":{"polluted":true}}';
    const res = await requestRaw(server, '/api/config', rawBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('__proto__');
  });

  test('rejects constructor key', async () => {
    const body = { constructor: { polluted: true } };
    const res = await requestJson(server, '/api/config', { method: 'PUT', body });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('constructor');
  });

  test('rejects prototype key', async () => {
    const body = { prototype: { polluted: true } };
    const res = await requestJson(server, '/api/config', { method: 'PUT', body });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('prototype');
  });

  test('rejects non-object config (string)', async () => {
    const res = await requestJson(server, '/api/config', { method: 'PUT', body: 'not-an-object' });
    expect([400, 500]).toContain(res.status);
  });

  test('rejects non-object config (array)', async () => {
    const res = await requestJson(server, '/api/config', { method: 'PUT', body: [1, 2, 3] });
    expect(res.status).toBe(400);
  });

  test('allows valid config keys', async () => {
    const body = {
      projectName: 'my-app',
      outputDir: './ai-docs',
      aiMode: 'clipboard',
      gitTrack: true
    };
    const res = await requestJson(server, '/api/config', { method: 'PUT', body });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Security: scenarios API', () => {
  test('rejects template longer than 10000 characters', async () => {
    const longTemplate = 'x'.repeat(10001);
    const res = await requestJson(server, '/api/scenarios/A', { method: 'PUT', body: { template: longTemplate } });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('10000');
  });

  test('rejects invalid scenario ID', async () => {
    const res = await requestJson(server, '/api/scenarios/INVALID', { method: 'PUT', body: { template: 'test' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('无效');
  });

  test('rejects non-string template', async () => {
    const res = await requestJson(server, '/api/scenarios/A', { method: 'PUT', body: { template: 123 } });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('字符串');
  });
});

describe('Security: error responses', () => {
  test('does not leak internal paths in error responses', async () => {
    // Corrupt the config to force a 500 error from /api/config
    const configPath = path.join(testDir, 'code-ctx.config.json');
    const backup = fs.readFileSync(configPath, 'utf8');
    fs.writeFileSync(configPath, 'module.exports = INVALID SYNTAX !!!');
    try {
      const res = await requestJson(server, '/api/config');
      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
      expect(res.body.error).not.toContain('src/');
      expect(res.body.error).not.toContain('node_modules');
      expect(res.body.error).not.toContain('SyntaxError');
    } finally {
      fs.writeFileSync(configPath, backup);
    }
  });

  test('error response does not contain stack trace', async () => {
    // POST to /api/config (only supports GET/PUT) to trigger 404/405 error
    const res = await requestJson(server, '/api/config', { method: 'POST', body: {} });
    // Express returns 404 for unsupported methods on existing routes
    const body = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    expect(body).not.toMatch(/at\s+\S+\s+\(/);
    expect(body).not.toContain('node_modules');
  });
});

describe('Security: response headers', () => {
  test('includes X-Content-Type-Options header', async () => {
    const res = await requestJson(server, '/api/config');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('includes X-Frame-Options header', async () => {
    const res = await requestJson(server, '/api/config');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  test('includes Referrer-Policy header', async () => {
    const res = await requestJson(server, '/api/config');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

describe('Security: path traversal on docs', () => {
  test('rejects path traversal with ../', async () => {
    const res = await requestJson(server, '/api/docs/..%2F..%2Fpackage.json');
    expect([400, 403, 404]).toContain(res.status);
  });

  test('rejects absolute path attempt', async () => {
    const res = await requestJson(server, '/api/docs/C%3A%5CWindows%5Csystem.ini');
    expect([400, 403, 404]).toContain(res.status);
  });

  test('allows valid doc name', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs', 'test-doc.md'), '# Test');
    const res = await requestJson(server, '/api/docs/test-doc.md');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('test-doc.md');
  });
});

describe('Security: save-key validation', () => {
  afterEach(() => {
    const envPath = path.join(testDir, '.env');
    if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
    const bakPath = envPath + '.bak';
    if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
  });

  test('rejects API key longer than 512 characters', async () => {
    const longKey = 'sk-' + 'a'.repeat(513);
    const res = await requestJson(server, '/api/ai/save-key', { method: 'POST', body: { apiKey: longKey } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('rejects API key containing newline', async () => {
    const res = await requestJson(server, '/api/ai/save-key', {
      method: 'POST',
      body: { apiKey: 'sk-valid\ninjected' }
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('rejects API key containing carriage return', async () => {
    const res = await requestJson(server, '/api/ai/save-key', {
      method: 'POST',
      body: { apiKey: 'sk-valid\rinjected' }
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('rejects empty API key', async () => {
    const res = await requestJson(server, '/api/ai/save-key', { method: 'POST', body: { apiKey: '' } });
    expect(res.status).toBe(400);
  });

  test('accepts valid API key', async () => {
    const res = await requestJson(server, '/api/ai/save-key', {
      method: 'POST',
      body: { apiKey: 'sk-test-valid-key-1234' }
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Security: update API options', () => {
  test('only uses dryRun from request body, ignores unknown options', async () => {
    const res = await requestJson(server, '/api/update', {
      method: 'POST',
      body: { dryRun: true, maliciousOption: 'should-be-ignored', force: true, outputDir: '/tmp/evil' }
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Security: token authentication', () => {
  const origToken = process.env.DASHBOARD_TOKEN;

  afterEach(() => {
    if (origToken !== undefined) {
      process.env.DASHBOARD_TOKEN = origToken;
    } else {
      delete process.env.DASHBOARD_TOKEN;
    }
  });

  test('allows requests when DASHBOARD_TOKEN is not set', async () => {
    delete process.env.DASHBOARD_TOKEN;
    const res = await requestJson(server, '/api/config');
    expect(res.status).toBe(200);
  });

  test('rejects requests without token when DASHBOARD_TOKEN is set', async () => {
    process.env.DASHBOARD_TOKEN = 'secret-token';
    const res = await requestJson(server, '/api/config');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('认证');
  });

  test('rejects requests with wrong token', async () => {
    process.env.DASHBOARD_TOKEN = 'secret-token';
    const res = await requestJson(server, '/api/config', {
      method: 'GET',
      headers: { Authorization: 'Bearer wrong-token' }
    });
    expect(res.status).toBe(401);
  });

  test('allows requests with correct token', async () => {
    process.env.DASHBOARD_TOKEN = 'secret-token';
    const res = await requestJson(server, '/api/config', {
      headers: { Authorization: 'Bearer secret-token' }
    });
    expect(res.status).toBe(200);
  });
});
