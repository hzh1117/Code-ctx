const path = require('path');
const fs = require('fs');

jest.mock('child_process', () => ({
  spawnSync: jest.fn()
}));

const { spawnSync } = require('child_process');
const {
  hasGitRepo,
  getCurrentCommitHash,
  getChangedFilesSince,
  getChangedFilesWorkingTree,
  getChangedFilesAgainst,
  getFileDiff,
  getUntrackedFiles,
  isValidCommitHash,
  getLastScanCommit
} = require('../../src/utils/git-utils');

describe('git-utils', () => {
  const testDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidCommitHash', () => {
    test('accepts valid 7-char hash', () => {
      expect(isValidCommitHash('abc1234')).toBe(true);
    });

    test('accepts valid 40-char hash', () => {
      expect(isValidCommitHash('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')).toBe(true);
    });

    test('accepts mixed case hash', () => {
      expect(isValidCommitHash('AbC1234')).toBe(true);
    });

    test('rejects hash with special chars', () => {
      expect(isValidCommitHash('abc1234; rm -rf /')).toBe(false);
    });

    test('rejects hash that is too short', () => {
      expect(isValidCommitHash('abc123')).toBe(false);
    });

    test('rejects hash with spaces', () => {
      expect(isValidCommitHash('abc 1234')).toBe(false);
    });
  });

  describe('hasGitRepo', () => {
    test('returns true when git rev-parse succeeds', () => {
      spawnSync.mockReturnValue({ stdout: 'true\n', status: 0, error: null });
      expect(hasGitRepo(testDir)).toBe(true);
      expect(spawnSync).toHaveBeenCalledWith('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: testDir,
        stdio: 'pipe',
        encoding: 'utf8'
      });
    });

    test('returns false when git command fails', () => {
      spawnSync.mockReturnValue({ stdout: '', status: 128, error: null });
      expect(hasGitRepo(testDir)).toBe(false);
    });

    test('returns false when git is not found', () => {
      spawnSync.mockReturnValue({ stdout: '', status: null, error: new Error('ENOENT') });
      expect(hasGitRepo(testDir)).toBe(false);
    });
  });

  describe('getCurrentCommitHash', () => {
    test('returns trimmed commit hash', () => {
      const hash = 'abc1234567890abcdef1234567890abcdef123456';
      spawnSync.mockReturnValue({ stdout: hash + '\n', status: 0, error: null });
      expect(getCurrentCommitHash(testDir)).toBe(hash);
      expect(spawnSync).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD'], {
        cwd: testDir,
        stdio: 'pipe',
        encoding: 'utf8'
      });
    });

    test('returns null when git command fails', () => {
      spawnSync.mockReturnValue({ stdout: '', status: 128, error: null });
      expect(getCurrentCommitHash(testDir)).toBeNull();
    });
  });

  describe('getChangedFilesSince', () => {
    test('returns changed files for valid commit hash', () => {
      const sinceCommit = 'abc1234';
      spawnSync.mockReturnValue({ stdout: 'file1.js\nfile2.js\n', status: 0, error: null });
      const result = getChangedFilesSince(testDir, sinceCommit);
      expect(result).toEqual(['file1.js', 'file2.js']);
      expect(spawnSync).toHaveBeenCalledWith('git', ['diff', '--name-only', 'abc1234..HEAD'], {
        cwd: testDir,
        stdio: 'pipe',
        encoding: 'utf8'
      });
    });

    test('returns empty array when no changes', () => {
      spawnSync.mockReturnValue({ stdout: '', status: 0, error: null });
      expect(getChangedFilesSince(testDir, 'abc1234')).toEqual([]);
    });

    test('returns null for invalid commit hash', () => {
      expect(getChangedFilesSince(testDir, 'invalid; rm -rf /')).toBeNull();
      expect(spawnSync).not.toHaveBeenCalled();
    });

    test('returns null when git command fails', () => {
      spawnSync.mockReturnValue({ stdout: '', status: 128, error: null });
      expect(getChangedFilesSince(testDir, 'abc1234')).toBeNull();
    });
  });

  describe('getChangedFilesWorkingTree', () => {
    test('returns changed files in working tree', () => {
      spawnSync.mockReturnValue({ stdout: 'modified.js\n', status: 0, error: null });
      const result = getChangedFilesWorkingTree(testDir);
      expect(result).toEqual(['modified.js']);
      expect(spawnSync).toHaveBeenCalledWith('git', ['diff', '--name-only', 'HEAD'], {
        cwd: testDir,
        stdio: 'pipe',
        encoding: 'utf8'
      });
    });

    test('returns null when git command fails', () => {
      spawnSync.mockReturnValue({ stdout: '', status: 128, error: null });
      expect(getChangedFilesWorkingTree(testDir)).toBeNull();
    });
  });

  describe('getChangedFilesAgainst', () => {
    test('compares a valid baseline against the current worktree', () => {
      spawnSync.mockReturnValue({ stdout: 'src/app.js\n', status: 0, error: null });
      expect(getChangedFilesAgainst(testDir, 'abc1234')).toEqual(['src/app.js']);
      expect(spawnSync).toHaveBeenCalledWith('git', ['diff', '--name-only', 'abc1234'], {
        cwd: testDir,
        stdio: 'pipe',
        encoding: 'utf8'
      });
    });

    test('rejects an invalid baseline', () => {
      expect(getChangedFilesAgainst(testDir, 'HEAD;bad')).toBeNull();
      expect(spawnSync).not.toHaveBeenCalled();
    });
  });

  describe('getFileDiff', () => {
    test('returns a per-file patch using an argument-safe path', () => {
      spawnSync.mockReturnValue({ stdout: 'diff --git a/src/app.js b/src/app.js\n', status: 0, error: null });
      expect(getFileDiff(testDir, 'HEAD', 'src/app.js')).toContain('diff --git');
      expect(spawnSync).toHaveBeenCalledWith(
        'git',
        ['diff', '--no-ext-diff', '--unified=3', 'HEAD', '--', 'src/app.js'],
        { cwd: testDir, stdio: 'pipe', encoding: 'utf8' }
      );
    });

    test('rejects paths containing a null byte', () => {
      expect(getFileDiff(testDir, 'HEAD', 'src/bad\0.js')).toBeNull();
      expect(spawnSync).not.toHaveBeenCalled();
    });
  });

  describe('getUntrackedFiles', () => {
    test('returns untracked files', () => {
      spawnSync.mockReturnValue({ stdout: 'new-file.js\nanother.ts\n', status: 0, error: null });
      const result = getUntrackedFiles(testDir);
      expect(result).toEqual(['new-file.js', 'another.ts']);
      expect(spawnSync).toHaveBeenCalledWith('git', ['ls-files', '--others', '--exclude-standard'], {
        cwd: testDir,
        stdio: 'pipe',
        encoding: 'utf8'
      });
    });

    test('returns empty array when git command fails', () => {
      spawnSync.mockReturnValue({ stdout: '', status: 128, error: null });
      expect(getUntrackedFiles(testDir)).toEqual([]);
    });

    test('returns empty array when no untracked files', () => {
      spawnSync.mockReturnValue({ stdout: '', status: 0, error: null });
      expect(getUntrackedFiles(testDir)).toEqual([]);
    });
  });

  describe('getLastScanCommit', () => {
    const scanDir = path.join(__dirname, '../fixtures/git-scan-test');

    beforeEach(() => {
      fs.mkdirSync(path.join(scanDir, 'ai-docs'), { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(scanDir, { recursive: true, force: true });
    });

    test('returns lastCommitHash from .last-scan.json', () => {
      const hash = 'abc1234567890abcdef1234567890abcdef123456';
      fs.writeFileSync(
        path.join(scanDir, 'ai-docs', '.last-scan.json'),
        JSON.stringify({ lastCommitHash: hash, timestamp: '2026-01-01' })
      );
      expect(getLastScanCommit(scanDir)).toBe(hash);
    });

    test('returns null when .last-scan.json does not exist', () => {
      expect(getLastScanCommit(scanDir)).toBeNull();
    });

    test('returns null when .last-scan.json has no lastCommitHash', () => {
      fs.writeFileSync(path.join(scanDir, 'ai-docs', '.last-scan.json'), JSON.stringify({ timestamp: '2026-01-01' }));
      expect(getLastScanCommit(scanDir)).toBeNull();
    });

    test('returns null when .last-scan.json is invalid JSON', () => {
      fs.writeFileSync(path.join(scanDir, 'ai-docs', '.last-scan.json'), 'not valid json{{{');
      expect(getLastScanCommit(scanDir)).toBeNull();
    });
  });
});
