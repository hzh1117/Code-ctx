const path = require('path');

jest.mock('child_process', () => ({
  spawnSync: jest.fn()
}));

const { spawnSync } = require('child_process');
const {
  hasGitRepo,
  getCurrentCommitHash,
  getChangedFilesSince,
  getChangedFilesWorkingTree,
  getUntrackedFiles,
  isValidCommitHash
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
});
