const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadProjectConfig } = require('../../utils/config');

module.exports = function(rootDir) {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      const config = loadProjectConfig(rootDir);
      const projects = config.projects || {};
      
      const projectList = Object.entries(projects).map(([alias, proj]) => ({
        alias,
        name: proj.name || alias,
        path: proj.path,
        type: proj.type || 'unknown'
      }));
      
      res.json(projectList);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
