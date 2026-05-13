const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { STATE_FILES } = require('./constants');

function hasGitRepo(rootDir) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: rootDir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getCurrentCommitHash(rootDir) {
  try {
    return execSync('git rev-parse HEAD', { cwd: rootDir, stdio: 'pipe' }).toString().trim();
  } catch {
    return null;
  }
}

function isValidCommitHash(hash) {
  return /^[0-9a-f]{7,40}$/i.test(hash);
}

function getChangedFilesSince(rootDir, sinceCommit) {
  if (!isValidCommitHash(sinceCommit)) return null;
  try {
    const output = execSync(`git diff --name-only ${sinceCommit}..HEAD`, {
      cwd: rootDir,
      stdio: 'pipe'
    }).toString().trim();
    if (!output) return [];
    return output.split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

function getChangedFilesWorkingTree(rootDir) {
  try {
    const output = execSync('git diff --name-only HEAD', {
      cwd: rootDir,
      stdio: 'pipe'
    }).toString().trim();
    if (!output) return [];
    return output.split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

function getUntrackedFiles(rootDir) {
  try {
    const output = execSync('git ls-files --others --exclude-standard', {
      cwd: rootDir,
      stdio: 'pipe'
    }).toString().trim();
    if (!output) return [];
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
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
