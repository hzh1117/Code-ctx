const { doctorCommand } = require('../../src/commands/doctor');
const fs = require('fs');
const path = require('path');

describe('doctorCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/doctor-test');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should check section completeness', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# Overview\nSome content');

    const report = await doctorCommand(testDir);
    expect(report.issues.length).toBeGreaterThan(0);
  });

  test('should detect sensitive information', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/config.md'), 'password = "secret123"');

    const report = await doctorCommand(testDir);
    expect(report.warnings.some(w => w.includes('敏感'))).toBe(true);
  });

  test('should report no issues for complete docs', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# Overview\n## 项目概述\n## 子项目列表\n## 技术栈');
    fs.writeFileSync(path.join(testDir, 'ai-docs/api-contracts.md'),
      '# API\n## 接口列表');

    const report = await doctorCommand(testDir);
    expect(report.issues.length).toBe(0);
  });

  test('should report missing ai-docs directory', async () => {
    fs.rmSync(path.join(testDir, 'ai-docs'), { recursive: true, force: true });

    const report = await doctorCommand(testDir);
    expect(report.issues.some(i => i.includes('ai-docs'))).toBe(true);
  });

  test('should detect api key in content', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# Overview\napi_key = "sk-12345"');

    const report = await doctorCommand(testDir);
    expect(report.warnings.some(w => w.includes('敏感'))).toBe(true);
  });

  test('should return info object', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# Overview\n## 项目概述\n## 子项目列表\n## 技术栈');
    fs.writeFileSync(path.join(testDir, 'ai-docs/api-contracts.md'),
      '# API\n## 接口列表');

    const report = await doctorCommand(testDir);
    expect(report.info).toBeDefined();
  });

  test('should check OVERVIEW consistency with config', async () => {
    const testDir2 = path.join(__dirname, '../fixtures/doctor-enhanced');
    if (fs.existsSync(testDir2)) {
      fs.rmSync(testDir2, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir2, { recursive: true });
    fs.mkdirSync(path.join(testDir2, 'ai-docs'), { recursive: true });

    fs.writeFileSync(path.join(testDir2, 'ai-docs', 'OVERVIEW.md'),
      '# 总览\n## 子项目列表\n- web\n- api\n- admin');
    fs.writeFileSync(path.join(testDir2, 'code-ctx.config.js'),
      `module.exports = { projects: [{ alias: 'web' }, { alias: 'api' }] };`);

    const result = await doctorCommand(testDir2);

    expect(result.warnings.length + result.issues.length).toBeGreaterThan(0);

    fs.rmSync(testDir2, { recursive: true, force: true });
  });

  test('should count api contracts', async () => {
    const testDir3 = path.join(__dirname, '../fixtures/doctor-enhanced2');
    if (fs.existsSync(testDir3)) {
      fs.rmSync(testDir3, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir3, { recursive: true });
    fs.mkdirSync(path.join(testDir3, 'ai-docs'), { recursive: true });

    fs.writeFileSync(path.join(testDir3, 'ai-docs', 'api-contracts.md'),
      '# 接口列表\n## GET /api/users\n## POST /api/login\n## GET /api/orders');

    const result = await doctorCommand(testDir3);

    expect(result.info.endpointCount).toBe(3);

    fs.rmSync(testDir3, { recursive: true, force: true });
  });

  test('should accept options parameter', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'),
      '# Overview\n## 项目概述\n## 子项目列表\n## 技术栈');
    fs.writeFileSync(path.join(testDir, 'ai-docs/api-contracts.md'),
      '# API\n## 接口列表');

    const report = await doctorCommand(testDir, { strict: true });
    expect(report.issues.length).toBe(0);
  });
});
