const fs = require('fs');
const { getPreset } = require('../ai/presets');
const { generateWithAI, validateBaseUrl } = require('../ai/client');
const { saveAIConfig, getAIConfig, _clearCache } = require('../utils/config');
const { saveEnvValues, ensureEnvIgnored } = require('../utils/env-file');

function validateApiKey(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey || apiKey.length > 512 || /[\r\n]/.test(apiKey)) {
    throw new Error('API Key 格式不合法');
  }
}

async function setupAIConfig(rootDir, options, dependencies = {}) {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new Error(`目录不存在: ${rootDir}`);
  }
  const preset = getPreset(options.provider);
  if (!preset) throw new Error(`未知 provider: ${options.provider}`);
  const protocol = options.protocol || preset.protocol;
  const baseUrl = options.baseUrl || preset.baseUrl;
  const model = options.model || preset.model;
  validateApiKey(options.apiKey);
  validateBaseUrl(baseUrl, {
    allowLocalBaseUrl: options.allowLocalBaseUrl,
    allowInsecureBaseUrl: options.allowInsecureBaseUrl
  });
  if (!model || /[\r\n]/.test(model)) throw new Error('模型名称格式不合法');

  saveAIConfig(rootDir, {
    protocol,
    [protocol]: { baseUrl, model, maxTokens: preset.maxTokens }
  });
  const prefix = protocol === 'anthropic' ? 'ANTHROPIC' : 'OPENAI';
  saveEnvValues(rootDir, {
    [`${prefix}_API_KEY`]: options.apiKey,
    [`${prefix}_BASE_URL`]: baseUrl,
    [`${prefix}_MODEL`]: model
  });
  ensureEnvIgnored(rootDir);
  _clearCache();

  let connection = { tested: false, success: null, error: null };
  if (options.testConnection !== false) {
    const generate = dependencies.generateWithAI || generateWithAI;
    try {
      const config = getAIConfig(rootDir);
      await generate('只回复 OK', {
        ...config,
        maxTokens: 16,
        allowLocalBaseUrl: options.allowLocalBaseUrl,
        allowInsecureBaseUrl: options.allowInsecureBaseUrl
      });
      connection = { tested: true, success: true, error: null };
    } catch (error) {
      connection = { tested: true, success: false, error: error.message };
    }
  }

  return { provider: options.provider, protocol, baseUrl, model, connection };
}

module.exports = { setupAIConfig, validateApiKey };
