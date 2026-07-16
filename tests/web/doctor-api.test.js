const fs = require('fs');
const path = require('path');
const os = require('os');

const { createServer } = require('../../src/web/server');
const { requestJson } = require('../helpers/http');
const { _clearCache } = require('../../src/utils/config');
const { _clearDoctorCache } = require('../../src/commands/doctor');
const { _resetPluginState } = require('../../src/plugins/loader');

describe('GET /api/doctor', () => {
  let testDir;
  let server;

  beforeEach(async () => {
    delete process.env.DASHBOARD_TOKEN;
    _clearCache();
    _clearDoctorCache();
    _resetPluginState();

    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-api-'));
    fs.mkdirSync(path.join(testDir, 'ai-docs'));
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({
        projectName: 'doctor-api-test',
        outputDir: 'ai-docs',
        projects: []
      })
    );

    await new Promise(resolve => {
      const app = createServer(testDir);
      server = app.listen(0, '127.0.0.1', resolve);
    });
  });

  afterEach(done => {
    server.close(() => {
      _clearCache();
      _clearDoctorCache();
      _resetPluginState();
      fs.rmSync(testDir, { recursive: true, force: true });
      done();
    });
  });

  test('returns issues, warnings, docQuality, sensitive, schemaErrors, plugins', async () => {
    const res = await requestJson(server, '/api/doctor');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('overall');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(Array.isArray(res.body.warnings)).toBe(true);
    expect(Array.isArray(res.body.sensitive)).toBe(true);
    expect(Array.isArray(res.body.schemaErrors)).toBe(true);
    expect(res.body).toHaveProperty('docQuality');
    expect(res.body).toHaveProperty('plugins');
    expect(Array.isArray(res.body.plugins.loaded)).toBe(true);
    expect(Array.isArray(res.body.plugins.errors)).toBe(true);
  });

  test('flags sensitive info as HIGH_RISK', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs', 'doc.md'), '# x\n\napi_key = "abcdef1234567890abcdef"\n');
    const res = await requestJson(server, '/api/doctor');
    expect(res.status).toBe(200);
    expect(res.body.overall).toBe('HIGH_RISK');
    expect(res.body.sensitive.length).toBeGreaterThan(0);
  });

  test('reports schema errors for invalid config fields', async () => {
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({
        projectName: 'x',
        aiMode: 'rocket-launcher',
        unknownField: true
      })
    );
    _clearCache();
    _clearDoctorCache();
    const res = await requestJson(server, '/api/doctor');
    expect(res.status).toBe(200);
    expect(res.body.schemaErrors.some(e => /aiMode/.test(e))).toBe(true);
    expect(res.body.schemaErrors.some(e => /unknownField/.test(e))).toBe(true);
  });
});
