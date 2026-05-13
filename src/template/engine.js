const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../../templates');
const DEFAULT_SCENARIOS_PATH = path.join(TEMPLATES_DIR, 'scenarios.json');

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

function loadTemplate(name) {
  const filePath = path.join(TEMPLATES_DIR, name);
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Template not found: ${name}`);
    }
    throw err;
  }
}

function getScenarios(customPath) {
  const scenariosPath = customPath || DEFAULT_SCENARIOS_PATH;
  try {
    const content = fs.readFileSync(scenariosPath, 'utf8');
    return JSON.parse(content);
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

module.exports = { renderTemplate, loadTemplate, getScenarios };
