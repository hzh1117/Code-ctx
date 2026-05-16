const fs = require('fs');
const path = require('path');
const { createServer } = require('../../src/web/server');
const { buildContext } = require('../../src/commands/use');
const { requestJson } = require('../helpers/http');

describe('web generate-prompt api', () => {
  const testDir = path.join(__dirname, '../fixtures/generate-prompt-web');
  let server;

  beforeEach((done) => {
    delete process.env.DASHBOARD_TOKEN;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# 项目总览\n测试系统');
    fs.writeFileSync(path.join(testDir, 'ai-docs/mer.md'), '# 商户端文档\n管理后台');

    const app = createServer(testDir);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
    server.close(done);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('POST /api/generate-prompt reuses buildContext prompt assembly', async () => {
    const task = '商户后台新增功能';
    const expectedPrompt = await buildContext(task, 'B', {
      rootDir: testDir,
      noAiMatch: true,
      language: 'zh'
    });

    const res = await requestJson(server, '/api/generate-prompt', {
      method: 'POST',
      body: { scenario: 'B', task }
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scenario).toBe('B');
    expect(res.body.prompt).toBe(expectedPrompt);
  });
});
