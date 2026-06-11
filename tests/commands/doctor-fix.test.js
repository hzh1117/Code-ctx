// 独立测试文件：覆盖 src/commands/doctor.js 的 doctorFix() --fix 分支。
//
// 为何独立成文件：doctorFix 内部会调用真实的 AI 客户端和 getAIConfig，
// 后者会兜底读取 code-ctx 工具目录的 .env（可能含真实 API Key），
// 因此本文件统一把这两条依赖 mock 掉，避免污染 tests/commands/doctor.test.js
// 已有的 doctorCommand 用例（那些用例不走 doctorFix 路径）。
//
// 这些用例的目标是把 doctor.js 的行覆盖从 64% 抬到 ≥ 80%。

jest.mock('../../src/ai/client', () => ({
  generateWithAI: jest.fn(),
  generateWithContinuation: jest.fn()
}));
jest.mock('../../src/utils/config', () => {
  const actual = jest.requireActual('../../src/utils/config');
  return {
    ...actual,
    getAIConfig: jest.fn()
  };
});

const fs = require('fs');
const path = require('path');
const os = require('os');

const { doctorFix } = require('../../src/commands/doctor');
const aiClient = require('../../src/ai/client');
const configUtils = require('../../src/utils/config');

const MOCK_AI_OUTPUT = '# Auto Doc\n\n## 概述\n这是 doctor --fix 单元测试中由 mock AI 生成的占位文本。\n\n## 模块\n占位模块说明。';

function configWithKey() {
  return {
    apiKey: 'sk-test-mock',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.5',
    maxTokens: 4096,
    timeout: 180000,
    providers: {
      openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.5', maxTokens: 4096 },
      anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-6', maxTokens: 4096 }
    }
  };
}

describe('doctorFix --fix 分支', () => {
  let testDir;
  let logSpy;
  let errSpy;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-fix-'));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    aiClient.generateWithContinuation.mockReset();
    aiClient.generateWithContinuation.mockResolvedValue(MOCK_AI_OUTPUT);

    configUtils.getAIConfig.mockReset();
    configUtils.getAIConfig.mockReturnValue(configWithKey());

    // 清除 config 缓存，避免上一个测试的 mtime 缓存命中
    configUtils._clearCache && configUtils._clearCache();
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  function loggedText() {
    return logSpy.mock.calls.flat().map(String).join('\n');
  }

  test('配置不存在时输出错误并退出，不调用 AI', async () => {
    await expect(doctorFix(testDir)).resolves.toBeUndefined();

    expect(loggedText()).toMatch(/未找到 code-ctx\.config/);
    expect(aiClient.generateWithContinuation).not.toHaveBeenCalled();
    // 也未应创建 ai-docs/
    expect(fs.existsSync(path.join(testDir, 'ai-docs'))).toBe(false);
  });

  test('配置 JSON 解析失败时优雅退出，不调用 AI', async () => {
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), '{ this is not json');

    await expect(doctorFix(testDir)).resolves.toBeUndefined();

    expect(loggedText()).toMatch(/解析失败/);
    expect(aiClient.generateWithContinuation).not.toHaveBeenCalled();
  });

  test('无 API Key 时输出提示并退出，不调用 AI', async () => {
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({ projects: [] })
    );
    // 让 getAIConfig 返回空 apiKey，覆盖 doctorFix 的 apiKey 缺失分支
    configUtils.getAIConfig.mockReturnValue({ ...configWithKey(), apiKey: '' });

    await expect(doctorFix(testDir)).resolves.toBeUndefined();

    expect(loggedText()).toMatch(/未配置 API Key/);
    expect(aiClient.generateWithContinuation).not.toHaveBeenCalled();
  });

  test('文档不存在时调用 AI 重新生成 + 同时生成 OVERVIEW.md', async () => {
    fs.mkdirSync(path.join(testDir, 'web'));
    fs.writeFileSync(
      path.join(testDir, 'web/package.json'),
      JSON.stringify({ name: 'w', dependencies: { react: '^18.0.0' } })
    );
    fs.writeFileSync(path.join(testDir, 'web/index.jsx'), 'export default function App(){}');
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({ projects: [{ alias: 'web', path: './web', type: 'react' }] })
    );

    await doctorFix(testDir);

    // 应为 web.md 调用一次，再为 OVERVIEW.md 调用一次
    expect(aiClient.generateWithContinuation).toHaveBeenCalledTimes(2);
    const webDoc = path.join(testDir, 'ai-docs/web.md');
    expect(fs.existsSync(webDoc)).toBe(true);
    expect(fs.readFileSync(webDoc, 'utf8')).toContain('Auto Doc');
    const overviewDoc = path.join(testDir, 'ai-docs/OVERVIEW.md');
    expect(fs.existsSync(overviewDoc)).toBe(true);
    expect(loggedText()).toMatch(/修复完成/);
  });

  test('--force 强制重新生成已存在的文档', async () => {
    fs.mkdirSync(path.join(testDir, 'web'));
    fs.writeFileSync(
      path.join(testDir, 'web/package.json'),
      JSON.stringify({ name: 'w', dependencies: { react: '^18.0.0' } })
    );
    fs.writeFileSync(path.join(testDir, 'web/index.jsx'), 'export default function App(){}');
    fs.mkdirSync(path.join(testDir, 'ai-docs'));
    fs.writeFileSync(path.join(testDir, 'ai-docs/web.md'), '# 旧版 Web 文档');
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# 旧版 Overview');
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({ projects: [{ alias: 'web', path: './web', type: 'react' }] })
    );

    await doctorFix(testDir, { force: true });

    expect(aiClient.generateWithContinuation).toHaveBeenCalledTimes(2);
    const updated = fs.readFileSync(path.join(testDir, 'ai-docs/web.md'), 'utf8');
    expect(updated).not.toContain('旧版');
    expect(updated).toContain('Auto Doc');
  });

  test('项目目录不存在时跳过该子项目，不为它写入文档', async () => {
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({ projects: [{ alias: 'web', path: './nonexistent', type: 'react' }] })
    );

    await expect(doctorFix(testDir)).resolves.toBeUndefined();

    // web.md 不应被生成（外层有 fs.existsSync(projectDir) 短路）
    expect(fs.existsSync(path.join(testDir, 'ai-docs/web.md'))).toBe(false);
    expect(loggedText()).toMatch(/项目目录不存在/);
  });

  test('AI 调用失败时打印错误，但 doctorFix 不抛出异常', async () => {
    fs.mkdirSync(path.join(testDir, 'web'));
    fs.writeFileSync(
      path.join(testDir, 'web/package.json'),
      JSON.stringify({ name: 'w', dependencies: { react: '^18.0.0' } })
    );
    fs.writeFileSync(path.join(testDir, 'web/index.jsx'), 'export default function App(){}');
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({ projects: [{ alias: 'web', path: './web', type: 'react' }] })
    );

    aiClient.generateWithContinuation.mockRejectedValue(new Error('boom-from-mock-ai'));

    await expect(doctorFix(testDir)).resolves.toBeUndefined();

    expect(loggedText()).toMatch(/生成失败/);
    // web.md 因生成失败应当未被写入
    expect(fs.existsSync(path.join(testDir, 'ai-docs/web.md'))).toBe(false);
  });

  test('ai-docs 目录不存在时自动创建', async () => {
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({ projects: [] })
    );

    expect(fs.existsSync(path.join(testDir, 'ai-docs'))).toBe(false);
    await doctorFix(testDir);

    expect(fs.existsSync(path.join(testDir, 'ai-docs'))).toBe(true);
    // projects 为空，所以只会生成 OVERVIEW.md 一次
    expect(aiClient.generateWithContinuation).toHaveBeenCalledTimes(1);
  });

  test('已存在但匹配度低的文档会触发"过期"分支重新生成', async () => {
    fs.mkdirSync(path.join(testDir, 'api/routes'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'api/controllers'), { recursive: true });
    // node-backend 适配器 scanPatterns = ['routes/*.js', 'controllers/*.js', 'app.js']
    fs.writeFileSync(
      path.join(testDir, 'api/package.json'),
      JSON.stringify({ name: 'api', dependencies: { express: '^5.0.0' } })
    );
    fs.writeFileSync(path.join(testDir, 'api/app.js'), '// app entry');
    fs.writeFileSync(path.join(testDir, 'api/routes/users.js'), '// users route');
    fs.writeFileSync(path.join(testDir, 'api/routes/orders.js'), '// orders route');
    fs.writeFileSync(path.join(testDir, 'api/controllers/userCtrl.js'), '// user controller');
    fs.writeFileSync(path.join(testDir, 'api/controllers/orderCtrl.js'), '// order controller');
    fs.mkdirSync(path.join(testDir, 'ai-docs'));
    // 现有文档不提任何上述关键文件 → mentionRate 接近 0
    fs.writeFileSync(path.join(testDir, 'ai-docs/api.md'), '# 旧的 API 文档\n本文档与代码无关。');
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# 已存在的 Overview');
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({ projects: [{ alias: 'api', path: './api', type: 'node-backend' }] })
    );

    await doctorFix(testDir);

    expect(loggedText()).toMatch(/文档过期/);
    // api.md 应被重写为 mock 内容；OVERVIEW.md 已存在且无 --force，不再重生
    expect(fs.readFileSync(path.join(testDir, 'ai-docs/api.md'), 'utf8')).toContain('Auto Doc');
    expect(fs.readFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), 'utf8')).toContain('已存在的 Overview');
    expect(aiClient.generateWithContinuation).toHaveBeenCalledTimes(1);
  });
});
