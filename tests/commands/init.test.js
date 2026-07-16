const { initCommand } = require('../../src/commands/init');
const { loadProjectConfig, _clearCache } = require('../../src/utils/config');
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

  test('should create ai-docs directory and JSON config by default', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');
    _clearCache();

    await initCommand(testDir, { skipPrompt: true, skipAi: true });

    expect(fs.existsSync(path.join(testDir, 'ai-docs'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.json'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.js'))).toBe(false);
  });

  test('should generate valid config file', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');
    _clearCache();

    await initCommand(testDir, { skipPrompt: true, skipAi: true });

    const configPath = path.join(testDir, 'code-ctx.config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.projectName).toBeDefined();
    expect(config.outputDir).toBe('./ai-docs');
    expect(config.aiMode).toBe('clipboard');
    expect(Array.isArray(config.projects)).toBe(true);
    expect(Array.isArray(config.excludeDirs)).toBe(true);
    expect(config.gitTrack).toBe(true);
  });

  test('should always generate JSON config for new projects', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');
    _clearCache();

    await initCommand(testDir, { skipPrompt: true, skipAi: true, configFormat: 'js' });

    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.js'))).toBe(false);
    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.json'))).toBe(true);
  });

  test('should keep existing JS config and not create JSON', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.js'),
      `module.exports = { projectName: 'legacy', projects: [] };\n`
    );
    _clearCache();

    await initCommand(testDir, { skipPrompt: true, skipAi: true });

    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.json'))).toBe(false);
    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.js'))).toBe(true);
  });

  test('should detect sub-projects', async () => {
    const subDir = path.join(testDir, 'my-app');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(
      path.join(subDir, 'package.json'),
      JSON.stringify({
        dependencies: { react: '^18.0.0' }
      })
    );

    const result = await initCommand(testDir, { skipPrompt: true, skipAi: true });

    expect(result.projects.length).toBe(1);
    expect(result.projects[0].type).toBe('react');
  });

  test('should initialize a single project from the repository root', async () => {
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        dependencies: { express: '^5.0.0' }
      })
    );
    fs.writeFileSync(path.join(testDir, 'app.js'), 'module.exports = {};');

    const result = await initCommand(testDir, { skipPrompt: true, skipAi: true });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]).toEqual(
      expect.objectContaining({
        path: path.resolve(testDir),
        type: 'node-backend'
      })
    );
    expect(result.success).toBe(true);
  });

  test('uses an unknown root project when no framework is recognizable', async () => {
    fs.writeFileSync(path.join(testDir, 'main.ts'), 'export const value = 1;');

    const result = await initCommand(testDir, { skipPrompt: true, skipAi: true });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].type).toBe('unknown');
  });

  test('skip-ai writes deterministic documents and a consumable manifest', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        dependencies: { express: '^5.0.0' }
      })
    );
    fs.writeFileSync(path.join(testDir, 'app.js'), 'module.exports = {};');

    const first = await initCommand(testDir, { skipPrompt: true, skipAi: true });
    const alias = first.projects[0].alias;
    const docPath = path.join(testDir, 'ai-docs', `${alias}.md`);
    const overviewPath = path.join(testDir, 'ai-docs', 'OVERVIEW.md');
    const manifestPath = path.join(testDir, 'ai-docs', 'project-manifest.json');
    const firstDoc = fs.readFileSync(docPath, 'utf8');

    expect(first.status).toBe('offline-completed');
    expect(firstDoc).toContain('<!-- code-ctx-project:');
    expect(firstDoc).toContain('`package.json`');
    expect(firstDoc).toContain('`app.js`');
    expect(firstDoc).toContain('sha256:');
    expect(fs.readFileSync(overviewPath, 'utf8')).toContain(`\`${alias}\``);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.projects[0]).toEqual(
      expect.objectContaining({
        id: alias,
        sourcePath: '.',
        document: `${alias}.md`,
        keyFiles: expect.any(Array)
      })
    );

    await initCommand(testDir, { skipPrompt: true, skipAi: true });
    expect(fs.readFileSync(docPath, 'utf8')).toBe(firstDoc);
  });

  test('applies configured scan pattern overrides by project path', async () => {
    fs.mkdirSync(path.join(testDir, 'custom'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'custom' }));
    fs.writeFileSync(path.join(testDir, 'custom', 'entry.foo'), 'domain source');
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({
        projectName: 'custom',
        projects: [
          {
            alias: 'init-test',
            path: '.',
            type: 'generic-js-ts',
            scanPatterns: ['custom/**/*.foo']
          }
        ]
      })
    );
    _clearCache();

    await initCommand(testDir, { skipPrompt: true, skipAi: true });

    const manifest = JSON.parse(fs.readFileSync(path.join(testDir, 'ai-docs', 'project-manifest.json'), 'utf8'));
    expect(manifest.projects[0].keyFiles).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'custom/entry.foo' })])
    );
  });

  test('should persist detected project paths relative to the repository', async () => {
    const subDir = path.join(testDir, 'my-app');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(
      path.join(subDir, 'package.json'),
      JSON.stringify({
        dependencies: { react: '^18.0.0' }
      })
    );
    _clearCache();

    await initCommand(testDir, { skipPrompt: true, skipAi: true });

    const config = loadProjectConfig(testDir);
    expect(config.projects[0].path).toBe('./my-app');
    const persisted = JSON.parse(fs.readFileSync(path.join(testDir, 'code-ctx.config.json'), 'utf8'));
    expect(persisted.projects[0].path).toBe('./my-app');
    expect(persisted.projects[0].path).not.toContain(path.resolve(testDir));
  });

  test('should return config with project info', async () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');

    const result = await initCommand(testDir, { skipPrompt: true, skipAi: true });

    expect(result).toHaveProperty('projects');
    expect(result).toHaveProperty('config');
    expect(result.config.projectName).toBe('init-test');
  });

  test('returns merged disk configuration and an audit report', async () => {
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        dependencies: { express: '^5.0.0' }
      })
    );
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({
        projectName: 'custom-name',
        outputDir: './custom-docs',
        projects: [
          {
            alias: 'init-test',
            path: '.',
            type: 'generic-js-ts',
            label: 'Configured Label',
            scanPatterns: ['**/*.js']
          }
        ],
        excludeDirs: ['generated']
      })
    );
    _clearCache();

    const result = await initCommand(testDir, { skipPrompt: true, skipAi: true });

    expect(result.config).toEqual(
      expect.objectContaining({
        projectName: 'custom-name',
        outputDir: './custom-docs',
        excludeDirs: ['generated']
      })
    );
    expect(result.config.projects[0]).toEqual(
      expect.objectContaining({
        label: 'Configured Label',
        scanPatterns: ['**/*.js']
      })
    );
    expect(result.configMerge).toEqual(
      expect.objectContaining({
        source: 'merged',
        matched: 1,
        retained: []
      })
    );
    expect(result.configMerge.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'label', kept: 'Configured Label' })])
    );
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
    fs.writeFileSync(
      path.join(subDir, 'package.json'),
      JSON.stringify({
        dependencies: { react: '^18.0.0' }
      })
    );

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
    fs.writeFileSync(
      path.join(subDir, 'package.json'),
      JSON.stringify({
        dependencies: { react: '^18.0.0' }
      })
    );

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
