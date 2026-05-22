const fs = require('fs');
const path = require('path');
const { loadProjectConfig } = require('../utils/config');
const { getState, setLoaded, addContributions, addError, _reset } = require('./state');
const { BaseAdapter } = require('../adapters');
const { defaultRegistry } = require('../adapters');

// Resolve a plugin spec to an absolute module path. Relative paths are
// resolved against rootDir; bare specifiers (npm names) go through
// require.resolve with rootDir as the lookup base so plugins installed in
// the project's node_modules are picked up.
function resolvePluginPath(spec, rootDir) {
  if (typeof spec !== 'string' || spec.length === 0) {
    throw new Error('插件项必须是字符串');
  }
  if (spec.startsWith('./') || spec.startsWith('../') || path.isAbsolute(spec)) {
    return path.resolve(rootDir, spec);
  }
  try {
    return require.resolve(spec, { paths: [rootDir] });
  } catch (err) {
    throw new Error(`无法解析插件 ${spec}: ${err.message}`);
  }
}

function loadPluginModule(spec, rootDir) {
  const resolved = resolvePluginPath(spec, rootDir);
  // Bust require cache so plugin edits are picked up on re-init (tests).
  delete require.cache[resolved];
  const mod = require(resolved);
  return typeof mod === 'function' ? mod() : mod;
}

function isValidAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') return false;
  return typeof adapter.detect === 'function' && typeof adapter.type === 'string';
}

function instantiateAdapter(candidate) {
  if (typeof candidate === 'function') {
    // Looks like a class — try `new`.
    try {
      const instance = new candidate();
      return instance;
    } catch {
      return null;
    }
  }
  return candidate;
}

function isValidScenario(s) {
  return s && typeof s === 'object' && typeof s.id === 'string' && s.id.length > 0;
}

function isValidPattern(p) {
  return p && p.pattern instanceof RegExp && typeof p.replacement === 'string';
}

function isValidDetection(p) {
  return p && p.regex instanceof RegExp && typeof p.name === 'string';
}

function applyPlugin(pluginExports, name) {
  if (!pluginExports || typeof pluginExports !== 'object') {
    throw new Error('插件必须导出对象或工厂函数');
  }

  const adapters = [];
  if (Array.isArray(pluginExports.adapters)) {
    for (const candidate of pluginExports.adapters) {
      const instance = instantiateAdapter(candidate);
      if (!isValidAdapter(instance)) {
        throw new Error(`插件 ${name}: 适配器无效（需要 type getter 和 detect 方法）`);
      }
      adapters.push(instance);
      // Register immediately into the global adapter registry so the rest of
      // the scanner pipeline (project-detector, file-scanner) sees them.
      defaultRegistry.register(instance);
    }
  }

  const scenarios = Array.isArray(pluginExports.scenarios)
    ? pluginExports.scenarios.filter(isValidScenario)
    : [];

  const sensitivePatterns = Array.isArray(pluginExports.sensitivePatterns)
    ? pluginExports.sensitivePatterns.filter(isValidPattern)
    : [];

  const sensitiveDetectionPatterns = Array.isArray(pluginExports.sensitiveDetectionPatterns)
    ? pluginExports.sensitiveDetectionPatterns.filter(isValidDetection)
    : [];

  addContributions({
    adapters,
    scenarios,
    sensitivePatterns,
    sensitiveDetectionPatterns,
    plugin: { name, adapterCount: adapters.length, scenarioCount: scenarios.length }
  });
}

function pluginSignature(rootDir, specs) {
  // Use config mtimes + spec list as a cheap re-load trigger. Plugin source
  // mtimes aren't tracked — assume CLI is short-lived enough that re-running
  // is the user's signal to re-load.
  const parts = [...specs];
  for (const file of ['code-ctx.config.json', 'code-ctx.config.js']) {
    const p = path.join(rootDir, file);
    try {
      parts.push(`${file}:${fs.statSync(p).mtimeMs}`);
    } catch {
      // not present, skip
    }
  }
  return parts.join('|');
}

// Idempotent. Re-invoking with the same rootDir is a no-op unless config
// mtimes or the spec list changed.
function initPlugins(rootDir) {
  let config;
  try {
    config = loadProjectConfig(rootDir);
  } catch {
    // Config load problems aren't a plugin concern — just no-op.
    return getState();
  }

  const specs = Array.isArray(config.plugins) ? config.plugins.filter(s => typeof s === 'string') : [];
  const signature = pluginSignature(rootDir, specs);
  const current = getState();

  if (current.loadedRoot === rootDir && current.loadedSignature === signature) {
    return current;
  }

  _reset();

  for (const spec of specs) {
    try {
      const mod = loadPluginModule(spec, rootDir);
      const name = (mod && typeof mod === 'object' && typeof mod.name === 'string') ? mod.name : spec;
      applyPlugin(mod, name);
    } catch (err) {
      addError(spec, err);
      console.warn(`[code-ctx] 插件加载失败: ${spec} — ${err.message}（已跳过，内置能力不受影响）`);
    }
  }

  setLoaded(rootDir, signature);
  return getState();
}

module.exports = { initPlugins, _resetPluginState: _reset, BaseAdapter };
