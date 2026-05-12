const express = require('express');
const { getAIConfig } = require('../../utils/config');
const { generateWithAI } = require('../../ai/client');

module.exports = function(rootDir) {
  const router = express.Router();

  router.get('/config', (req, res) => {
    try {
      const config = getAIConfig(rootDir);
      res.json({
        protocol: config.protocol,
        baseUrl: config.baseUrl,
        model: config.model,
        maxTokens: config.maxTokens,
        hasApiKey: !!config.apiKey
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/test', async (req, res) => {
    try {
      const config = getAIConfig(rootDir);
      const result = await generateWithAI('回复"连接成功"', {
        ...config,
        maxTokens: 100
      });
      res.json({ success: true, response: result });
    } catch (err) {
      res.json({ success: false, error: err.message });
    }
  });

  router.post('/generate', async (req, res) => {
    try {
      const { prompt } = req.body;
      const config = getAIConfig(rootDir);
      const result = await generateWithAI(prompt, config);
      res.json({ success: true, content: result });
    } catch (err) {
      res.json({ success: false, error: err.message });
    }
  });

  return router;
};
