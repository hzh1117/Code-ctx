const { BaseAdapter } = require('./base');
const { AdapterRegistry, loadBuiltinAdapters } = require('./registry');

const defaultRegistry = loadBuiltinAdapters();

module.exports = { BaseAdapter, AdapterRegistry, loadBuiltinAdapters, defaultRegistry };
