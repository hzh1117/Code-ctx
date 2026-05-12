const fs = require('fs');
const path = require('path');

const DEFAULT_SCENARIOS_PATH = path.join(__dirname, '../../templates/scenarios.json');

function renderTemplate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

function getScenarios(customPath) {
  const scenariosPath = customPath || DEFAULT_SCENARIOS_PATH;
  const content = fs.readFileSync(scenariosPath, 'utf8');
  return JSON.parse(content);
}

module.exports = { renderTemplate, getScenarios };
