const fs = require('fs');
const http = require('http');
const path = require('path');
const { createServer } = require('../../src/web/server');
const { clearCache } = require('../../src/template/engine');

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

describe('web scenarios edit api', () => {
  const scenariosPath = path.join(__dirname, '../../templates/scenarios.json');
  let originalContent;
  let server;

  beforeEach((done) => {
    delete process.env.DASHBOARD_TOKEN;
    originalContent = fs.readFileSync(scenariosPath, 'utf8');
    clearCache();
    const app = createServer(__dirname);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
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
