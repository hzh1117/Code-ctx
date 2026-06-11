const fs = require('fs');
const path = require('path');

// Directories to skip when walking the tree for mtime checks.
const FRESHNESS_DIR_IGNORES = new Set(['node_modules', '.git', 'dist', 'build', 'ai-docs', 'coverage']);
const FRESHNESS_MAX_DEPTH = 8;

/**
 * Walk a directory tree and return the most recent mtimeMs among all files.
 * Skips common build/VCS directories, dot-directories, and symlinks.
 *
 * @param {string} dirPath - Absolute path to the directory to walk.
 * @param {number} [deadline] - Optional timestamp (Date.now()-based) after
 *   which the walk aborts and returns 0. Keeps doctor/init responsive on
 *   large trees.
 * @param {number} [depth=0] - Current recursion depth (internal).
 * @returns {number} The latest mtimeMs found, or 0 if nothing was stat-able.
 */
function getLatestMtime(dirPath, deadline, depth = 0) {
  if (depth > FRESHNESS_MAX_DEPTH) return 0;
  if (deadline && Date.now() > deadline) return 0;
  let latest = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      // Skip symlinks to prevent infinite loops from symlink cycles
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (FRESHNESS_DIR_IGNORES.has(entry.name) || entry.name.startsWith('.')) continue;
        const subMtime = getLatestMtime(fullPath, deadline, depth + 1);
        if (subMtime > latest) latest = subMtime;
      } else {
        try {
          const stats = fs.statSync(fullPath);
          if (stats.mtimeMs > latest) latest = stats.mtimeMs;
        } catch {
          // ignore stat errors (e.g. broken files)
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'EACCES') {
      console.error('getLatestMtime error:', err.message);
    }
  }
  return latest;
}

module.exports = { getLatestMtime, FRESHNESS_DIR_IGNORES, FRESHNESS_MAX_DEPTH };
