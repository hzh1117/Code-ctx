const express = require('express');
const fs = require('fs');
const path = require('path');
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
      const configPath = path.join(rootDir, 'code-ctx.config.js');
      const newConfig = req.body;

      if (!newConfig || typeof newConfig !== 'object') {
        return res.status(400).json({ error: '配置必须是一个对象' });
      }

      // Backup before writing
      if (fs.existsSync(configPath)) {
        try {
          fs.copyFileSync(configPath, configPath + '.bak');
        } catch (backupErr) {
          console.warn('配置备份失败:', backupErr.message);
        }
      }

      fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(newConfig, null, 2)};\n`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
