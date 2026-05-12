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
});
