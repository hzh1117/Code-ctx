const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadProjectConfig } = require('../../utils/config');

const ALLOWED_KEYS = ['projectName', 'outputDir', 'aiMode', 'projects', 'excludeDirs', 'gitTrack', 'ai'];
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

function sanitizeConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('配置必须是一个对象');
  }

  const sanitized = {};
  for (const key of Object.keys(input)) {
    if (DANGEROUS_KEYS.includes(key)) {
      throw new Error(`不允许的配置键: ${key}`);
    }
    if (!ALLOWED_KEYS.includes(key)) {
      continue; // silently drop unknown keys
    }
    sanitized[key] = input[key];
  }
  return sanitized;
}

module.exports = function(rootDir) {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      const config = loadProjectConfig(rootDir);
      res.json(config);
    } catch (err) {
      console.error('Config load error:', err.message);
      res.status(500).json({ error: '配置加载失败' });
    }
  });

  router.put('/', (req, res) => {
    try {
      const configPath = path.join(rootDir, 'code-ctx.config.js');
      const sanitized = sanitizeConfig(req.body);

      // Backup before writing
      if (fs.existsSync(configPath)) {
        try {
          fs.copyFileSync(configPath, configPath + '.bak');
        } catch (backupErr) {
          console.warn('配置备份失败:', backupErr.message);
        }
      }

      fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(sanitized, null, 2)};\n`);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
