const fs = require('fs');
const path = require('path');
const { BaseAdapter } = require('./base');

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter) {
    if (!(adapter instanceof BaseAdapter)) {
      throw new Error('Adapter must extend BaseAdapter');
    }
    this.adapters.set(adapter.type, adapter);
  }

  detect(pkg, files) {
    const ordered = [...this.adapters.entries()]
      .sort(([, a], [, b]) => a.detectionPriority - b.detectionPriority);
    for (const [type, adapter] of ordered) {
      if (adapter.detect(pkg, files)) {
        return type;
      }
    }
    return null;
  }

  getScanPatterns(type) {
    const adapter = this.adapters.get(type);
    return adapter ? adapter.scanPatterns : [];
  }

  getFilePriority(type, filePath) {
    const adapter = this.adapters.get(type);
    if (!adapter || typeof adapter.getFilePriority !== 'function') return 100;
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    return adapter.getFilePriority(normalizedPath);
  }

  get types() {
    return [...this.adapters.keys()];
  }
}

function loadBuiltinAdapters() {
  const registry = new AdapterRegistry();
  const builtinDir = path.join(__dirname, 'builtin');

  const files = fs.readdirSync(builtinDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const AdapterClass = require(path.join(builtinDir, file));
    registry.register(new AdapterClass());
  }

  return registry;
}

module.exports = { AdapterRegistry, loadBuiltinAdapters };
