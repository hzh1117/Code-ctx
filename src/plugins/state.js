const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const contexts = new Map();
const storage = new AsyncLocalStorage();
let lastContext = null;

const EMPTY_STATE = Object.freeze({
  loadedRoot: null,
  loadedSignature: null,
  sensitivePatterns: Object.freeze([]),
  sensitiveDetectionPatterns: Object.freeze([]),
  scenarios: Object.freeze([]),
  adapters: Object.freeze([]),
  errors: Object.freeze([]),
  plugins: Object.freeze([]),
  registry: null
});

function normalizeRoot(rootDir) {
  return rootDir ? path.resolve(rootDir) : null;
}

function getState(rootDir) {
  if (rootDir) return contexts.get(normalizeRoot(rootDir)) || EMPTY_STATE;
  return storage.getStore() || lastContext || EMPTY_STATE;
}

function publishState(rootDir, state) {
  const normalizedRoot = normalizeRoot(rootDir);
  const context = Object.freeze({
    ...state,
    loadedRoot: normalizedRoot,
    sensitivePatterns: Object.freeze([...(state.sensitivePatterns || [])]),
    sensitiveDetectionPatterns: Object.freeze([...(state.sensitiveDetectionPatterns || [])]),
    scenarios: Object.freeze([...(state.scenarios || [])]),
    adapters: Object.freeze([...(state.adapters || [])]),
    errors: Object.freeze([...(state.errors || [])]),
    plugins: Object.freeze([...(state.plugins || [])])
  });
  contexts.set(normalizedRoot, context);
  lastContext = context;
  storage.enterWith(context);
  return context;
}

function activateState(state) {
  if (state && state.loadedRoot) {
    lastContext = state;
    storage.enterWith(state);
  }
  return state || EMPTY_STATE;
}

function _reset(rootDir) {
  if (rootDir) {
    const normalizedRoot = normalizeRoot(rootDir);
    contexts.delete(normalizedRoot);
    if (lastContext?.loadedRoot === normalizedRoot) lastContext = null;
    return;
  }
  contexts.clear();
  lastContext = null;
  storage.disable();
}

module.exports = { getState, publishState, activateState, _reset, EMPTY_STATE };
