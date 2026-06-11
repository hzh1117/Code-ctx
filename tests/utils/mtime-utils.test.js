const fs = require('fs');
const path = require('path');
const os = require('os');
const { getLatestMtime, FRESHNESS_DIR_IGNORES, FRESHNESS_MAX_DEPTH } = require('../../src/utils/mtime-utils');

describe('mtime-utils', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codectx-mtime-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('returns 0 for empty directory', () => {
    expect(getLatestMtime(testDir)).toBe(0);
  });

  test('returns mtime of a single file', () => {
    const filePath = path.join(testDir, 'a.txt');
    fs.writeFileSync(filePath, 'hello');
    const mtime = getLatestMtime(testDir);
    expect(mtime).toBeGreaterThan(0);
  });

  test('returns the latest mtime among multiple files', () => {
    const a = path.join(testDir, 'a.txt');
    const b = path.join(testDir, 'b.txt');
    fs.writeFileSync(a, 'first');
    // Small delay to ensure different mtime
    const now = Date.now();
    fs.utimesSync(a, new Date(now - 10000), new Date(now - 10000));
    fs.writeFileSync(b, 'second');

    const mtime = getLatestMtime(testDir);
    const statB = fs.statSync(b);
    expect(mtime).toBe(statB.mtimeMs);
  });

  test('recurses into subdirectories', () => {
    const subDir = path.join(testDir, 'sub');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'deep.txt'), 'deep content');

    expect(getLatestMtime(testDir)).toBeGreaterThan(0);
  });

  test('skips node_modules directory', () => {
    const nmDir = path.join(testDir, 'node_modules');
    fs.mkdirSync(nmDir);
    fs.writeFileSync(path.join(nmDir, 'pkg.js'), 'content');

    // Only the node_modules file exists — should be skipped
    expect(getLatestMtime(testDir)).toBe(0);
  });

  test('skips dot-directories', () => {
    const dotDir = path.join(testDir, '.git');
    fs.mkdirSync(dotDir);
    fs.writeFileSync(path.join(dotDir, 'HEAD'), 'ref: refs/heads/main');

    expect(getLatestMtime(testDir)).toBe(0);
  });

  test('skips all directories in FRESHNESS_DIR_IGNORES', () => {
    for (const dirName of FRESHNESS_DIR_IGNORES) {
      const dir = path.join(testDir, dirName);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'file.txt'), 'content');
    }
    // All files are in ignored dirs
    expect(getLatestMtime(testDir)).toBe(0);

    // Add a non-ignored file
    fs.writeFileSync(path.join(testDir, 'real.txt'), 'content');
    expect(getLatestMtime(testDir)).toBeGreaterThan(0);
  });

  test('respects deadline parameter', () => {
    fs.writeFileSync(path.join(testDir, 'a.txt'), 'content');
    // Deadline in the past — should return 0
    expect(getLatestMtime(testDir, Date.now() - 1000)).toBe(0);
  });

  test('returns 0 for non-existent directory', () => {
    expect(getLatestMtime('/non/existent/path')).toBe(0);
  });

  test('handles symlinks by skipping them', () => {
    const filePath = path.join(testDir, 'real.txt');
    fs.writeFileSync(filePath, 'content');
    try {
      fs.symlinkSync(filePath, path.join(testDir, 'link.txt'));
    } catch {
      // symlinks may fail on some Windows configs — skip
      return;
    }
    // Should not throw or double-count
    const mtime = getLatestMtime(testDir);
    expect(mtime).toBeGreaterThan(0);
  });

  test('FRESHNESS_MAX_DEPTH is exported and positive', () => {
    expect(typeof FRESHNESS_MAX_DEPTH).toBe('number');
    expect(FRESHNESS_MAX_DEPTH).toBeGreaterThan(0);
  });
});
