const { fixCommand } = require('../../src/commands/fix');
const fs = require('fs');
const path = require('path');

describe('fixCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/fix-test');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'ai-docs/web.md'), '# Old content');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  function createConfig(projectAlias, projectPath, projectType) {
    const config = {
      projectName: 'test-project',
      outputDir: './ai-docs',
      aiMode: 'clipboard',
      projects: [
        { alias: projectAlias, path: projectPath, type: projectType, label: projectAlias }
      ],
      excludeDirs: ['node_modules', '.git', 'dist', 'build', 'ai-docs'],
      gitTrack: true
    };
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.js'),
      `module.exports = ${JSON.stringify(config, null, 2)};\n`
    );
  }

  test('should regenerate project documentation', async () => {
    const webDir = path.join(testDir, 'web');
    fs.mkdirSync(path.join(webDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(webDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(webDir, 'src/index.js'), 'console.log("hello")');
    createConfig('web', './web', 'react');

    const result = await fixCommand(testDir, 'web', { dryRun: true });
    expect(result.project).toBe('web');
    expect(result.prompt).toContain('web');
  });

  test('should throw when config file does not exist', async () => {
    await expect(fixCommand(testDir, 'web', { dryRun: true }))
      .rejects.toThrow('配置文件不存在');
  });

  test('should throw when project alias not found', async () => {
    createConfig('web', './web', 'react');

    await expect(fixCommand(testDir, 'unknown', { dryRun: true }))
      .rejects.toThrow('未找到项目');
  });

  test('should write doc file when not dryRun', async () => {
    const webDir = path.join(testDir, 'web');
    fs.mkdirSync(path.join(webDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(webDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(webDir, 'src/index.js'), 'console.log("hello")');
    createConfig('web', './web', 'react');

    await fixCommand(testDir, 'web', { dryRun: false });

    const docPath = path.join(testDir, 'ai-docs', 'web.md');
    expect(fs.existsSync(docPath)).toBe(true);
    const content = fs.readFileSync(docPath, 'utf8');
    expect(content).toContain('web');
  });

  test('should return prompt with project structure', async () => {
    const webDir = path.join(testDir, 'web');
    fs.mkdirSync(path.join(webDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(webDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(webDir, 'src/index.js'), 'console.log("hello")');
    createConfig('web', './web', 'react');

    const result = await fixCommand(testDir, 'web', { dryRun: true });
    expect(result.prompt).toContain('项目结构');
    expect(result.prompt).toContain('关键文件');
  });
});
