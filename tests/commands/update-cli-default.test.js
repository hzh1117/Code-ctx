const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('update CLI default mode', () => {
  let rootDir;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-cli-default-'));
    fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(rootDir, 'ai-docs'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'src/app.js'), 'export const cliEvidence = true;');
    fs.writeFileSync(path.join(rootDir, 'ai-docs/src.md'), [
      '# src project',
      '<!-- section:overview -->',
      'old overview',
      '<!-- /section:overview -->',
      '<!-- section:modules -->',
      'old modules',
      '<!-- /section:modules -->'
    ].join('\n'));
    fs.writeFileSync(path.join(rootDir, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'src', path: './src', type: 'generic-js-ts' }]
    }));
    fs.writeFileSync(path.join(rootDir, 'ai-docs/project-manifest.json'), JSON.stringify({
      projects: [{ id: 'src', sourcePath: './src', document: 'src.md' }]
    }));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('prints a merged prompt without committing update state', () => {
    const cliPath = path.join(__dirname, '../../bin/cli.js');
    const result = spawnSync(process.execPath, [cliPath, 'update', '--stdout'], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('## 文档: src.md');
    expect(result.stdout).toContain('<!-- section:overview -->');
    expect(result.stdout).toContain('<!-- section:modules -->');
    expect(result.stdout).toContain('export const cliEvidence = true;');
    expect(fs.existsSync(path.join(rootDir, 'ai-docs/.last-scan.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'ai-docs/.update-state.json'))).toBe(false);
  });

  test('rejects --dry-run with --apply without side effects', () => {
    const cliPath = path.join(__dirname, '../../bin/cli.js');
    const docPath = path.join(rootDir, 'ai-docs/src.md');
    const originalDoc = fs.readFileSync(docPath, 'utf8');
    const result = spawnSync(process.execPath, [cliPath, 'update', '--dry-run', '--apply'], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/cannot be used with option|不能同时使用/i);
    expect(fs.readFileSync(docPath, 'utf8')).toBe(originalDoc);
    expect(fs.existsSync(path.join(rootDir, 'ai-docs/.last-scan.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'ai-docs/.update-state.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'ai-docs/.task-history.jsonl'))).toBe(false);
  });

  test('apply without an API key emits a non-empty manual prompt without state loss', () => {
    const cliPath = path.join(__dirname, '../../bin/cli.js');
    const result = spawnSync(process.execPath, [cliPath, 'update', '--apply', '--stdout'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
        ANTHROPIC_AUTH_TOKEN: ''
      }
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('未配置 API Key');
    expect(result.stdout).toContain('## 文档: src.md');
    expect(result.stdout).toContain('export const cliEvidence = true;');
    expect(fs.existsSync(path.join(rootDir, 'ai-docs/.last-scan.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'ai-docs/.update-state.json'))).toBe(false);
  });
});
