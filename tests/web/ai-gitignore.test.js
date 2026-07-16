const fs = require('fs');
const path = require('path');
const { createServer } = require('../../src/web/server');
const { requestJson } = require('../helpers/http');
const { _clearCache } = require('../../src/utils/config');

describe('save-key .gitignore warning', () => {
  const testDir = path.join(__dirname, '../fixtures/web-ai-gitignore');
  let server;
  let warnSpy;

  beforeEach(done => {
    delete process.env.DASHBOARD_TOKEN;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({
        projectName: 'test',
        ai: { protocol: 'openai', openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.5' } }
      })
    );
    _clearCache();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const app = createServer(testDir);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach(done => {
    warnSpy.mockRestore();
    _clearCache();
    server.close(() => {
      fs.rmSync(testDir, { recursive: true, force: true });
      done();
    });
  });

  test('warns when .env is not in .gitignore', async () => {
    await requestJson(server, '/api/ai/save-key', {
      method: 'POST',
      body: { apiKey: 'sk-test1234567890abcdef', protocol: 'openai' }
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('.gitignore'));
  });

  test('does not warn when .env is in .gitignore', async () => {
    fs.writeFileSync(path.join(testDir, '.gitignore'), 'node_modules\n.env\n');
    await requestJson(server, '/api/ai/save-key', {
      method: 'POST',
      body: { apiKey: 'sk-test1234567890abcdef', protocol: 'openai' }
    });
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('.gitignore'));
  });

  test('does not warn when .env* wildcard is in .gitignore', async () => {
    fs.writeFileSync(path.join(testDir, '.gitignore'), '.env*\n');
    await requestJson(server, '/api/ai/save-key', {
      method: 'POST',
      body: { apiKey: 'sk-test1234567890abcdef', protocol: 'openai' }
    });
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('.gitignore'));
  });
});
