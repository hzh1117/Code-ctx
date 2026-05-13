const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../../templates');
const DEFAULT_SCENARIOS_PATH = path.join(TEMPLATES_DIR, 'scenarios.json');

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

function loadTemplate(name, language) {
  // Try language-specific template first
  if (language && language !== 'zh') {
    const ext = path.extname(name);
    const base = name.slice(0, -ext.length);
    const langName = `${base}.${language}${ext}`;
    const cacheKey = langName;

    if (templateCache.has(cacheKey)) {
      return templateCache.get(cacheKey);
    }

    const langPath = path.join(TEMPLATES_DIR, langName);
    if (fs.existsSync(langPath)) {
      const content = fs.readFileSync(langPath, 'utf8');
      templateCache.set(cacheKey, content);
      return content;
    }
  }

  // Fall back to default template
  if (templateCache.has(name)) {
    return templateCache.get(name);
  }

  const filePath = path.join(TEMPLATES_DIR, name);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    templateCache.set(name, content);
    return content;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Template not found: ${name}`);
    }
    throw err;
  }
}

function getScenarios(customPath, language) {
  // Try language-specific scenarios file
  if (language && language !== 'zh') {
    const basePath = customPath || DEFAULT_SCENARIOS_PATH;
    const ext = path.extname(basePath);
    const base = basePath.slice(0, -ext.length);
    const langPath = `${base}.${language}${ext}`;

    if (scenariosCache.has(langPath)) {
      return scenariosCache.get(langPath);
    }

    if (fs.existsSync(langPath)) {
      try {
        const content = fs.readFileSync(langPath, 'utf8');
        const scenarios = JSON.parse(content);
        scenariosCache.set(langPath, scenarios);
        return scenarios;
      } catch (err) {
        // Fall through to default
      }
    }
  }

  const scenariosPath = customPath || DEFAULT_SCENARIOS_PATH;

  if (scenariosCache.has(scenariosPath)) {
    return scenariosCache.get(scenariosPath);
  }

  try {
    const content = fs.readFileSync(scenariosPath, 'utf8');
    const scenarios = JSON.parse(content);
    scenariosCache.set(scenariosPath, scenarios);
    return scenarios;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Scenarios file not found: ${scenariosPath}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in scenarios file: ${scenariosPath}`);
    }
    throw err;
  }
}

function clearCache() {
  templateCache.clear();
  scenariosCache.clear();
}

module.exports = { renderTemplate, loadTemplate, getScenarios, clearCache };
