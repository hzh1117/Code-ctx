const express = require('express');
const { loadProjectConfig } = require('../../utils/config');

module.exports = function(rootDir) {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      const config = loadProjectConfig(rootDir);
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/', (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(rootDir, 'code-ctx.config.js');
      const newConfig = req.body;
      
      fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(newConfig, null, 2)};\n`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
