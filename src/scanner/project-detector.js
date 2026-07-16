const fs = require('fs');
const path = require('path');
const { readFileUTF8 } = require('../utils/file-reader');
const { defaultRegistry } = require('../adapters');

// Directories that are never project roots and should not be recursed into.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'ai-docs',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  '.cache',
  '.temp',
  '.tmp',
  'tmp',
  '__pycache__',
  '.tox',
  '.venv',
  'venv',
  'vendor'
]);

// Maximum depth for recursive monorepo scanning. Prevents crawling into
// deeply nested vendor/internal directories while still catching
// packages/app1/ or apps/web/ patterns.
const MAX_SCAN_DEPTH = 3;

function generateAlias(name) {
  const alias = name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
  return alias || 'root';
}

function createProject(dirPath, type, name) {
  return {
    alias: generateAlias(name),
    path: path.resolve(dirPath),
    type,
    name
  };
}

function deduplicateAliases(projects) {
  const seen = new Map();
  for (const project of projects) {
    let alias = project.alias;
    if (seen.has(alias)) {
      const counter = seen.get(alias) + 1;
      seen.set(alias, counter);
      // Append numeric suffix, keeping total length reasonable
      const suffix = String(counter);
      alias = alias.substring(0, 20 - suffix.length - 1) + '-' + suffix;
      project.alias = alias;
    } else {
      seen.set(alias, 1);
    }
  }
}

/**
 * Check if a directory contains a detectable project.
 * Returns the detected type or null.
 */
function detectProjectInDir(dirPath, registry = defaultRegistry) {
  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch {
    return null;
  }

  let pkg = {};
  if (files.includes('package.json')) {
    const pkgPath = path.join(dirPath, 'package.json');
    try {
      pkg = JSON.parse(readFileUTF8(pkgPath));
    } catch {
      // ignore parse errors
    }
  }

  return registry.detect(pkg, files);
}

/**
 * Detect projects with one bounded depth-first traversal:
 *   - Detect the root independently so root projects and children can coexist.
 *   - Visit each directory once and recurse through non-project directories up
 *     to MAX_SCAN_DEPTH.
 *
 * @param {string} rootDir
 * @param {object} [options]
 * @param {number} [options.maxDepth] - Override MAX_SCAN_DEPTH
 * @returns {Array<{alias: string, path: string, type: string, name: string}>}
 */
function detectProjects(rootDir, options = {}) {
  const maxDepth = options.maxDepth ?? MAX_SCAN_DEPTH;
  const registry = options.registry || defaultRegistry;
  const ignoreEngine = options.ignoreEngine || null;
  const projects = [];
  const visited = new Set();

  const resolvedRoot = path.resolve(rootDir);
  const rootType = detectProjectInDir(resolvedRoot, registry);
  if (rootType) {
    projects.push(createProject(resolvedRoot, rootType, path.basename(resolvedRoot)));
  }

  function scanDir(dirPath, depth, prefix) {
    if (depth > maxDepth) return;
    const realPath = path.resolve(dirPath);
    if (visited.has(realPath)) return;
    visited.add(realPath);

    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

      const projectDir = path.join(dirPath, entry.name);
      if (ignoreEngine?.ignores(projectDir)) continue;
      const type = detectProjectInDir(projectDir, registry);

      if (type) {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        projects.push(createProject(projectDir, type, name));
      } else if (depth < maxDepth) {
        // Recurse into non-project subdirectories that might contain
        // monorepo packages (e.g. packages/app1/, apps/web/).
        scanDir(projectDir, depth + 1, prefix ? `${prefix}/${entry.name}` : entry.name);
      }
    }
  }

  // This is the only traversal pass. The unknown fallback below must not rescan.
  scanDir(rootDir, 0, '');

  if (projects.length === 0) {
    projects.push(createProject(resolvedRoot, 'unknown', path.basename(resolvedRoot)));
  }

  deduplicateAliases(projects);
  return projects;
}

module.exports = { detectProjects, SKIP_DIRS, MAX_SCAN_DEPTH };
