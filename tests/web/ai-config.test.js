const fs = require('fs');
const path = require('path');
const { createServer } = require('../../src/web/server');
const { requestJson } = require('../helpers/http');

describe('web ai config api', () => {
  const testDir = path.join(__dirname, '../fixtures/web-ai-config');
  let server;

  beforeEach((done) => {
    delete process.env.DASHBOARD_TOKEN;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = {
  ai: { protocol: 'anthropic' }
};\n`);

    const app = createServer(testDir);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
    server.close(done);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('saving anthropic key writes ANTHROPIC_API_KEY', async () => {
    const res = await requestJson(server, '/api/ai/save-key', {
      method: 'POST',
      body: {
        protocol: 'anthropic',
        apiKey: 'anthropic-test-key'
      }
    });

    expect(res.status).toBe(200);
    const env = fs.readFileSync(path.join(testDir, '.env'), 'utf8');
    expect(env).toContain('ANTHROPIC_API_KEY=anthropic-test-key');
    expect(env).not.toContain('ANTHROPIC_AUTH_TOKEN=');
  });

  test('rejects API keys containing newlines', async () => {
    const res = await requestJson(server, '/api/ai/save-key', {
      method: 'POST',
      body: {
        protocol: 'openai',
        apiKey: 'sk-test\nOPENAI_BASE_URL=https://evil.example.com'
      }
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/API Key/);
    expect(fs.existsSync(path.join(testDir, '.env'))).toBe(false);
  });

  test('rejects unsupported AI protocol when saving API key', async () => {
    const res = await requestJson(server, '/api/ai/save-key', {
      method: 'POST',
      body: {
        protocol: 'custom',
        apiKey: 'sk-valid-for-test'
      }
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/不支持/);
    expect(fs.existsSync(path.join(testDir, '.env'))).toBe(false);
  });

  test('rejects local AI baseUrl in dashboard config', async () => {
    const res = await requestJson(server, '/api/ai/config', {
      method: 'PUT',
      body: {
        protocol: 'openai',
        openai: {
          baseUrl: 'https://127.0.0.1:11434/v1',
          model: 'local-model',
          maxTokens: 4096
        }
      }
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/baseUrl|localhost|内网|metadata/);
  });

  test('rejects invalid maxTokens in dashboard config', async () => {
    const res = await requestJson(server, '/api/ai/config', {
      method: 'PUT',
      body: {
        protocol: 'openai',
        openai: {
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-5.5',
          maxTokens: -1
        }
      }
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maxTokens/);
  });

  test('rate limits sensitive AI endpoints', async () => {
    let res;
    for (let i = 0; i < 31; i++) {
      res = await requestJson(server, '/api/ai/save-key', {
        method: 'POST',
        body: {
          protocol: 'openai',
          apiKey: `sk-valid-${i}`
        }
      });
    }

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/频繁/);
  });
});
