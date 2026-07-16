const fs = require('fs');
const os = require('os');
const path = require('path');

describe('config validate CLI', () => {
  let rootDir;
  let originalExitCode;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-ctx-config-cli-'));
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('reports a valid configuration', async () => {
    fs.writeFileSync(path.join(rootDir, 'code-ctx.config.json'), JSON.stringify({
      projectName: 'valid',
      projects: [{ alias: 'app', path: '.', type: 'unknown' }]
    }));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const command = require('../../bin/commands/config');

    await command.parseAsync(['node', 'config', 'validate', rootDir]);

    expect(process.exitCode).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('配置有效'));
  });

  test('sets a non-zero exit code for blocking errors', async () => {
    fs.writeFileSync(path.join(rootDir, 'code-ctx.config.json'), JSON.stringify({
      projectName: 42,
      projects: 'invalid'
    }));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const command = require('../../bin/commands/config');

    await command.parseAsync(['node', 'config', 'validate', rootDir]);

    expect(process.exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('projectName'));
  });

  test('migrates a static JS config and retains a backup', async () => {
    fs.writeFileSync(path.join(rootDir, 'code-ctx.config.js'), [
      'module.exports = {',
      "  projectName: 'legacy',",
      "  projects: [{ alias: 'app', path: '.', type: 'unknown' }]",
      '};'
    ].join('\n'));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const command = require('../../bin/commands/config');

    await command.parseAsync(['node', 'config', 'migrate', rootDir]);

    const migrated = JSON.parse(fs.readFileSync(
      path.join(rootDir, 'code-ctx.config.json'),
      'utf8'
    ));
    expect(migrated.projectName).toBe('legacy');
    expect(fs.existsSync(path.join(rootDir, 'code-ctx.config.js'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'code-ctx.config.js.bak'))).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('迁移完成'));
  });

  test('migration rejects dynamic JS without executing it', async () => {
    const marker = path.join(rootDir, 'executed.txt').replace(/\\/g, '/');
    fs.writeFileSync(
      path.join(rootDir, 'code-ctx.config.js'),
      `require('fs').writeFileSync('${marker}', 'bad'); module.exports = {};`
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const command = require('../../bin/commands/config');

    await command.parseAsync(['node', 'config', 'migrate', rootDir]);

    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(marker)).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'code-ctx.config.json'))).toBe(false);
  });
});
