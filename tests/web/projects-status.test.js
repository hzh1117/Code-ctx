const fs = require('fs');
const path = require('path');
const { createServer } = require('../../src/web/server');
const { requestJson } = require('../helpers/http');

describe('web project/status api', () => {
  const testDir = path.join(__dirname, '../fixtures/web-api-project-status');
  let server;

  beforeEach((done) => {
    delete process.env.DASHBOARD_TOKEN;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'web'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = {
  projects: [
    { alias: 'web', path: './web', type: 'vue3-admin', label: '管理端' },
    { alias: 'api', path: './api', type: 'node-backend', label: '接口' }
  ]
};\n`);
    fs.writeFileSync(path.join(testDir, 'ai-docs/.init-state.json'), JSON.stringify({
      projects: {
        web: { status: 'done' },
        api: { status: 'failed' }
      }
    }, null, 2));
    fs.writeFileSync(path.join(testDir, 'ai-docs/web.md'), [
      '# web',
      '<!-- section:overview -->',
      '项目概述',
      '<!-- /section:overview -->',
      '<!-- section:modules -->',
      '核心模块',
      '<!-- /section:modules -->'
    ].join('\n'));
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# Overview');
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan.json'), JSON.stringify({
      timestamp: '2026-05-14T08:00:00.000Z',
      files: {}
    }));
    fs.writeFileSync(path.join(testDir, 'ai-docs/.task-history.jsonl'), [
      JSON.stringify({ timestamp: '2026-05-14T07:00:00.000Z', task: 'one' }),
      JSON.stringify({ timestamp: '2026-05-14T07:30:00.000Z', task: 'two' })
    ].join('\n') + '\n');

    const app = createServer(testDir);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
    server.close(done);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('GET /api/projects merges config, init state, and doc existence', async () => {
    const res = await requestJson(server, '/api/projects');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        alias: 'web',
        name: '管理端',
        path: './web',
        type: 'vue3-admin',
        label: '管理端',
        initialized: true,
        docFile: true
      },
      {
        alias: 'api',
        name: '接口',
        path: './api',
        type: 'node-backend',
        label: '接口',
        initialized: false,
        docFile: false
      }
    ]);
  });

  test('GET /api/status returns markdown documents with parsed sections', async () => {
    const res = await requestJson(server, '/api/status');

    expect(res.status).toBe(200);
    const webDoc = res.body.documents.find(doc => doc.name === 'web.md');
    expect(webDoc).toEqual(expect.objectContaining({
      name: 'web.md',
      exists: true,
      sections: ['overview', 'modules']
    }));
  });

  test('GET /api/status returns dashboard summary fields', async () => {
    const res = await requestJson(server, '/api/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      docCount: 2,
      lastScanTime: '2026-05-14T08:00:00.000Z',
      historyCount: 2,
      healthStatus: expect.any(String)
    }));
    expect(res.body.recentHistory).toEqual([
      expect.objectContaining({ task: 'two' }),
      expect.objectContaining({ task: 'one' })
    ]);
  });

  test('GET /api/status derives health status from doctor report', async () => {
    fs.unlinkSync(path.join(testDir, 'ai-docs/OVERVIEW.md'));

    const res = await requestJson(server, '/api/status');

    expect(res.status).toBe(200);
    expect(res.body.healthStatus).toBe('异常');
    expect(res.body.doctor).toEqual(expect.objectContaining({
      issueCount: expect.any(Number),
      warningCount: expect.any(Number)
    }));
    expect(res.body.doctor.issueCount).toBeGreaterThan(0);
  });
});
