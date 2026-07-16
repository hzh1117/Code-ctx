const { initCommand } = require('../../src/commands/init');
const { useCommand } = require('../../src/commands/use');
const { doctorCommand } = require('../../src/commands/doctor');
const fs = require('fs');
const path = require('path');

describe('Full Flow Integration', () => {
  const testDir = path.join(__dirname, '../fixtures/integration-test');

  beforeAll(async () => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        dependencies: { vue: '^2.0.0', 'element-ui': '^2.0.0' }
      })
    );
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should complete full workflow', async () => {
    // 1. Init
    const initResult = await initCommand(testDir, { skipPrompt: true, skipAi: true });
    expect(fs.existsSync(path.join(testDir, 'ai-docs'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.json'))).toBe(true);
    expect(initResult).toBeDefined();
    expect(initResult.projects).toBeDefined();
    expect(initResult.status).toBe('offline-completed');
    expect(fs.existsSync(path.join(testDir, 'ai-docs', 'OVERVIEW.md'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'ai-docs', 'project-manifest.json'))).toBe(true);

    // 2. Use
    const result = await useCommand({
      scenario: 'B',
      taskDescription: '用户管理',
      rootDir: testDir
    });
    expect(result.prompt).toContain('用户管理');
    expect(result.prompt).toContain('deterministic repository scanning');
    expect(typeof result.prompt).toBe('string');

    // 3. Doctor
    const report = await doctorCommand(testDir);
    expect(report).toBeDefined();
    expect(report.issues).toBeDefined();
    expect(report.warnings).toBeDefined();
  });

  test('should handle init with multiple projects', async () => {
    const multiDir = path.join(__dirname, '../fixtures/integration-multi-project-test');
    if (fs.existsSync(multiDir)) {
      fs.rmSync(multiDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(multiDir, 'frontend'), { recursive: true });
    fs.mkdirSync(path.join(multiDir, 'backend'), { recursive: true });
    fs.writeFileSync(
      path.join(multiDir, 'frontend', 'package.json'),
      JSON.stringify({
        dependencies: { react: '^18.0.0' }
      })
    );
    fs.writeFileSync(
      path.join(multiDir, 'backend', 'package.json'),
      JSON.stringify({
        dependencies: { express: '^4.0.0' }
      })
    );

    const result = await initCommand(multiDir, { skipPrompt: true, skipAi: true });
    expect(result.projects.length).toBeGreaterThanOrEqual(1);

    fs.rmSync(multiDir, { recursive: true, force: true });
  });

  test('should throw error for invalid scenario in use', async () => {
    await expect(useCommand({ scenario: 'INVALID' })).rejects.toThrow('未找到场景: INVALID');
  });

  test('should detect issues with doctor when ai-docs missing', async () => {
    const emptyDir = path.join(__dirname, '../fixtures/empty-test');
    fs.mkdirSync(emptyDir, { recursive: true });

    const report = await doctorCommand(emptyDir);
    expect(report.issues.some(i => i.message.includes('ai-docs'))).toBe(true);

    fs.rmSync(emptyDir, { recursive: true, force: true });
  });
});
