const doctorModule = require('../../src/commands/doctor');
const { doctorCommand, doctorFix, runDoctor, _clearDoctorCache } = doctorModule;
const fs = require('fs');
const path = require('path');

describe('doctorCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/doctor-test');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    // 清除 require 缓存
    Object.keys(require.cache).forEach(key => {
      if (key.includes('code-ctx.config.js')) {
        delete require.cache[key];
      }
    });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should detect missing OVERVIEW.md', async () => {
    const report = await doctorCommand(testDir);
    expect(report.issues.some(i => i.message.includes('OVERVIEW'))).toBe(true);
  });

  test('should detect sparse content', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# Overview\n');

    const report = await doctorCommand(testDir);
    expect(report.warnings.some(w => w.message.includes('内容过少'))).toBe(true);
  });

  test('should detect sensitive information', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# 项目总览\n## 项目概述\n这是一个测试项目，包含前端和后端\n## 子项目列表\n- web: 前端项目\n- api: 后端项目\n## 技术栈\nReact + Node.js');
    fs.writeFileSync(path.join(testDir, 'ai-docs/config.md'), 'password = "secret123"');

    const report = await doctorCommand(testDir);
    expect(report.warnings.some(w => w.field === 'password')).toBe(true);
  });

  test('should report no issues for complete docs', async () => {
    // 创建一个真实的项目目录结构
    fs.mkdirSync(path.join(testDir, 'web'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'web/package.json'), '{"dependencies":{"react":"^18.0.0"}}');

    fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'),
      `module.exports = { projects: [{ alias: 'web', path: './web', type: 'react', label: '前端' }] };`);

    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# 项目总览\n## 项目概述\n这是一个完整的测试项目，包含前端和后端\n## 子项目列表\n- web: 前端项目\n## 技术栈\nReact + Node.js + Express\n## 项目关系\n前端调用后端API');
    fs.writeFileSync(path.join(testDir, 'ai-docs/web.md'),
      '# Web 前端项目\n## 目录结构\nsrc/\n## 核心模块\nApp.jsx');

    const report = await doctorCommand(testDir);
    expect(report.issues.length).toBe(0);
  });

  test('should report missing ai-docs directory', async () => {
    fs.rmSync(path.join(testDir, 'ai-docs'), { recursive: true, force: true });

    const report = await doctorCommand(testDir);
    expect(report.issues.some(i => i.message.includes('ai-docs'))).toBe(true);
  });

  test('runDoctor should expose doctor report for Web API reuse', async () => {
    fs.rmSync(path.join(testDir, 'ai-docs'), { recursive: true, force: true });

    const report = await runDoctor({ rootDir: testDir });
    expect(report.issues.some(i => i.message.includes('ai-docs'))).toBe(true);
  });

  test('runDoctor silent mode caches result within TTL', async () => {
    _clearDoctorCache();
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# 项目总览\n## 项目概述\n测试\n## 子项目列表\n- web\n## 技术栈\nReact');

    // Identity check: cache hit returns the stored object reference, while
    // a fresh doctorCommand run would produce a new object each time.
    const a = await runDoctor({ rootDir: testDir, silent: true });
    const b = await runDoctor({ rootDir: testDir, silent: true });
    expect(b).toBe(a);
    _clearDoctorCache();
  });

  test('runDoctor silent cache invalidates when ai-docs mtime changes', async () => {
    _clearDoctorCache();
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# 项目总览\n## 项目概述\n测试\n## 子项目列表\n- web\n## 技术栈\nReact');

    const a = await runDoctor({ rootDir: testDir, silent: true });

    // Bumping the ai-docs directory mtime should drop the cache entry.
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(testDir, 'ai-docs'), future, future);

    const b = await runDoctor({ rootDir: testDir, silent: true });
    expect(b).not.toBe(a);
    _clearDoctorCache();
  });

  test('should return info object with projects', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# 项目总览\n## 项目概述\n测试项目\n## 子项目列表\n- web\n## 技术栈\nReact');

    const report = await doctorCommand(testDir);
    expect(report.info).toBeDefined();
    expect(report.info.projects).toBeDefined();
    expect(Array.isArray(report.info.projects)).toBe(true);
  });

  test('should check config vs actual projects', async () => {
    // 创建一个子项目目录
    fs.mkdirSync(path.join(testDir, 'web'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'web/package.json'), '{"dependencies":{"react":"^18.0.0"}}');

    // 配置中没有这个项目
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'),
      `module.exports = { projects: [] };`);

    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# 项目总览\n## 项目概述\n测试项目\n## 子项目列表\n## 技术栈\nReact');

    const report = await doctorCommand(testDir);
    // 应该检测到未配置的项目
    expect(report.warnings.some(w => w.type === 'unconfigured' || w.message.includes('未在配置中'))).toBe(true);
  });

  test('should accept strict option', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# 项目总览\n## 项目概述\n测试项目\n## 子项目列表\n## 技术栈\nReact');

    const report = await doctorCommand(testDir, { strict: true });
    expect(report.info).toBeDefined();
  });
});

describe('doctorFix', () => {
  const testDir = path.join(__dirname, '../fixtures/doctor-fix-test');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should report missing config', async () => {
    await doctorFix(testDir);
    // 没有配置文件应该打印错误信息
  });

  test('should report missing API key', async () => {
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'),
      `module.exports = { projects: [] };`);
    // 创建 .env 文件，设置一个空的 API Key 以防止读取工具目录的 .env
    fs.writeFileSync(path.join(testDir, '.env'), 'OPENAI_API_KEY=\nANTHROPIC_API_KEY=\nANTHROPIC_AUTH_TOKEN=');

    // 确保没有 API Key
    const originalEnv = process.env.ANTHROPIC_API_KEY;
    const originalAuth = process.env.ANTHROPIC_AUTH_TOKEN;
    const originalOpenAI = process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.OPENAI_API_KEY;

    try {
      await doctorFix(testDir);
    } finally {
      // 恢复环境变量
      if (originalEnv) process.env.ANTHROPIC_API_KEY = originalEnv;
      if (originalAuth) process.env.ANTHROPIC_AUTH_TOKEN = originalAuth;
      if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
    }
  });
});
