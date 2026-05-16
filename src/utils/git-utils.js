const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { STATE_FILES } = require('./constants');

function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function hasGitRepo(rootDir) {
  const output = runGit(['rev-parse', '--is-inside-work-tree'], rootDir);
  return output !== null;
}

function getCurrentCommitHash(rootDir) {
  return runGit(['rev-parse', 'HEAD'], rootDir);
}

function isValidCommitHash(hash) {
  return /^[0-9a-f]{7,40}$/i.test(hash);
}

function getChangedFilesSince(rootDir, sinceCommit) {
  if (!isValidCommitHash(sinceCommit)) return null;
  const output = runGit(['diff', '--name-only', `${sinceCommit}..HEAD`], rootDir);
  if (output === null) return null;
  if (!output) return [];
  return output.split('\n').filter(Boolean);
}

function getChangedFilesWorkingTree(rootDir) {
  const output = runGit(['diff', '--name-only', 'HEAD'], rootDir);
  if (output === null) return null;
  if (!output) return [];
  return output.split('\n').filter(Boolean);
}

function getUntrackedFiles(rootDir) {
  const output = runGit(['ls-files', '--others', '--exclude-standard'], rootDir);
  if (output === null) return [];
  if (!output) return [];
  return output.split('\n').filter(Boolean);
}

function getLastScanCommit(rootDir) {
  const lastScanPath = path.join(rootDir, 'ai-docs', STATE_FILES.LAST_SCAN);
  if (!fs.existsSync(lastScanPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
    return data.lastCommitHash || null;
  } catch {
    return null;
  }
}

module.exports = {
  hasGitRepo,
  getCurrentCommitHash,
  getChangedFilesSince,
  getChangedFilesWorkingTree,
  getUntrackedFiles,
  getLastScanCommit,
  isValidCommitHash
};
