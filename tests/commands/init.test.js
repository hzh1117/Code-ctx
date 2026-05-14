const { initCommand } = require('../../src/commands/init');
const { loadConfigWithVM } = require('../../src/utils/config');
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

    await initCommand(testDir, { skipPrompt: true, skipAi: true });

    expect(fs.existsSync(path.join(testDir, 'ai-docs'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.js'))).toBe(true);
  });

  test('should generate valid config file', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');

    await initCommand(testDir, { skipPrompt: true, skipAi: true });

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

    const result = await initCommand(testDir, { skipPrompt: true, skipAi: true });

    expect(result.projects.length).toBe(1);
    expect(result.projects[0].type).toBe('react');
  });

  test('should preserve detected project path in generated config', async () => {
    const subDir = path.join(testDir, 'my-app');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' }
    }));

    await initCommand(testDir, { skipPrompt: true, skipAi: true });

    const configPath = path.join(testDir, 'code-ctx.config.js');
    const config = loadConfigWithVM(configPath);
    expect(config.projects[0].path).toBe(subDir);
  });

  test('should return config with project info', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');

    const result = await initCommand(testDir, { skipPrompt: true, skipAi: true });

    expect(result).toHaveProperty('projects');
    expect(result).toHaveProperty('config');
    expect(result.config.projectName).toBe('init-test');
  });
});

describe('initCommand enhanced features', () => {
  const testDir = path.join(__dirname, '../fixtures/init-enhanced-test');

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

  test('should write .init-state.json after init', async () => {
    const subDir = path.join(testDir, 'my-app');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' }
    }));

    await initCommand(testDir, { skipPrompt: true, skipAi: true });

    const statePath = path.join(testDir, 'ai-docs', '.init-state.json');
    expect(fs.existsSync(statePath)).toBe(true);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    expect(state).toHaveProperty('lastRun');
    expect(state).toHaveProperty('projects');
  });

  test('should skip completed projects on re-run', async () => {
    const subDir = path.join(testDir, 'my-app');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' }
    }));

    await initCommand(testDir, { skipPrompt: true, skipAi: true });

    const statePath = path.join(testDir, 'ai-docs', '.init-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const alias = Object.keys(state.projects)[0];
    state.projects[alias].status = 'completed';
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    const result = await initCommand(testDir, { skipPrompt: true, skipAi: true });
    expect(result).toBeDefined();
  });

  test('should detect sensitive info in generated docs', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');
    const aiDocsDir = path.join(testDir, 'ai-docs');
    fs.mkdirSync(aiDocsDir, { recursive: true });
    fs.writeFileSync(path.join(aiDocsDir, 'test.md'), 'password = "secret123"');

    const result = await initCommand(testDir, { skipPrompt: true, skipAi: true });
    expect(result).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
