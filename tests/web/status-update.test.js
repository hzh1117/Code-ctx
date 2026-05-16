const fs = require('fs');
const path = require('path');
const { createServer } = require('../../src/web/server');
const { requestJson } = require('../helpers/http');

describe('web status content and update api', () => {
  const testDir = path.join(__dirname, '../fixtures/status-update-web');
  let server;

  beforeEach((done) => {
    delete process.env.DASHBOARD_TOKEN;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# Overview\n\ncontent');
    const app = createServer(testDir);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
    server.close(done);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('GET /api/docs/:name returns markdown source', async () => {
    const res = await requestJson(server, '/api/docs/OVERVIEW.md');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      name: 'OVERVIEW.md',
      content: '# Overview\n\ncontent'
    });
  });

  test('POST /api/update returns update command result', async () => {
    const res = await requestJson(server, '/api/update', { method: 'POST' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toHaveProperty('changedFiles');
    expect(res.body.result).toHaveProperty('detectionMethod');
  });
});
