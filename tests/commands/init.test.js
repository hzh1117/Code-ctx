const { initCommand } = require('../../src/commands/init');
const fs = require('fs');
const path = require('path');

describe('initCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/init-test');

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

  test('should create ai-docs directory', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');

    await initCommand(testDir, { skipPrompt: true });

    expect(fs.existsSync(path.join(testDir, 'ai-docs'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.js'))).toBe(true);
  });

  test('should generate valid config file', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');

    await initCommand(testDir, { skipPrompt: true });

    const configPath = path.join(testDir, 'code-ctx.config.js');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = require(configPath);
    expect(config.projectName).toBeDefined();
    expect(config.outputDir).toBe('./ai-docs');
    expect(config.aiMode).toBe('clipboard');
    expect(Array.isArray(config.projects)).toBe(true);
    expect(Array.isArray(config.excludeDirs)).toBe(true);
    expect(config.gitTrack).toBe(true);
  });

  test('should detect sub-projects', async () => {
    const subDir = path.join(testDir, 'my-app');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' }
    }));

    const result = await initCommand(testDir, { skipPrompt: true });

    expect(result.projects.length).toBe(1);
    expect(result.projects[0].type).toBe('react');
  });

  test('should return config with project info', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');

    const result = await initCommand(testDir, { skipPrompt: true });

    expect(result).toHaveProperty('projects');
    expect(result).toHaveProperty('config');
    expect(result.config.projectName).toBe('init-test');
  });
});
