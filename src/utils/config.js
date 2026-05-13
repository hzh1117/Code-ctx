const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
      const rawValue = valueParts.join('=').trim();
      config[key.trim()] = rawValue.replace(/^["']|["']$/g, '');
    }
  });
  
  return config;
}

function loadProjectConfig(rootDir) {
  const configPath = path.join(rootDir, 'code-ctx.config.js');

  if (!fs.existsSync(configPath)) {
    return {};
  }

  const code = fs.readFileSync(configPath, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    process,
    __dirname: path.dirname(configPath),
    __filename: configPath
  };

  vm.runInNewContext(code, sandbox, { filename: configPath });
  return module.exports;
}

function loadConfigWithVM(configPath) {
  const code = fs.readFileSync(configPath, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    process,
    __dirname: path.dirname(configPath),
    __filename: configPath
  };
  vm.runInNewContext(code, sandbox, { filename: configPath });
  return module.exports;
}

const DEFAULT_PROVIDER_CONFIG = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
    maxTokens: 4096
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
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
  
  return {
    protocol,
    baseUrl: activeProvider.baseUrl,
    model: activeProvider.model,
    maxTokens: activeProvider.maxTokens,
    apiKey,
    providers
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

module.exports = { loadEnvConfig, getAIConfig, loadProjectConfig, loadConfigWithVM, saveAIConfig, getAIProviders };
