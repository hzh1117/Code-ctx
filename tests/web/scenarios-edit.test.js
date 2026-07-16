const fs = require('fs');
const path = require('path');
const { createServer } = require('../../src/web/server');
const { clearCache } = require('../../src/template/engine');
const { requestJson } = require('../helpers/http');

describe('web scenarios edit api', () => {
  const scenariosPath = path.join(__dirname, '../../templates/scenarios.json');
  let originalContent;
  let server;

  beforeEach(done => {
    delete process.env.DASHBOARD_TOKEN;
    originalContent = fs.readFileSync(scenariosPath, 'utf8');
    clearCache();
    const app = createServer(__dirname);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach(done => {
    server.close(() => {
      fs.writeFileSync(scenariosPath, originalContent);
      clearCache();
      done();
    });
  });

  test('PUT /api/scenarios/:id updates template in scenarios.json', async () => {
    const res = await requestJson(server, '/api/scenarios/A', {
      method: 'PUT',
      body: { template: 'updated template from test' }
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));
    const scenario = scenarios.find(s => s.id === 'A');
    expect(scenario.template).toBe('updated template from test');
  });
});
