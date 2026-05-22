// Process-wide plugin state. Each Code-ctx CLI invocation is a short-lived
// Node process, so a module-level singleton is fine; tests use _reset() to
// keep state out of cross-test leakage.
//
// Why a singleton: callers like filterSensitive and getScenarios are reached
// from many call sites and threading per-rootDir state through every call
// signature would be invasive. The loader installs contributions here, and
// the consumers (sensitive-filter, template/engine) read from the same place.

const state = {
  loadedRoot: null,
  loadedSignature: null,
  sensitivePatterns: [],
  sensitiveDetectionPatterns: [],
  scenarios: [],
  adapters: [],
  errors: [],
  plugins: []
};

function getState() {
  return state;
}

function setLoaded(rootDir, signature) {
  state.loadedRoot = rootDir;
  state.loadedSignature = signature;
}

function addContributions({ adapters = [], scenarios = [], sensitivePatterns = [], sensitiveDetectionPatterns = [], plugin }) {
  if (adapters.length) state.adapters.push(...adapters);
  if (scenarios.length) state.scenarios.push(...scenarios);
  if (sensitivePatterns.length) state.sensitivePatterns.push(...sensitivePatterns);
  if (sensitiveDetectionPatterns.length) state.sensitiveDetectionPatterns.push(...sensitiveDetectionPatterns);
  if (plugin) state.plugins.push(plugin);
}

function addError(name, error) {
  state.errors.push({ plugin: name, error: error.message || String(error) });
}

function _reset() {
  state.loadedRoot = null;
  state.loadedSignature = null;
  state.sensitivePatterns = [];
  state.sensitiveDetectionPatterns = [];
  state.scenarios = [];
  state.adapters = [];
  state.errors = [];
  state.plugins = [];
}

module.exports = { getState, setLoaded, addContributions, addError, _reset };
