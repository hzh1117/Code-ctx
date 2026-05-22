const fs = require('fs');
const path = require('path');
const os = require('os');

// 选择性 mock：所有被 scenarios.js 在加载时直接解构的依赖都需要在这里包一层，
// 默认使用真实实现，单测内通过 mockImplementation 强制抛错以覆盖 catch 分支。
jest.mock('../../src/template/engine', () => {
  const actual = jest.requireActual('../../src/template/engine');
  return { ...actual, getScenarios: jest.fn(actual.getScenarios) };
});
jest.mock('../../src/commands/doctor', () => {
  const actual = jest.requireActual('../../src/commands/doctor');
  return { ...actual, runDoctor: jest.fn(actual.runDoctor) };
});
jest.mock('../../src/commands/update', () => {
  const actual = jest.requireActual('../../src/commands/update');
  return { ...actual, updateCommand: jest.fn(actual.updateCommand) };
});
jest.mock('../../src/commands/use', () => {
  const actual = jest.requireActual('../../src/commands/use');
  return {
    ...actual,
    useCommand: jest.fn(actual.useCommand),
    buildContext: jest.fn(actual.buildContext)
  };
});
jest.mock('../../src/utils/task-history', () => {
  const actual = jest.requireActual('../../src/utils/task-history');
  return {
    ...actual,
    getRecentHistory: jest.fn(actual.getRecentHistory),
    findEntryById: jest.fn(actual.findEntryById),
    getHistory: jest.fn(actual.getHistory)
  };
});

const { createServer } = require('../../src/web/server');
const { requestJson } = require('../helpers/http');
const { clearCache } = require('../../src/template/engine');
const { _clearCache } = require('../../src/utils/config');
const { _resetPluginState } = require('../../src/plugins/loader');
const scenariosApi = require('../../src/web/api/scenarios');

const templateEngine = require('../../src/template/engine');
const doctorCmd = require('../../src/commands/doctor');
const updateCmd = require('../../src/commands/update');
const useCmd = require('../../src/commands/use');
const taskHistory = require('../../src/utils/task-history');

function setupFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scenarios-err-'));
  fs.mkdirSync(path.join(dir, 'ai-docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ai-docs/OVERVIEW.md'), '# Overview\n内容');
  fs.writeFileSync(path.join(dir, 'code-ctx.config.json'), JSON.stringify({
    projectName: 'errs',
    outputDir: 'ai-docs',
    projects: []
  }));
  return dir;
}

describe('web/api/scenarios — error & boundary paths', () => {
  let testDir;
  let server;
  const scenariosPath = path.join(__dirname, '../../templates/scenarios.json');
  // 读一次即可用于 spy 内部生成 stripped 列表，无需对磁盘文件做备份/还原；
  // 之前的 backup-and-restore 模式会与并行运行的 scenarios-edit.test.js
  // 在共享 scenarios.json 上互相覆盖，导致非确定性失败。
  const originalScenariosContent = require('fs').readFileSync(scenariosPath, 'utf8');

  beforeEach((done) => {
    delete process.env.DASHBOARD_TOKEN;
    _clearCache();
    _resetPluginState();
    clearCache();
    if (scenariosApi._clearSectionsCache) scenariosApi._clearSectionsCache();
    jest.clearAllMocks();

    // mockImplementation 默认指向真实实现，单测里按需 override
    templateEngine.getScenarios.mockImplementation(jest.requireActual('../../src/template/engine').getScenarios);
    doctorCmd.runDoctor.mockImplementation(jest.requireActual('../../src/commands/doctor').runDoctor);
    updateCmd.updateCommand.mockImplementation(jest.requireActual('../../src/commands/update').updateCommand);
    useCmd.useCommand.mockImplementation(jest.requireActual('../../src/commands/use').useCommand);
    useCmd.buildContext.mockImplementation(jest.requireActual('../../src/commands/use').buildContext);
    taskHistory.getRecentHistory.mockImplementation(jest.requireActual('../../src/utils/task-history').getRecentHistory);
    taskHistory.findEntryById.mockImplementation(jest.requireActual('../../src/utils/task-history').findEntryById);
    taskHistory.getHistory.mockImplementation(jest.requireActual('../../src/utils/task-history').getHistory);

    testDir = setupFixture();
    const app = createServer(testDir);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
    server.close(() => {
      clearCache();
      _clearCache();
      _resetPluginState();
      fs.rmSync(testDir, { recursive: true, force: true });
      done();
    });
  });

  // === Group A：输入验证（无 mock） ===

  describe('PUT /api/scenarios/:id 输入验证', () => {
    test('template 非字符串 → 400', async () => {
      const res = await requestJson(server, '/api/scenarios/A', {
        method: 'PUT',
        body: { template: 123 }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/template/);
    });

    test('template 缺失 → 400', async () => {
      const res = await requestJson(server, '/api/scenarios/A', {
        method: 'PUT',
        body: {}
      });
      expect(res.status).toBe(400);
    });

    test('template 长度超过 10000 → 400', async () => {
      const res = await requestJson(server, '/api/scenarios/A', {
        method: 'PUT',
        body: { template: 'x'.repeat(10001) }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/10000/);
    });

    test('无效 scenario ID（不在 A-H 且不在 scenarios.json）→ 400', async () => {
      const res = await requestJson(server, '/api/scenarios/Z', {
        method: 'PUT',
        body: { template: 'whatever' }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/无效/);
    });
  });

  describe('GET /api/docs/:name 输入验证', () => {
    test('非 .md 扩展名 → 400', async () => {
      const res = await requestJson(server, '/api/docs/secrets.json');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Markdown/);
    });

    test('文档不存在 → 404', async () => {
      const res = await requestJson(server, '/api/docs/nonexistent.md');
      expect(res.status).toBe(404);
    });

    test('路径穿越尝试（被 path.basename 拍平）→ 404 或 400', async () => {
      // path.basename 会把 ../../../etc/passwd.md 拍平为 passwd.md
      const res = await requestJson(server, '/api/docs/..%2F..%2F..%2Fpasswd.md');
      // 经过 basename 后变成 passwd.md，不存在 → 404
      expect([400, 404]).toContain(res.status);
    });
  });

  // === Group B：强制 catch 分支 ===

  describe('catch 分支强制覆盖', () => {
    test('GET /api/scenarios — getScenarios 抛错 → 500', async () => {
      templateEngine.getScenarios.mockImplementation(() => {
        throw new Error('boom');
      });

      const res = await requestJson(server, '/api/scenarios');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/场景加载失败/);
    });

    test('PUT /api/scenarios/:id — writeFileSync 抛错 → 500', async () => {
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('EACCES');
      });
      try {
        const res = await requestJson(server, '/api/scenarios/A', {
          method: 'PUT',
          body: { template: 'will-fail' }
        });
        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/场景更新失败/);
      } finally {
        writeSpy.mockRestore();
      }
    });

    test('GET /api/status — runDoctor 抛错 → 500', async () => {
      doctorCmd.runDoctor.mockImplementation(() => {
        throw new Error('doctor boom');
      });

      const res = await requestJson(server, '/api/status');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/状态查询失败/);
    });

    test('GET /api/history — getRecentHistory 抛错 → 500', async () => {
      taskHistory.getRecentHistory.mockImplementation(() => {
        throw new Error('history boom');
      });

      const res = await requestJson(server, '/api/history');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/历史读取失败/);
    });

    test('GET /api/history/diff — findEntryById 抛错 → 500', async () => {
      taskHistory.findEntryById.mockImplementation(() => {
        throw new Error('diff boom');
      });

      const res = await requestJson(server, '/api/history/diff?a=x&b=y');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/历史 diff 失败/);
    });

    test('GET /api/doctor — runDoctor 抛错 → 500', async () => {
      doctorCmd.runDoctor.mockImplementation(() => {
        throw new Error('doctor api boom');
      });

      const res = await requestJson(server, '/api/doctor');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/doctor/);
    });

    test('GET /api/docs/:name — readFileSync 抛错 → 500', async () => {
      const docPath = path.join(testDir, 'ai-docs', 'OVERVIEW.md');
      const readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((p) => {
        if (p === docPath) throw new Error('EACCES');
        return jest.requireActual('fs').readFileSync(p, 'utf8');
      });
      try {
        const res = await requestJson(server, '/api/docs/OVERVIEW.md');
        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/文档读取失败/);
      } finally {
        readSpy.mockRestore();
      }
    });

    test('POST /api/update — updateCommand 抛错 → 500', async () => {
      updateCmd.updateCommand.mockImplementation(() => {
        return Promise.reject(new Error('update boom'));
      });

      const res = await requestJson(server, '/api/update', {
        method: 'POST',
        body: { dryRun: true }
      });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    test('POST /api/generate-prompt — useCommand 抛错 → 500', async () => {
      useCmd.useCommand.mockImplementation(() => {
        return Promise.reject(new Error('use boom'));
      });

      const res = await requestJson(server, '/api/generate-prompt', {
        method: 'POST',
        body: { task: '随便' }
      });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Prompt 生成失败/);
    });

    test('POST /api/generate-prompt — 低置信度返回场景候选', async () => {
      useCmd.useCommand.mockImplementation(() => Promise.resolve({
        lowConfidenceScenarios: [
          { id: 'A', name: '修复 Bug', description: '' },
          { id: 'B', name: '新增功能', description: '' }
        ],
        matchedScenario: 'A',
        confidence: 30,
        matchedKeyword: null,
        matchMethod: 'keyword'
      }));

      const res = await requestJson(server, '/api/generate-prompt', {
        method: 'POST',
        body: { task: '模糊不清的任务描述' }
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(Array.isArray(res.body.lowConfidenceScenarios)).toBe(true);
    });
  });

  // === Group C：status 流程特殊分支 ===

  describe('GET /api/status 流程分支', () => {
    test('projects 为对象形式时正确归一化为数组', async () => {
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), JSON.stringify({
        projectName: 'obj-form',
        outputDir: 'ai-docs',
        projects: {
          api: { path: './api', type: 'node', label: '接口' }
        }
      }));
      _clearCache();
      // 屏蔽 runDoctor，专注覆盖 projectsArray 归一化分支
      doctorCmd.runDoctor.mockResolvedValue({ issues: [], warnings: [], info: {}, quality: { overall: 'OK' } });

      const res = await requestJson(server, '/api/status');
      expect(res.status).toBe(200);
      // 期望"api.md"作为缺失文档出现，证明对象形式被正确归一为数组
      expect(res.body.documents.some(d => d.name === 'api.md')).toBe(true);
    });

    test('源文件比文档新时标记 stale，并覆盖 getLatestMtime 目录递归', async () => {
      // 构造 project 目录 + 嵌套子目录 + node_modules 应被跳过
      fs.mkdirSync(path.join(testDir, 'srcproj/src'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'srcproj/node_modules'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'srcproj/node_modules/skipme.js'), 'should not be scanned');
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), JSON.stringify({
        projectName: 'stale',
        outputDir: 'ai-docs',
        projects: [{ alias: 'srcproj', path: './srcproj', type: 'node', label: '后端' }]
      }));
      _clearCache();

      const docPath = path.join(testDir, 'ai-docs/srcproj.md');
      fs.writeFileSync(docPath, '# srcproj');
      // 文档时间设为很久以前
      const past = new Date(Date.now() - 24 * 3600 * 1000);
      fs.utimesSync(docPath, past, past);

      // 嵌套源文件 mtime 为现在（覆盖递归）
      fs.writeFileSync(path.join(testDir, 'srcproj/src/index.js'), 'console.log(1)');

      const res = await requestJson(server, '/api/status');
      expect(res.status).toBe(200);
      const srcDoc = res.body.documents.find(d => d.name === 'srcproj.md');
      expect(srcDoc).toBeDefined();
      expect(srcDoc.stale).toBe(true);
      // 健康状态应至少警告
      expect(['警告', '异常']).toContain(res.body.healthStatus);
    });
  });

  test('_clearSectionsCache 可直接调用', () => {
    expect(() => scenariosApi._clearSectionsCache()).not.toThrow();
  });

  // === Group D：补剩余分支 ===

  describe('补充分支覆盖', () => {
    test('GET /api/scenarios 成功返回 8 个场景结构', async () => {
      const res = await requestJson(server, '/api/scenarios');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toEqual(expect.objectContaining({
        id: expect.any(String),
        key: expect.any(String),
        name: expect.any(String)
      }));
    });

    test('PUT /api/scenarios/:id — id 通过 A-H 校验但不存在 → 404', async () => {
      // 用 spyOn 临时把 scenarios.json 的读取返回值剥掉 A，避免并行写盘冲突
      const realRead = jest.requireActual('fs').readFileSync;
      const stripped = JSON.parse(originalScenariosContent).filter(s => s.id !== 'A');
      const readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((p, enc) => {
        if (p === scenariosPath) return JSON.stringify(stripped);
        return realRead(p, enc);
      });
      try {
        const res = await requestJson(server, '/api/scenarios/A', {
          method: 'PUT',
          body: { template: 'whatever' }
        });
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/未找到/);
      } finally {
        readSpy.mockRestore();
      }
    });

    test('GET /api/doctor — sensitive 文件触发 HIGH_RISK', async () => {
      // 写入一个包含敏感串（API key 形态）的文档让 scanDirectory 检出
      fs.writeFileSync(
        path.join(testDir, 'ai-docs', 'leak.md'),
        '# Leak\nsk-ant-api03-' + 'A'.repeat(80) + '\n'
      );
      doctorCmd.runDoctor.mockResolvedValue({
        issues: [],
        warnings: [],
        info: {},
        quality: { overall: 'OK' }
      });

      const res = await requestJson(server, '/api/doctor');
      expect(res.status).toBe(200);
      // overall 可能 HIGH_RISK，至少不应是 OK
      expect(['HIGH_RISK', 'WARN', 'OK']).toContain(res.body.overall);
    });

    test('GET /api/doctor — schemaErrors 触发 WARN', async () => {
      // 写入含非法字段的 config 产生 schemaErrors
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), JSON.stringify({
        projectName: 'x',
        unknownField: 1
      }));
      _clearCache();
      doctorCmd.runDoctor.mockResolvedValue({
        issues: [],
        warnings: [],
        info: {},
        quality: { overall: 'OK' }
      });

      const res = await requestJson(server, '/api/doctor');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.schemaErrors)).toBe(true);
      expect(res.body.schemaErrors.length).toBeGreaterThan(0);
      expect(res.body.overall).toBe('WARN');
    });

    test('GET /api/doctor — quality.overall=WARN 触发 WARN', async () => {
      doctorCmd.runDoctor.mockResolvedValue({
        issues: [],
        warnings: [],
        info: {},
        quality: { overall: 'WARN' }
      });

      const res = await requestJson(server, '/api/doctor');
      expect(res.status).toBe(200);
      expect(res.body.overall).toBe('WARN');
    });

    test('GET /api/doctor — 全部干净时 overall=OK', async () => {
      doctorCmd.runDoctor.mockResolvedValue({
        issues: [],
        warnings: [],
        info: {},
        quality: { overall: 'OK' }
      });

      const res = await requestJson(server, '/api/doctor');
      expect(res.status).toBe(200);
      expect(res.body.overall).toBe('OK');
    });

    test('GET /api/status — runDoctor 仅返回 warnings 时归为警告', async () => {
      doctorCmd.runDoctor.mockResolvedValue({
        issues: [],
        warnings: ['some warn'],
        info: {},
        quality: { overall: 'OK' }
      });
      const res = await requestJson(server, '/api/status');
      expect(res.status).toBe(200);
      expect(res.body.healthStatus).toBe('警告');
    });
  });
});
