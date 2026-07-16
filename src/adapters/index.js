const { BaseAdapter, assertValidAdapter } = require('./base');
const { AdapterRegistry, loadBuiltinAdapters } = require('./registry');

const defaultRegistry = loadBuiltinAdapters();

module.exports = {
  BaseAdapter,
  assertValidAdapter,
  AdapterRegistry,
  loadBuiltinAdapters,
  defaultRegistry
};
