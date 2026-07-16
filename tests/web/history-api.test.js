const fs = require('fs');
const path = require('path');
const os = require('os');

const { createServer } = require('../../src/web/server');
const { requestJson } = require('../helpers/http');
const { addTask } = require('../../src/utils/task-history');
const { _clearCache } = require('../../src/utils/config');
const { _resetPluginState } = require('../../src/plugins/loader');

describe('history web API', () => {
  let testDir;
  let server;

  beforeEach(async () => {
    delete process.env.DASHBOARD_TOKEN;
    _clearCache();
    _resetPluginState();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'history-api-'));
    fs.mkdirSync(path.join(testDir, 'ai-docs'));
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({
        projectName: 'history-test',
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
      _resetPluginState();
      fs.rmSync(testDir, { recursive: true, force: true });
      done();
    });
  });

  test('GET /api/history returns recent entries newest first', async () => {
    addTask(testDir, { task: 'first', scenario: 'A' });
    addTask(testDir, { task: 'second', scenario: 'B' });
    const res = await requestJson(server, '/api/history?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items[0].task).toBe('second');
    expect(res.body.total).toBe(2);
  });

  test('GET /api/history/diff returns 400 without ids', async () => {
    const res = await requestJson(server, '/api/history/diff');
    expect(res.status).toBe(400);
  });

  test('GET /api/history/diff returns 404 when ids do not exist', async () => {
    const res = await requestJson(server, '/api/history/diff?a=nope&b=alsonope');
    expect(res.status).toBe(404);
  });

  test('GET /api/history/diff reports scenarioChanged and lengthDelta', async () => {
    const a = addTask(testDir, { task: 't1', scenario: 'A', prompt: 'short' });
    const b = addTask(testDir, { task: 't2', scenario: 'B', prompt: 'a much longer body of prompt text' });
    const res = await requestJson(server, `/api/history/diff?a=${a.id}&b=${b.id}`);
    expect(res.status).toBe(200);
    expect(res.body.scenarioChanged).toBe(true);
    expect(res.body.lengthDelta).toBeGreaterThan(0);
    expect(res.body.promptHashChanged).toBe(true);
  });
});
