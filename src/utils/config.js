const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { AI_CLIENT, PROJECT_LIMITS } = require('./constants');

// In-memory caches keyed by absolute file path. Each entry stores the
// file mtimeMs at load time so subsequent calls can skip re-parsing
// when the file hasn't been touched. Tests can clear via _clearCache.
const envConfigCache = new Map();
const projectConfigCache = new Map();

function statMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

function _clearCache() {
  envConfigCache.clear();
  projectConfigCache.clear();
}

function loadEnvConfig(rootDir) {
  const envPath = path.join(rootDir, '.env');

  const mtimeMs = statMtime(envPath);
  if (mtimeMs === null) {
    return {};
  }

  const cached = envConfigCache.get(envPath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.value;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const config = {};

  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      const rawValue = valueParts.join('=').trim();
      config[key.trim()] = rawValue.replace(/^["']|["']$/g, '');
    }
  });

  envConfigCache.set(envPath, { mtimeMs, value: config });
  return config;
}

function loadProjectConfig(rootDir) {
  const configPath = path.join(rootDir, 'code-ctx.config.js');

  const mtimeMs = statMtime(configPath);
  if (mtimeMs === null) {
    return {};
  }

  const cached = projectConfigCache.get(configPath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.value;
  }

  const value = loadConfigWithVM(configPath);
  projectConfigCache.set(configPath, { mtimeMs, value });
  return value;
}

function loadConfigWithVM(configPath) {
  const code = fs.readFileSync(configPath, 'utf8');
  try {
    const module = { exports: {} };
    const sandbox = {
      module,
      exports: module.exports
    };
    vm.runInNewContext(code, sandbox, { filename: configPath });
    return module.exports;
  } catch (err) {
    throw new Error(`配置文件解析失败`);
  }
}

// 默认模型依据官方废弃文档校准（2026-05 复核）：
// - OpenAI gpt-4 系列将于 2026-10-23 退役，官方推荐替换为 gpt-5.5。
//   参考 https://platform.openai.com/docs/deprecations
// - Anthropic claude-3-5-sonnet-20241022 已于 2025-10-28 退役，调用会失败，
//   官方推荐替换为 claude-sonnet-4-6。
//   参考 https://platform.claude.com/docs/en/about-claude/model-deprecations
// 用户可通过 .env (OPENAI_MODEL / ANTHROPIC_MODEL) 或 code-ctx.config.js 覆盖。
const DEFAULT_PROVIDER_CONFIG = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.5',
    maxTokens: 4096
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-6',
    maxTokens: 4096
  }
};

function normalizeProtocol(protocol) {
  return protocol === 'anthropic' ? 'anthropic' : 'openai';
}

function providerFromLegacy(aiConfig, protocol) {
  if (!aiConfig || !aiConfig.baseUrl && !aiConfig.model && !aiConfig.maxTokens) {
    return {};
  }

  return {
    baseUrl: aiConfig.baseUrl,
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens
  };
}

function normalizeProviderConfig(provider, protocol) {
  const defaults = DEFAULT_PROVIDER_CONFIG[protocol];
  const baseUrl = provider.baseUrl || defaults.baseUrl;
  let model = provider.model || defaults.model;

  if (!provider.model && protocol === 'anthropic' && baseUrl.includes('api.kimi.com/coding')) {
    model = 'kimi-for-coding';
  }

  return {
    baseUrl,
    model,
    maxTokens: provider.maxTokens || defaults.maxTokens
  };
}

function getAIProviders(projectConfig = {}) {
  const aiConfig = projectConfig.ai || {};
  const protocol = normalizeProtocol(aiConfig.protocol);

  const openai = normalizeProviderConfig({
    ...(aiConfig.openai || {}),
    ...(protocol === 'openai' ? providerFromLegacy(aiConfig, protocol) : {})
  }, 'openai');

  const anthropic = normalizeProviderConfig({
    ...(aiConfig.anthropic || {}),
    ...(protocol === 'anthropic' ? providerFromLegacy(aiConfig, protocol) : {})
  }, 'anthropic');

  return { openai, anthropic };
}

function getAIConfig(rootDir) {
  // 先读取项目目录的配置
  let envConfig = loadEnvConfig(rootDir);
  let projectConfig = loadProjectConfig(rootDir);
  
  // 如果项目目录没有配置，尝试读取工具目录的配置
  if (!envConfig.ANTHROPIC_AUTH_TOKEN && !envConfig.ANTHROPIC_API_KEY && !envConfig.OPENAI_API_KEY) {
    const toolDir = getToolDirectory();
    if (toolDir && toolDir !== rootDir) {
      const toolEnvConfig = loadEnvConfig(toolDir);
      
      if (toolEnvConfig.ANTHROPIC_AUTH_TOKEN || toolEnvConfig.ANTHROPIC_API_KEY || toolEnvConfig.OPENAI_API_KEY) {
        envConfig = { ...toolEnvConfig, ...envConfig };
      }
    }
  }
  
  const aiConfig = projectConfig.ai || {};
  const providers = getAIProviders(projectConfig);
  let protocol = normalizeProtocol(aiConfig.protocol);
  
  // 如果配置了 ANTHROPIC_BASE_URL，使用 Anthropic 协议
  if (envConfig.ANTHROPIC_BASE_URL) {
    protocol = 'anthropic';
    providers.anthropic.baseUrl = envConfig.ANTHROPIC_BASE_URL;
  }

  if (envConfig.OPENAI_BASE_URL) {
    providers.openai.baseUrl = envConfig.OPENAI_BASE_URL;
  }

  if (envConfig.ANTHROPIC_MODEL) {
    providers.anthropic.model = envConfig.ANTHROPIC_MODEL;
  } else if (providers.anthropic.baseUrl.includes('api.kimi.com/coding') && !aiConfig.anthropic?.model && !(protocol === 'anthropic' && aiConfig.model)) {
    providers.anthropic.model = 'kimi-for-coding';
  }

  if (envConfig.OPENAI_MODEL) {
    providers.openai.model = envConfig.OPENAI_MODEL;
  }

  const activeProvider = providers[protocol];
  const apiKey = protocol === 'anthropic'
    ? (envConfig.ANTHROPIC_AUTH_TOKEN || envConfig.ANTHROPIC_API_KEY || aiConfig.apiKey || '')
    : (envConfig.OPENAI_API_KEY || aiConfig.apiKey || '');
  
  // 获取 timeout 配置
  const timeout = aiConfig.timeout || envConfig.AI_TIMEOUT 
    ? parseInt(envConfig.AI_TIMEOUT || aiConfig.timeout, 10) 
    : AI_CLIENT.DEFAULT_TIMEOUT;

  return {
    protocol,
    baseUrl: activeProvider.baseUrl,
    model: activeProvider.model,
    maxTokens: activeProvider.maxTokens,
    apiKey,
    timeout,
    providers
  };
}

function getProjectLimits(rootDir) {
  const envConfig = loadEnvConfig(rootDir);
  const projectConfig = loadProjectConfig(rootDir);
  const limits = projectConfig.projectLimits || {};
  
  return {
    maxFiles: limits.maxFiles || envConfig.MAX_FILES_PER_PROJECT 
      ? parseInt(envConfig.MAX_FILES_PER_PROJECT || limits.maxFiles, 10) 
      : PROJECT_LIMITS.MAX_FILES_PER_PROJECT,
    maxTokens: limits.maxTokens || envConfig.MAX_PROJECT_TOKENS 
      ? parseInt(envConfig.MAX_PROJECT_TOKENS || limits.maxTokens, 10) 
      : PROJECT_LIMITS.MAX_PROJECT_TOKENS
  };
}

function getToolDirectory() {
  // 尝试获取 code-ctx 工具的安装目录
  try {
    // 方法 1: 从当前文件的目录向上查找
    const currentFileDir = __dirname;
    let currentDir = currentFileDir;
    
    while (currentDir !== path.dirname(currentDir)) {
      const pkgPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'code-ctx') {
          return currentDir;
        }
      }
      currentDir = path.dirname(currentDir);
    }
    
    // 方法 2: 从全局 npm 目录查找
    const globalPaths = [
      path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'code-ctx'),
      path.join(process.env.HOME || '', '.npm', 'node_modules', 'code-ctx'),
      '/usr/local/lib/node_modules/code-ctx',
      '/usr/lib/node_modules/code-ctx'
    ];
    
    for (const globalPath of globalPaths) {
      if (fs.existsSync(globalPath)) {
        return globalPath;
      }
    }
    
    // 方法 3: 从当前工作目录查找
    const cwdPkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(cwdPkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(cwdPkgPath, 'utf8'));
      if (pkg.name === 'code-ctx') {
        return process.cwd();
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

function saveAIConfig(rootDir, aiConfig) {
  const configPath = path.join(rootDir, 'code-ctx.config.js');
  const projectConfig = loadProjectConfig(rootDir);
  const currentProviders = getAIProviders(projectConfig);
  const protocol = normalizeProtocol(aiConfig.protocol || projectConfig.ai?.protocol);

  const openai = normalizeProviderConfig({
    ...currentProviders.openai,
    ...(aiConfig.openai || {})
  }, 'openai');

  const anthropic = normalizeProviderConfig({
    ...currentProviders.anthropic,
    ...(aiConfig.anthropic || {})
  }, 'anthropic');

  const legacyProvider = providerFromLegacy(aiConfig, protocol);
  const providers = {
    openai: (!aiConfig.openai && protocol === 'openai') ? normalizeProviderConfig({ ...openai, ...legacyProvider }, 'openai') : openai,
    anthropic: (!aiConfig.anthropic && protocol === 'anthropic') ? normalizeProviderConfig({ ...anthropic, ...legacyProvider }, 'anthropic') : anthropic
  };

  const nextConfig = {
    ...projectConfig,
    ai: {
      ...(projectConfig.ai || {}),
      protocol,
      openai: providers.openai,
      anthropic: providers.anthropic
    }
  };

  delete nextConfig.ai.baseUrl;
  delete nextConfig.ai.model;
  delete nextConfig.ai.maxTokens;

  fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(nextConfig, null, 2)};\n`);
  return nextConfig.ai;
}

module.exports = { loadEnvConfig, getAIConfig, loadProjectConfig, loadConfigWithVM, saveAIConfig, getAIProviders, getProjectLimits, _clearCache };
