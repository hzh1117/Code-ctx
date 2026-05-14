const fs = require('fs');
const http = require('http');
const path = require('path');
const { createServer } = require('../../src/web/server');

function requestJson(server, pathname, options = {}) {
  const { port } = server.address();
  const body = options.body ? JSON.stringify(options.body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method: options.method || 'GET',
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('basic web api', () => {
  const testDir = path.join(__dirname, '../fixtures/basic-web-api');
  let server;

  beforeEach((done) => {
    delete process.env.DASHBOARD_TOKEN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, 'web'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = {
  projectName: 'basic-web-api',
  outputDir: 'ai-docs',
  projects: [
    { alias: 'web', path: './web', type: 'vue3-admin', label: '前端' }
  ]
};\n`);
    fs.writeFileSync(path.join(testDir, '.env'), 'OPENAI_API_KEY=\nANTHROPIC_API_KEY=\nANTHROPIC_AUTH_TOKEN=');

    const app = createServer(testDir);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
    server.close(done);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('GET /api/config returns 200', async () => {
    const res = await requestJson(server, '/api/config');

    expect(res.status).toBe(200);
    expect(res.body.projectName).toBe('basic-web-api');
  });

  test('GET /api/projects returns an array', async () => {
    const res = await requestJson(server, '/api/projects');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toEqual(expect.objectContaining({ alias: 'web' }));
  });

  test('POST /api/ai/test returns error when key is missing', async () => {
    const res = await requestJson(server, '/api/ai/test', {
      method: 'POST',
      body: { provider: 'openai' }
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/API Key|api key/i);
  });
});
