const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { updateCommand } = require('../../src/commands/update');

function git(rootDir, ...args) {
  const result = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

describe('updateCommand git evidence', () => {
  let rootDir;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-git-evidence-'));
    fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(rootDir, 'ai-docs'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'src/app.js'), 'const route = "/old";\n');
    fs.writeFileSync(path.join(rootDir, 'ai-docs/web.md'), [
      '# src application',
      '<!-- section:api -->',
      'old route docs',
      '<!-- /section:api -->'
    ].join('\n'));
    fs.writeFileSync(path.join(rootDir, '.gitignore'), 'ai-docs/.last-scan.json\n');

    git(rootDir, 'init');
    git(rootDir, 'config', 'user.email', 'tests@example.com');
    git(rootDir, 'config', 'user.name', 'Code Ctx Tests');
    git(rootDir, 'add', '.');
    git(rootDir, 'commit', '-m', 'baseline');

    const baseline = git(rootDir, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(rootDir, 'ai-docs/.last-scan.json'), JSON.stringify({
      lastCommitHash: baseline,
      files: {}
    }));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('includes a bounded patch for worktree changes after the scan baseline', async () => {
    fs.writeFileSync(path.join(rootDir, 'src/app.js'), 'const route = "/new";\n');

    const result = await updateCommand(rootDir, { dryRun: true });
    const appChange = result.changes.find(change => change.path === 'src/app.js');

    expect(result.detectionMethod).toBe('git-diff');
    expect(appChange).toEqual(expect.objectContaining({
      status: 'modified',
      evidenceType: 'patch'
    }));
    expect(appChange.evidence).toContain('diff --git a/src/app.js b/src/app.js');
    expect(appChange.evidence).toContain('-const route = "/old";');
    expect(appChange.evidence).toContain('+const route = "/new";');
    expect(result.sectionUpdates[0].prompt).toContain('change-evidence chunk');
    expect(result.sectionUpdates[0].prompt).toContain('+const route = "/new";');
  });
});
