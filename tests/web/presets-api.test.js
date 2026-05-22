const fs = require('fs');
const path = require('path');
const os = require('os');

const { createServer } = require('../../src/web/server');
const { requestJson } = require('../helpers/http');
const { _clearCache } = require('../../src/utils/config');
const { _resetPluginState } = require('../../src/plugins/loader');

describe('GET /api/ai/presets', () => {
  let testDir;
  let server;

  beforeEach(async () => {
    delete process.env.DASHBOARD_TOKEN;
    _clearCache();
    _resetPluginState();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'presets-api-'));
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), JSON.stringify({ projectName: 'p' }));
    await new Promise(resolve => {
      const app = createServer(testDir);
      server = app.listen(0, '127.0.0.1', resolve);
    });
  });

  afterEach((done) => {
    server.close(() => {
      _clearCache();
      _resetPluginState();
      fs.rmSync(testDir, { recursive: true, force: true });
      done();
    });
  });

  test('returns a list of provider presets', async () => {
    const res = await requestJson(server, '/api/ai/presets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.presets)).toBe(true);
    expect(res.body.presets.length).toBeGreaterThan(0);
    const ids = res.body.presets.map(p => p.id);
    expect(ids).toEqual(expect.arrayContaining(['openai', 'anthropic']));
  });

  test('presets do not include API keys or secrets', async () => {
    const res = await requestJson(server, '/api/ai/presets');
    const raw = JSON.stringify(res.body).toLowerCase();
    expect(raw).not.toContain('apikey');
    expect(raw).not.toContain('api_key');
  });
});
