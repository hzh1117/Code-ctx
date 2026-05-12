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
  
  return {
    protocol: aiConfig.protocol || 'openai',
    baseUrl: aiConfig.baseUrl || 'https://api.openai.com/v1',
    model: aiConfig.model || 'gpt-4',
    maxTokens: aiConfig.maxTokens || 4096,
    apiKey: envConfig.ANTHROPIC_API_KEY || envConfig.OPENAI_API_KEY || ''
  };
}

module.exports = { loadEnvConfig, getAIConfig };
