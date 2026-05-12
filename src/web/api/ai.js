const express = require('express');
const fs = require('fs');
const path = require('path');
const { getAIConfig, loadEnvConfig, saveAIConfig } = require('../../utils/config');
const { generateWithAI } = require('../../ai/client');

function maskKey(apiKey) {
  return apiKey ? '***' + apiKey.slice(-4) : '';
}

function getKeyInfo(rootDir) {
  const envConfig = loadEnvConfig(rootDir);
  const openaiKey = envConfig.OPENAI_API_KEY || '';
  const anthropicKey = envConfig.ANTHROPIC_AUTH_TOKEN || envConfig.ANTHROPIC_API_KEY || '';

  return {
    openai: {
      hasApiKey: !!openaiKey,
      apiKey: maskKey(openaiKey)
    },
    anthropic: {
      hasApiKey: !!anthropicKey,
      apiKey: maskKey(anthropicKey)
    }
  };
}

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
        providers: config.providers,
        hasApiKey: !!config.apiKey,
        apiKey: maskKey(config.apiKey),
        keys: getKeyInfo(rootDir)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/config', (req, res) => {
    try {
      const { protocol, baseUrl, model, maxTokens, openai, anthropic } = req.body;
      const saved = saveAIConfig(rootDir, {
        protocol,
        baseUrl,
        model,
        maxTokens,
        openai,
        anthropic
      });
      res.json({ success: true, ai: saved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/test', async (req, res) => {
    try {
      const config = getAIConfig(rootDir);
      
      // 检查配置
      if (!config.apiKey) {
        return res.json({ 
          success: false, 
          error: '未配置 API Key，请在 .env 文件中配置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY' 
        });
      }
      
      if (!config.baseUrl) {
        return res.json({ 
          success: false, 
          error: '未配置 API 地址，请在 code-ctx.config.js 中配置 ai.baseUrl' 
        });
      }
      
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

  router.post('/save-key', (req, res) => {
    try {
      const { apiKey, protocol } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: 'API Key 不能为空' });
      }

      const envPath = path.join(rootDir, '.env');
      const activeProtocol = protocol === 'anthropic' ? 'anthropic' : 'openai';
      const keyName = activeProtocol === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
      
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      
      if (envContent.includes(keyName + '=')) {
        envContent = envContent.replace(new RegExp(`${keyName}=.*`, 'g'), `${keyName}=${apiKey}`);
      } else {
        if (envContent && !envContent.endsWith('\n')) {
          envContent += '\n';
        }
        envContent += `${keyName}=${apiKey}\n`;
      }
      
      fs.writeFileSync(envPath, envContent);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
