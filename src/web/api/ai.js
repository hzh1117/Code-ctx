const express = require('express');
const fs = require('fs');
const path = require('path');
const { getAIConfig, saveAIConfig, loadEnvConfig } = require('../../utils/config');
const { generateWithAI, validateBaseUrl } = require('../../ai/client');
const { filterSensitive } = require('../../utils/sensitive-filter');
const { listPresets } = require('../../ai/presets');

const MAX_API_KEY_LENGTH = 512;
const MAX_MODEL_LENGTH = 128;
const SENSITIVE_AI_LIMIT = 30;
const SENSITIVE_AI_WINDOW_MS = 60 * 1000;

function maskKey(apiKey) {
  return apiKey ? '***' + apiKey.slice(-4) : '';
}

function isValidProtocol(protocol) {
  return protocol === 'openai' || protocol === 'anthropic';
}

function validateModelName(model) {
  if (model == null || model === '') return;
  if (typeof model !== 'string' || model.length > MAX_MODEL_LENGTH || /[\r\n]/.test(model)) {
    throw new Error('模型名称格式不合法');
  }
}

function validateMaxTokens(maxTokens) {
  if (maxTokens == null || maxTokens === '') return;
  const parsed = Number(maxTokens);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200000) {
    throw new Error('maxTokens 必须是 1 到 200000 之间的整数');
  }
}

function validateProvider(provider = {}) {
  if (provider == null || typeof provider !== 'object' || Array.isArray(provider)) {
    throw new Error('AI provider 配置必须是对象');
  }
  if (provider.baseUrl) validateBaseUrl(provider.baseUrl);
  validateModelName(provider.model);
  validateMaxTokens(provider.maxTokens);
}

function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API Key 不能为空');
  }
  if (apiKey.length > MAX_API_KEY_LENGTH || /[\r\n]/.test(apiKey)) {
    throw new Error('API Key 格式不合法');
  }
}

function toErrorResponse(err) {
  return { error: err.message || '请求参数不合法' };
}

function createRateLimiter({ limit = SENSITIVE_AI_LIMIT, windowMs = SENSITIVE_AI_WINDOW_MS } = {}) {
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.connection.remoteAddress || 'local';
    const current = buckets.get(key);

    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }

    current.count += 1;
    if (current.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - current.startedAt)) / 1000)));
      return res.status(429).json({ success: false, error: '请求过于频繁，请稍后再试' });
    }

    return next();
  };
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

function updateEnvValue(content, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^${escapedKey}=`, 'm').test(content)) {
    return content.replace(new RegExp(`^${escapedKey}=.*`, 'gm'), `${key}=${value}`);
  } else {
    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    return content + `${key}=${value}\n`;
  }
}

function isEnvInGitignore(rootDir) {
  try {
    const gitignorePath = path.join(rootDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return false;
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n').map(l => l.trim());
    return lines.some(l => l === '.env' || l === '.env*' || l === '.env.*');
  } catch {
    return false;
  }
}

module.exports = function (rootDir) {
  const router = express.Router();
  const sensitiveAiRateLimit = createRateLimiter();

  router.get('/presets', (req, res) => {
    // Presets are static metadata (baseUrl/model/maxTokens) — never API keys.
    // Dashboard renders them as a one-click fill for the AI config form.
    res.json({ presets: listPresets() });
  });

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
      console.error('AI config error:', err.message);
      res.status(500).json({ error: 'AI 配置加载失败' });
    }
  });

  router.put('/config', (req, res) => {
    try {
      const { protocol, baseUrl, model, maxTokens, openai, anthropic } = req.body;
      if (protocol && !isValidProtocol(protocol)) {
        return res.status(400).json({ error: '不支持的 AI 协议' });
      }
      if (baseUrl) validateBaseUrl(baseUrl);
      validateModelName(model);
      validateMaxTokens(maxTokens);
      if (openai) validateProvider(openai);
      if (anthropic) validateProvider(anthropic);
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
      res.status(400).json(toErrorResponse(err));
    }
  });

  router.post('/test', sensitiveAiRateLimit, async (req, res) => {
    try {
      const config = getAIConfig(rootDir);

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

  router.post('/generate', sensitiveAiRateLimit, async (req, res) => {
    try {
      const { prompt } = req.body;
      const safePrompt = filterSensitive(prompt || '').content;
      const config = getAIConfig(rootDir);
      const result = await generateWithAI(safePrompt, config);
      res.json({ success: true, content: result });
    } catch (err) {
      res.json({ success: false, error: err.message });
    }
  });

  router.post('/save-key', sensitiveAiRateLimit, (req, res) => {
    try {
      const { apiKey, protocol, baseUrl, model } = req.body;
      if (protocol && !isValidProtocol(protocol)) {
        return res.status(400).json({ success: false, error: '不支持的 AI 协议' });
      }

      const normalizedProtocol = protocol || 'openai';
      validateApiKey(apiKey);
      if (baseUrl) {
        validateBaseUrl(baseUrl);
      }
      validateModelName(model);

      const envPath = path.join(rootDir, '.env');

      // Warn if .env is not in .gitignore — API keys could be committed
      if (!isEnvInGitignore(rootDir)) {
        console.warn('[code-ctx] 警告: .env 文件不在 .gitignore 中，API key 可能被提交到版本控制');
      }

      // Backup before writing
      if (fs.existsSync(envPath)) {
        try {
          fs.copyFileSync(envPath, envPath + '.bak');
        } catch (backupErr) {
          console.warn('.env 备份失败:', backupErr.message);
        }
      }

      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      if (normalizedProtocol === 'anthropic') {
        envContent = updateEnvValue(envContent, 'ANTHROPIC_API_KEY', apiKey);
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
        const modelKey = normalizedProtocol === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL';
        envContent = updateEnvValue(envContent, modelKey, model);
      }

      fs.writeFileSync(envPath, envContent, { mode: 0o600 });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json(toErrorResponse(err));
    }
  });

  return router;
};
