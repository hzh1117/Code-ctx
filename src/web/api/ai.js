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
      const { apiKey, protocol, baseUrl, model } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: 'API Key 不能为空' });
      }

      const envPath = path.join(rootDir, '.env');
      
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      
      // 保存 API Key
      if (protocol === 'anthropic') {
        envContent = updateEnvValue(envContent, 'ANTHROPIC_AUTH_TOKEN', apiKey);
        if (baseUrl) {
          envContent = updateEnvValue(envContent, 'ANTHROPIC_BASE_URL', baseUrl);
        }
      } else {
        envContent = updateEnvValue(envContent, 'OPENAI_API_KEY', apiKey);
        if (baseUrl) {
          envContent = updateEnvValue(envContent, 'OPENAI_BASE_URL', baseUrl);
        }
      }
      
      if (model) {
        const modelKey = protocol === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL';
        envContent = updateEnvValue(envContent, modelKey, model);
      }
      
      fs.writeFileSync(envPath, envContent);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

function updateEnvValue(content, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (content.includes(key + '=')) {
    return content.replace(new RegExp(`${escapedKey}=.*`, 'g'), `${key}=${value}`);
  } else {
    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    return content + `${key}=${value}\n`;
  }
}

  return router;
};
