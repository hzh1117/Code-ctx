const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadProjectConfig } = require('../../utils/config');
const { filterSensitive } = require('../../utils/sensitive-filter');

module.exports = function(rootDir) {
  const router = express.Router();

  router.get('/scenarios', (req, res) => {
    try {
      const config = loadProjectConfig(rootDir);
      const scenarios = config.scenarios || {};
      
      const scenarioList = Object.entries(scenarios).map(([key, scenario]) => ({
        key,
        name: scenario.name || key,
        description: scenario.description || '',
        template: scenario.template || ''
      }));
      
      res.json(scenarioList);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/status', (req, res) => {
    try {
      const aiDocsDir = path.join(rootDir, 'ai-docs');
      const result = {
        exists: fs.existsSync(aiDocsDir),
        documents: []
      };
      
      if (result.exists) {
        const files = fs.readdirSync(aiDocsDir);
        result.documents = files.map(file => {
          const filePath = path.join(aiDocsDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            lastModified: stats.mtime.toISOString()
          };
        });
      }
      
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/generate-prompt', (req, res) => {
    try {
      const { task, scenario } = req.body;
      const safeTask = filterSensitive(task || '').content;
      const config = loadProjectConfig(rootDir);
      
      res.json({ 
        success: true, 
        prompt: `任务: ${safeTask}\n场景: ${scenario || '默认'}` 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
