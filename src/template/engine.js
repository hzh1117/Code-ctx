const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../../templates');
const DEFAULT_SCENARIOS_PATH = path.join(TEMPLATES_DIR, 'scenarios.json');

// Caches store { mtimeMs, value } per file path so an external edit
// (e.g. saveAIConfig writes, dev-time template tweaks) invalidates the
// cache on the next call without needing an explicit clearCache.
const templateCache = new Map();
const scenariosCache = new Map();

function renderTemplate(template, variables) {
  if (typeof template !== 'string') {
    throw new TypeError('Template must be a string');
  }
  if (!variables || typeof variables !== 'object') {
    throw new TypeError('Variables must be an object');
  }
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

function statMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

function readCachedFile(cache, filePath) {
  const mtimeMs = statMtime(filePath);
  if (mtimeMs === null) return null;

  const cached = cache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.value;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  cache.set(filePath, { mtimeMs, value: content });
  return content;
}

function loadTemplate(name, language) {
  if (language && language !== 'zh') {
    const ext = path.extname(name);
    const base = name.slice(0, -ext.length);
    const langPath = path.join(TEMPLATES_DIR, `${base}.${language}${ext}`);
    const langContent = readCachedFile(templateCache, langPath);
    if (langContent !== null) return langContent;
  }

  const filePath = path.join(TEMPLATES_DIR, name);
  const content = readCachedFile(templateCache, filePath);
  if (content === null) {
    throw new Error(`Template not found: ${name}`);
  }
  return content;
}

function readCachedScenarios(filePath) {
  const mtimeMs = statMtime(filePath);
  if (mtimeMs === null) return null;

  const cached = scenariosCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.value;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const scenarios = JSON.parse(content);
    scenariosCache.set(filePath, { mtimeMs, value: scenarios });
    return scenarios;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in scenarios file: ${filePath}`);
    }
    throw err;
  }
}

function getScenarios(customPath, language) {
  if (language && language !== 'zh') {
    const basePath = customPath || DEFAULT_SCENARIOS_PATH;
    const ext = path.extname(basePath);
    const base = basePath.slice(0, -ext.length);
    const langPath = `${base}.${language}${ext}`;
    const langScenarios = readCachedScenarios(langPath);
    if (langScenarios !== null) return langScenarios;
  }

  const scenariosPath = customPath || DEFAULT_SCENARIOS_PATH;
  const scenarios = readCachedScenarios(scenariosPath);
  if (scenarios === null) {
    throw new Error(`Scenarios file not found: ${scenariosPath}`);
  }
  return scenarios;
}

function clearCache() {
  templateCache.clear();
  scenariosCache.clear();
}

module.exports = { renderTemplate, loadTemplate, getScenarios, clearCache };
