const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadProjectConfig } = require('../../utils/config');

module.exports = function(rootDir) {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      const config = loadProjectConfig(rootDir);
      const rawProjects = config.projects || [];
      const aiDocsDir = path.join(rootDir, 'ai-docs');
      const initState = loadInitState(aiDocsDir);
      const projectList = Array.isArray(rawProjects)
        ? rawProjects.map(proj => normalizeProject(proj, proj.alias, aiDocsDir, initState))
        : Object.entries(rawProjects).map(([alias, proj]) => normalizeProject(proj, alias, aiDocsDir, initState));

      res.json(projectList);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

function normalizeProject(proj, alias, aiDocsDir, initState) {
  const projectAlias = proj.alias || alias;
  const status = initState.projects?.[projectAlias]?.status;
  return {
    alias: projectAlias,
    name: proj.name || proj.label || projectAlias,
    path: proj.path,
    type: proj.type || 'unknown',
    label: proj.label || proj.name || projectAlias,
    initialized: ['done', 'completed'].includes(status),
    docFile: fs.existsSync(path.join(aiDocsDir, `${projectAlias}.md`))
  };
}

function loadInitState(aiDocsDir) {
  const statePath = path.join(aiDocsDir, '.init-state.json');
  if (!fs.existsSync(statePath)) {
    return { projects: {} };
  }

  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return { projects: {} };
  }
}
