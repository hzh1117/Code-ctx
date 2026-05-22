const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadProjectConfig } = require('../utils/config');
const { getState, setLoaded, addContributions, addError, _reset } = require('./state');
const { BaseAdapter } = require('../adapters');
const { defaultRegistry } = require('../adapters');

// ─── Plugin security gate ───────────────────────────────────────────────
// Plugins are arbitrary Node modules; require()-ing one executes its code.
// Any actor who can write code-ctx.config.json's `plugins` field would
// otherwise get RCE on the next CLI invocation. The loader therefore
// requires explicit trust before loading any plugin spec.
//
// Trust sources, checked in order:
//   1. Built-in allowlist (OFFICIAL_PLUGIN_ALLOWLIST) — populated as the
//      project publishes first-party plugins.
//   2. Env var bypass CODE_CTX_PLUGINS_ALLOW_ALL=1 — for tests / CI where
//      the caller already vetted the config.
//   3. Env var CODE_CTX_PLUGINS_ALLOW="spec1,spec2" — per-run trust list.
//   4. Persistent user allowlist at ~/.code-ctx/allowed-plugins.json.
//   5. Interactive TTY confirmation, which writes the spec into (4).
//
// Non-TTY environments without any of (1)–(4) refuse the plugin and
// surface the error to the caller (caught by initPlugins and stored in
// plugin state.errors so the rest of the run continues).

const OFFICIAL_PLUGIN_ALLOWLIST = [
  // Future first-party plugins go here, e.g. '@code-ctx/plugin-eslint'.
];

function getUserAllowlistPath() {
  return path.join(os.homedir(), '.code-ctx', 'allowed-plugins.json');
}

function getUserAllowedPlugins() {
  try {
    const content = fs.readFileSync(getUserAllowlistPath(), 'utf8');
    const arr = JSON.parse(content);
    return Array.isArray(arr) ? arr.filter(s => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function saveUserAllowedPlugin(spec) {
  const list = getUserAllowedPlugins();
  if (list.includes(spec)) return;
  list.push(spec);
  const allowlistPath = getUserAllowlistPath();
  try {
    fs.mkdirSync(path.dirname(allowlistPath), { recursive: true });
    fs.writeFileSync(allowlistPath, JSON.stringify(list, null, 2) + '\n', { mode: 0o600 });
  } catch (err) {
    console.warn(`[code-ctx] 无法保存插件信任列表: ${err.message}`);
  }
}

function getEnvAllowedSpecs() {
  const env = process.env.CODE_CTX_PLUGINS_ALLOW;
  if (!env) return [];
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

function isPluginAllowed(spec) {
  if (process.env.CODE_CTX_PLUGINS_ALLOW_ALL === '1') return true;
  if (OFFICIAL_PLUGIN_ALLOWLIST.includes(spec)) return true;
  if (getEnvAllowedSpecs().includes(spec)) return true;
  if (getUserAllowedPlugins().includes(spec)) return true;
  return false;
}

// Sync TTY read so the gate can keep initPlugins synchronous. Falls back
// to null if stdin can't be read (piped input, no /dev/tty, etc.) and the
// caller treats that as "refuse".
function promptUserSync(question) {
  if (!process.stdin.isTTY) return null;
  try {
    process.stdout.write(question);
    const useDevTty = process.platform !== 'win32';
    const fd = useDevTty ? fs.openSync('/dev/tty', 'rs') : 0;
    const buf = Buffer.alloc(64);
    let answer = '';
    while (true) {
      const n = fs.readSync(fd, buf, 0, buf.length);
      if (n <= 0) break;
      const chunk = buf.slice(0, n).toString('utf8');
      const newlineIdx = chunk.indexOf('\n');
      if (newlineIdx !== -1) {
        answer += chunk.slice(0, newlineIdx);
        break;
      }
      answer += chunk;
      if (answer.length > 256) break;
    }
    if (useDevTty) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
    return answer.replace(/\r$/, '').trim();
  } catch {
    return null;
  }
}

function ensurePluginTrusted(spec, resolved) {
  if (isPluginAllowed(spec)) return;

  const allowlistPath = getUserAllowlistPath();

  if (!process.stdin.isTTY) {
    throw new Error(
      `插件 "${spec}" 不在信任列表中（非交互式环境）。\n` +
      `  - 设置环境变量 CODE_CTX_PLUGINS_ALLOW="${spec}" 临时放行\n` +
      `  - 或将 spec 加入 ${allowlistPath}\n` +
      `  - 测试环境可设 CODE_CTX_PLUGINS_ALLOW_ALL=1`
    );
  }

  const answer = promptUserSync(
    `\n⚠️  安全警告：插件 "${spec}" 不在信任列表中。\n` +
    `   路径: ${resolved}\n` +
    `   加载此插件将执行其代码。是否允许？ [y/N] `
  );

  if (answer === null) {
    throw new Error(`无法读取用户确认，插件 "${spec}" 已拒绝加载`);
  }
  const normalized = answer.toLowerCase();
  if (normalized !== 'y' && normalized !== 'yes') {
    throw new Error(`用户拒绝了插件 "${spec}" 的加载`);
  }

  saveUserAllowedPlugin(spec);
  console.log(`✓ 插件 "${spec}" 已添加到信任列表 (${allowlistPath})`);
}

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
  ensurePluginTrusted(spec, resolved);
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

module.exports = {
  initPlugins,
  _resetPluginState: _reset,
  BaseAdapter,
  // Exposed for tests; not part of the public API.
  _internals: {
    OFFICIAL_PLUGIN_ALLOWLIST,
    getUserAllowlistPath,
    getUserAllowedPlugins,
    isPluginAllowed,
    ensurePluginTrusted
  }
};
