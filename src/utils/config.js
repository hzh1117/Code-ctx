const fs = require('fs');
const path = require('path');

function loadEnvConfig(rootDir) {
  const envPath = path.join(rootDir, '.env');
  
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const config = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      config[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return config;
}

function getAIConfig(rootDir) {
  const envConfig = loadEnvConfig(rootDir);
  
  const configPath = path.join(rootDir, 'code-ctx.config.js');
  let projectConfig = {};
  
  if (fs.existsSync(configPath)) {
    projectConfig = require(configPath);
  }
  
  const aiConfig = projectConfig.ai || {};
  
  // 支持 Kimi Code 的环境变量
  const apiKey = envConfig.ANTHROPIC_AUTH_TOKEN || envConfig.ANTHROPIC_API_KEY || envConfig.OPENAI_API_KEY || aiConfig.apiKey || '';
  let baseUrl = aiConfig.baseUrl || '';
  let protocol = aiConfig.protocol || 'openai';
  let model = aiConfig.model || '';
  
  // 如果配置了 ANTHROPIC_BASE_URL，使用 Anthropic 协议
  if (envConfig.ANTHROPIC_BASE_URL) {
    baseUrl = envConfig.ANTHROPIC_BASE_URL;
    protocol = 'anthropic';
  }
  
  // 设置默认值
  if (!baseUrl) {
    baseUrl = protocol === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1';
  }
  
  if (!model) {
    model = protocol === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4';
  }
  
  return {
    protocol,
    baseUrl,
    model,
    maxTokens: aiConfig.maxTokens || 4096,
    apiKey
  };
}

module.exports = { loadEnvConfig, getAIConfig };
