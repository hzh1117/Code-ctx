const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');
const { AI_CLIENT, PROJECT_LIMITS } = require('./constants');
const { listPresets } = require('../ai/presets');

// In-memory caches keyed by absolute file path. Each entry stores the
// file mtimeMs at load time so subsequent calls can skip re-parsing
// when the file hasn't been touched. Tests can clear via _clearCache.
const envConfigCache = new Map();
const projectConfigCache = new Map();

// One-shot warnings per rootDir, so repeated loads don't spam.
const warnedDualConfig = new Set();
const warnedSchema = new Set();
const warnedPathMigration = new Set();

const CONFIG_FILE_JSON = 'code-ctx.config.json';
const CONFIG_FILE_JS = 'code-ctx.config.js';

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
  warnedDualConfig.clear();
  warnedSchema.clear();
  warnedPathMigration.clear();
}

function isWithinRoot(rootDir, targetPath) {
  const relative = path.relative(path.resolve(rootDir), path.resolve(targetPath));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function toPortableProjectPath(rootDir, projectPath, label = 'project.path') {
  if (typeof projectPath !== 'string' || projectPath.trim() === '') {
    throw new Error(`${label} 必须是非空字符串`);
  }
  const resolved = path.resolve(rootDir, projectPath);
  if (!isWithinRoot(rootDir, resolved)) {
    throw new Error(`${label} 越界，必须位于项目根目录内: ${projectPath}`);
  }
  const relative = path.relative(path.resolve(rootDir), resolved).split(path.sep).join('/');
  return relative ? `./${relative}` : '.';
}

function normalizeProjectPaths(rootDir, config, configPath) {
  if (!Array.isArray(config.projects)) return config;
  let migratedAbsolutePath = false;
  const normalized = {
    ...config,
    projects: config.projects.map((project, index) => {
      if (!project || typeof project !== 'object' || project.path === undefined) return project;
      if (path.isAbsolute(project.path)) migratedAbsolutePath = true;
      return {
        ...project,
        path: toPortableProjectPath(rootDir, project.path, `projects[${index}].path`)
      };
    })
  };
  if (migratedAbsolutePath && configPath && !warnedPathMigration.has(configPath)) {
    console.warn('[code-ctx] 已将旧配置中的绝对项目路径迁移为相对路径；下次保存配置时会写入新格式。');
    warnedPathMigration.add(configPath);
  }
  return normalized;
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

// Resolve which project config file is active for a given rootDir.
// Priority: code-ctx.config.json > code-ctx.config.js. When both exist
// the JSON file wins and a one-shot warning is emitted.
function getConfigFile(rootDir) {
  const jsonPath = path.join(rootDir, CONFIG_FILE_JSON);
  const jsPath = path.join(rootDir, CONFIG_FILE_JS);
  const hasJson = fs.existsSync(jsonPath);
  const hasJs = fs.existsSync(jsPath);

  if (hasJson) {
    return { path: jsonPath, format: 'json', exists: true, hasOtherFormat: hasJs };
  }
  if (hasJs) {
    return { path: jsPath, format: 'js', exists: true, hasOtherFormat: false };
  }
  return { path: jsonPath, format: 'json', exists: false, hasOtherFormat: false };
}

function loadJsonConfig(configPath) {
  const code = fs.readFileSync(configPath, 'utf8');
  try {
    const parsed = JSON.parse(code);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JSON 配置必须是对象');
    }
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('配置文件 JSON 解析失败');
    }
    throw err;
  }
}

function loadProjectConfig(rootDir) {
  const info = getConfigFile(rootDir);
  if (!info.exists) {
    return {};
  }

  if (info.hasOtherFormat && !warnedDualConfig.has(rootDir)) {
    console.warn(`[code-ctx] 同时检测到 ${CONFIG_FILE_JSON} 和 ${CONFIG_FILE_JS}，使用 JSON 并忽略 JS。建议删除 ${CONFIG_FILE_JS}。`);
    warnedDualConfig.add(rootDir);
  }

  const mtimeMs = statMtime(info.path);
  if (mtimeMs === null) return {};

  const cached = projectConfigCache.get(info.path);
  if (cached && cached.mtimeMs === mtimeMs && cached.format === info.format) {
    return cached.value;
  }

  const parsedValue = info.format === 'json'
    ? loadJsonConfig(info.path)
    : loadConfigWithVM(info.path);
  const value = normalizeProjectPaths(rootDir, parsedValue, info.path);

  const validation = validateProjectConfigDetailed(value);
  if (validation.errors.length > 0) {
    throw new ConfigValidationError(info.path, validation.errors, validation.warnings);
  }
  if (validation.warnings.length > 0 && !warnedSchema.has(info.path)) {
    console.warn(`[code-ctx] 配置迁移警告 (${path.basename(info.path)}): ${validation.warnings.join('; ')}`);
    warnedSchema.add(info.path);
  }

  projectConfigCache.set(info.path, { mtimeMs, value, format: info.format });
  return value;
}

function loadConfigWithVM(configPath) {
  const code = fs.readFileSync(configPath, 'utf8');
  try {
    const match = code.match(/^\s*module\.exports\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!match) throw new Error('仅支持 module.exports = {...} 数据对象');
    const parsed = JSON5.parse(match[1]);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('配置必须导出对象');
    }
    return parsed;
  } catch {
    throw new Error('配置文件解析失败：旧 JS 配置仅允许 module.exports = {...} 静态数据，请运行 code-ctx config migrate');
  }
}

// Lightweight schema validator. Returns array of error strings; empty array
// means valid. Intentionally hand-rolled to avoid pulling in ajv: the schema
// is tiny and validation is only run on load (warn) and on write (strict).
const ALLOWED_TOP_KEYS = new Set([
  'projectName', 'outputDir', 'aiMode', 'projects',
  'excludeDirs', 'gitTrack', 'ai', 'projectLimits', 'plugins'
]);

const ALLOWED_AI_MODES = new Set(['clipboard', 'auto', 'manual']);

class ConfigValidationError extends Error {
  constructor(configPath, errors, warnings = []) {
    super(`配置 schema 校验失败 (${path.basename(configPath)}): ${errors.join('; ')}`);
    this.name = 'ConfigValidationError';
    this.configPath = configPath;
    this.errors = errors;
    this.warnings = warnings;
  }
}

function validateProjectConfigDetailed(config) {
  const errors = [];
  const warnings = [];
  if (config == null) return { errors, warnings };
  if (typeof config !== 'object' || Array.isArray(config)) {
    errors.push('配置必须是对象');
    return { errors, warnings };
  }

  for (const key of Object.keys(config)) {
    if (!ALLOWED_TOP_KEYS.has(key)) {
      warnings.push(`未知字段: ${key}`);
    }
  }

  if (config.projectName !== undefined && typeof config.projectName !== 'string') {
    errors.push('projectName 必须是字符串');
  }
  if (config.outputDir !== undefined && typeof config.outputDir !== 'string') {
    errors.push('outputDir 必须是字符串');
  }
  if (config.aiMode !== undefined && !ALLOWED_AI_MODES.has(config.aiMode)) {
    errors.push(`aiMode 必须是 clipboard|auto|manual 之一`);
  }
  if (config.gitTrack !== undefined && typeof config.gitTrack !== 'boolean') {
    errors.push('gitTrack 必须是布尔值');
  }
  if (config.excludeDirs !== undefined && (
    !Array.isArray(config.excludeDirs) || config.excludeDirs.some(dir => typeof dir !== 'string')
  )) {
    errors.push('excludeDirs 必须是字符串数组');
  }
  if (config.plugins !== undefined && (
    !Array.isArray(config.plugins) || config.plugins.some(plugin => typeof plugin !== 'string')
  )) {
    errors.push('plugins 必须是字符串数组');
  }
  if (config.projects !== undefined) {
    if (!Array.isArray(config.projects)) {
      if (config.projects && typeof config.projects === 'object') {
        warnings.push('projects 对象映射是旧格式，建议迁移为数组');
      } else {
        errors.push('projects 必须是数组');
      }
    } else {
      config.projects.forEach((p, i) => {
        if (!p || typeof p !== 'object' || Array.isArray(p)) {
          errors.push(`projects[${i}] 必须是对象`);
          return;
        }
        if (!p.alias || typeof p.alias !== 'string') {
          errors.push(`projects[${i}].alias 必须存在且为字符串`);
        }
        if (p.path !== undefined && typeof p.path !== 'string') {
          errors.push(`projects[${i}].path 必须是字符串`);
        }
        if (p.type !== undefined && typeof p.type !== 'string') {
          errors.push(`projects[${i}].type 必须是字符串`);
        }
        if (p.scanPatterns !== undefined && (
          !Array.isArray(p.scanPatterns) || p.scanPatterns.some(pattern => typeof pattern !== 'string')
        )) {
          errors.push(`projects[${i}].scanPatterns 必须是字符串数组`);
        }
      });
    }
  }
  if (config.ai !== undefined && (typeof config.ai !== 'object' || Array.isArray(config.ai))) {
    errors.push('ai 必须是对象');
  } else if (config.ai) {
    if (config.ai.protocol !== undefined && !['openai', 'anthropic'].includes(config.ai.protocol)) {
      errors.push('ai.protocol 必须是 openai|anthropic 之一');
    }
    for (const field of ['timeout', 'maxInputTokens']) {
      if (config.ai[field] !== undefined && (
        typeof config.ai[field] !== 'number' || !Number.isFinite(config.ai[field]) || config.ai[field] <= 0
      )) errors.push(`ai.${field} 必须是正数`);
    }
  }
  if (config.projectLimits !== undefined && (typeof config.projectLimits !== 'object' || Array.isArray(config.projectLimits))) {
    errors.push('projectLimits 必须是对象');
  } else if (config.projectLimits) {
    for (const field of ['maxFiles', 'maxTokens']) {
      if (config.projectLimits[field] !== undefined && (
        typeof config.projectLimits[field] !== 'number' ||
        !Number.isFinite(config.projectLimits[field]) ||
        config.projectLimits[field] <= 0
      )) errors.push(`projectLimits.${field} 必须是正数`);
    }
  }

  return { errors, warnings };
}

function validateProjectConfig(config) {
  const result = validateProjectConfigDetailed(config);
  return [...result.errors, ...result.warnings];
}

// Write project config back to disk. Chooses the format based on what's
// already present, defaulting to JSON. Callers can force a specific format
// with options.format ('json' | 'js'). Backs up the existing file first.
function saveProjectConfig(rootDir, config, options = {}) {
  const targetFormat = options.format || 'json';
  if (targetFormat !== 'json') {
    throw new Error('不再支持写入 JS 配置，请使用 JSON 格式');
  }
  const targetPath = path.join(rootDir, CONFIG_FILE_JSON);

  const portableConfig = normalizeProjectPaths(rootDir, config);
  const validation = validateProjectConfigDetailed(portableConfig);
  if (validation.errors.length > 0) {
    throw new ConfigValidationError(targetPath, validation.errors, validation.warnings);
  }

  if (fs.existsSync(targetPath)) {
    try {
      fs.copyFileSync(targetPath, targetPath + '.bak');
    } catch (backupErr) {
      console.warn('配置备份失败:', backupErr.message);
    }
  }

  const content = `${JSON.stringify(portableConfig, null, 2)}\n`;
  fs.writeFileSync(targetPath, content);

  projectConfigCache.delete(targetPath);
  return { path: targetPath, format: targetFormat };
}

function migrateProjectConfig(rootDir) {
  const info = getConfigFile(rootDir);
  if (!info.exists) throw new Error('配置文件不存在');
  if (info.format === 'json') {
    return { status: 'already-json', path: info.path, backupPath: null };
  }

  const config = loadProjectConfig(rootDir);
  const written = saveProjectConfig(rootDir, config, { format: 'json' });
  let backupPath = `${info.path}.bak`;
  let suffix = 1;
  while (fs.existsSync(backupPath)) {
    backupPath = `${info.path}.bak.${suffix++}`;
  }
  fs.renameSync(info.path, backupPath);
  _clearCache();
  return { status: 'migrated', path: written.path, backupPath };
}

function inspectProjectConfig(rootDir) {
  const info = getConfigFile(rootDir);
  if (!info.exists) {
    return { ...info, config: {}, errors: ['配置文件不存在'], warnings: [] };
  }
  try {
    const parsed = info.format === 'json' ? loadJsonConfig(info.path) : loadConfigWithVM(info.path);
    const config = normalizeProjectPaths(rootDir, parsed, info.path);
    const validation = validateProjectConfigDetailed(config);
    return { ...info, config, ...validation };
  } catch (error) {
    return {
      ...info,
      config: {},
      errors: error.errors || [error.message],
      warnings: error.warnings || []
    };
  }
}

// 默认模型依据官方废弃文档校准（2026-05 复核）：
// - OpenAI gpt-4 系列将于 2026-10-23 退役，官方推荐替换为 gpt-5.5。
//   参考 https://platform.openai.com/docs/deprecations
// - Anthropic claude-3-5-sonnet-20241022 已于 2025-10-28 退役，调用会失败，
//   官方推荐替换为 claude-sonnet-4-6。
//   参考 https://platform.claude.com/docs/en/about-claude/model-deprecations
// 用户可通过 .env (OPENAI_MODEL / ANTHROPIC_MODEL) 或 code-ctx.config.json 覆盖。
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

// 通过 baseUrl 反查 preset，让 preset 决定默认 model。
// 用户未显式设置 model 时，若 baseUrl 命中 presets 中某条记录，
// 就采用该 preset 的默认 model（如 kimi 的 kimi-for-coding）。
function inferPresetFromBaseUrl(baseUrl, protocol) {
  if (!baseUrl) return null;
  const normalize = u => String(u).replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const target = normalize(baseUrl);
  if (!target) return null;
  return listPresets().find(p => {
    if (protocol && p.protocol !== protocol) return false;
    const preset = normalize(p.baseUrl);
    if (!preset) return false;
    return target === preset || target.startsWith(preset + '/') || preset.startsWith(target + '/');
  }) || null;
}

function providerFromLegacy(aiConfig, _protocol) {
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
  let maxTokens = provider.maxTokens || defaults.maxTokens;

  if (!provider.model) {
    const preset = inferPresetFromBaseUrl(baseUrl, protocol);
    if (preset) {
      if (preset.model) model = preset.model;
      if (!provider.maxTokens && preset.maxTokens) maxTokens = preset.maxTokens;
    }
  }

  return { baseUrl, model, maxTokens };
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
  } else if (!aiConfig.anthropic?.model && !(protocol === 'anthropic' && aiConfig.model)) {
    const preset = inferPresetFromBaseUrl(providers.anthropic.baseUrl, 'anthropic');
    if (preset && preset.model) {
      providers.anthropic.model = preset.model;
    }
  }

  if (envConfig.OPENAI_MODEL) {
    providers.openai.model = envConfig.OPENAI_MODEL;
  }

  const activeProvider = providers[protocol];
  const apiKey = protocol === 'anthropic'
    ? (envConfig.ANTHROPIC_AUTH_TOKEN || envConfig.ANTHROPIC_API_KEY || aiConfig.apiKey || '')
    : (envConfig.OPENAI_API_KEY || aiConfig.apiKey || '');

  // 获取 timeout 配置
  const rawTimeout = aiConfig.timeout || envConfig.AI_TIMEOUT;
  const parsedTimeout = rawTimeout != null ? parseInt(rawTimeout, 10) : NaN;
  const timeout = Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : AI_CLIENT.DEFAULT_TIMEOUT;
  const configuredInputTokens = parseInt(
    aiConfig.maxInputTokens || envConfig.AI_MAX_INPUT_TOKENS,
    10
  );
  const maxInputTokens = Number.isFinite(configuredInputTokens) && configuredInputTokens > 0
    ? configuredInputTokens
    : require('./constants').CONTEXT_LIMITS.MAX_INPUT_TOKENS;

  return {
    protocol,
    baseUrl: activeProvider.baseUrl,
    model: activeProvider.model,
    maxTokens: activeProvider.maxTokens,
    maxInputTokens,
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
    maxFiles: parseInt(
      limits.maxFiles || envConfig.MAX_FILES_PER_PROJECT || PROJECT_LIMITS.MAX_FILES_PER_PROJECT,
      10
    ),
    maxTokens: parseInt(
      limits.maxTokens || envConfig.MAX_PROJECT_TOKENS || PROJECT_LIMITS.MAX_PROJECT_TOKENS,
      10
    )
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

  saveProjectConfig(rootDir, nextConfig);
  return nextConfig.ai;
}

module.exports = {
  loadEnvConfig,
  getAIConfig,
  loadProjectConfig,
  loadConfigWithVM,
  loadJsonConfig,
  saveAIConfig,
  saveProjectConfig,
  getConfigFile,
  validateProjectConfig,
  validateProjectConfigDetailed,
  inspectProjectConfig,
  migrateProjectConfig,
  ConfigValidationError,
  normalizeProjectPaths,
  toPortableProjectPath,
  getAIProviders,
  getProjectLimits,
  CONFIG_FILE_JSON,
  CONFIG_FILE_JS,
  _clearCache
};
