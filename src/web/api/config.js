const express = require('express');
const { loadProjectConfig, saveProjectConfig, validateProjectConfig } = require('../../utils/config');

const ALLOWED_KEYS = ['projectName', 'outputDir', 'aiMode', 'projects', 'excludeDirs', 'gitTrack', 'ai', 'plugins'];
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
      const sanitized = sanitizeConfig(req.body);

      const errors = validateProjectConfig(sanitized);
      if (errors.length > 0) {
        return res.status(400).json({ error: `配置 schema 校验失败: ${errors.join('; ')}` });
      }

      const written = saveProjectConfig(rootDir, sanitized);
      res.json({ success: true, format: written.format });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
