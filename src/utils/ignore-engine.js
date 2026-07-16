const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const { loadProjectConfig } = require('./config');

const DEFAULT_EXCLUDES = Object.freeze([
  'node_modules', '.git', 'dist', 'build', 'ai-docs', 'coverage',
  '.next', '.nuxt', '.output', '.cache', '.temp', '.tmp', 'tmp',
  '__pycache__', '.tox', '.venv', 'venv', 'vendor'
]);
const DEFAULT_FILES = Object.freeze(['code-ctx.config.json', 'code-ctx.config.js']);

function directoryPattern(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized) return null;
  return /[*?![\]]/.test(normalized) || normalized.endsWith('/')
    ? normalized
    : `${normalized}/`;
}

function createIgnoreEngine(rootDir, options = {}) {
  const resolvedRoot = path.resolve(rootDir);
  let config = {};
  if (!options.excludeDirs) {
    try {
      config = loadProjectConfig(resolvedRoot);
    } catch {
      config = {};
    }
  }
  const excludeDirs = options.excludeDirs || config.excludeDirs || [];
  const matcher = ignore();
  matcher.add(DEFAULT_EXCLUDES.map(directoryPattern).filter(Boolean));
  matcher.add(DEFAULT_FILES);
  matcher.add(excludeDirs.map(directoryPattern).filter(Boolean));

  const gitignorePath = path.join(resolvedRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) matcher.add(fs.readFileSync(gitignorePath, 'utf8'));
  if (Array.isArray(options.patterns)) matcher.add(options.patterns);

  function relativePath(filePath) {
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(resolvedRoot, filePath);
    return path.relative(resolvedRoot, absolute).replace(/\\/g, '/').replace(/^\.\//, '');
  }

  const engine = {
    rootDir: resolvedRoot,
    ignores(filePath) {
      const relative = relativePath(filePath);
      if (!relative || relative.startsWith('../')) return false;
      return matcher.ignores(relative) || matcher.ignores(`${relative}/`);
    },
    filter(filePaths) {
      return filePaths.filter(filePath => !engine.ignores(filePath));
    }
  };
  return Object.freeze(engine);
}

module.exports = { createIgnoreEngine, DEFAULT_EXCLUDES, DEFAULT_FILES };
