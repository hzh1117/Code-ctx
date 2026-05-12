const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createServer } = require('../../src/web/server');

function request(server, method, pathname, body) {
  const address = server.address();
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: pathname,
      method,
      headers: payload ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      } : {}
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let data = raw;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch (err) {
          // Keep raw response for assertions.
        }
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

describe('dashboard API routes', () => {
  let rootDir;
  let server;

  beforeEach((done) => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-ctx-web-'));
    const app = createServer(rootDir);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
    server.close(() => {
      fs.rmSync(rootDir, { recursive: true, force: true });
      done();
    });
  });

  test('should expose scenarios for AI generate page', async () => {
    const res = await request(server, 'GET', '/api/scenarios');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data[0]).toHaveProperty('id');
  });

  test('should generate a prompt from scenario and task', async () => {
    const res = await request(server, 'POST', '/api/generate-prompt', {
      scenario: 'A',
      task: '新增 API 连接测试'
    });

    expect(res.status).toBe(200);
    expect(res.data.prompt).toContain('新增 API 连接测试');
  });

  test('should save AI config and read it back', async () => {
    const saveRes = await request(server, 'PUT', '/api/ai/config', {
      protocol: 'anthropic',
      openai: {
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        maxTokens: 2000
      },
      anthropic: {
        baseUrl: 'https://api.kimi.com/coding/',
        model: 'kimi-for-coding',
        maxTokens: 1000
      }
    });

    expect(saveRes.status).toBe(200);
    expect(saveRes.data.success).toBe(true);

    const readRes = await request(server, 'GET', '/api/ai/config');

    expect(readRes.status).toBe(200);
    expect(readRes.data.protocol).toBe('anthropic');
    expect(readRes.data.baseUrl).toBe('https://api.kimi.com/coding/');
    expect(readRes.data.model).toBe('kimi-for-coding');
    expect(readRes.data.maxTokens).toBe(1000);
    expect(readRes.data.providers.openai.model).toBe('deepseek-chat');
    expect(readRes.data.providers.anthropic.model).toBe('kimi-for-coding');
  });
});
