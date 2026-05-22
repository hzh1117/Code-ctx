const fs = require('fs');
const path = require('path');
const os = require('os');

const { initPlugins, _resetPluginState } = require('../../src/plugins/loader');
const { defaultRegistry, BaseAdapter } = require('../../src/adapters');
const { _clearCache } = require('../../src/utils/config');
const { getState } = require('../../src/plugins/state');
const { filterSensitive, scanDirectory } = require('../../src/utils/sensitive-filter');
const { getScenarios } = require('../../src/template/engine');

function writeConfig(dir, plugins) {
  fs.writeFileSync(path.join(dir, 'code-ctx.config.json'), JSON.stringify({
    projectName: 'plugin-test',
    plugins
  }));
}

function writePlugin(dir, name, body) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, body);
  return './' + name;
}

describe('plugin loader', () => {
  let testDir;
  const originalAdapterTypes = new Set();

  beforeAll(() => {
    for (const t of defaultRegistry.types) originalAdapterTypes.add(t);
  });

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codectx-plugin-'));
    _resetPluginState();
    _clearCache();
  });

  afterEach(() => {
    _resetPluginState();
    _clearCache();
    // Remove plugin-added adapters so each test starts from builtin baseline.
    for (const t of [...defaultRegistry.types]) {
      if (!originalAdapterTypes.has(t)) defaultRegistry.adapters.delete(t);
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('no plugins configured → state stays empty', () => {
    writeConfig(testDir, []);
    initPlugins(testDir);
    expect(getState().plugins).toEqual([]);
    expect(getState().errors).toEqual([]);
  });

  test('loads adapter from a local plugin and makes it available via defaultRegistry', () => {
    const pluginPath = writePlugin(testDir, 'p.js', `
      const { BaseAdapter } = require('${path.resolve(__dirname, '../../src/plugins/loader.js').replace(/\\/g, '/')}');
      class CustomAdapter extends BaseAdapter {
        get type() { return 'custom-stack'; }
        detect(pkg) { return !!(pkg && pkg.dependencies && pkg.dependencies['custom-stack']); }
        get scanPatterns() { return ['custom/**/*.ts']; }
      }
      module.exports = { name: 'p', adapters: [CustomAdapter] };
    `);
    writeConfig(testDir, [pluginPath]);

    initPlugins(testDir);

    expect(defaultRegistry.types).toContain('custom-stack');
    expect(defaultRegistry.detect({ dependencies: { 'custom-stack': '1.0.0' } }, [])).toBe('custom-stack');
  });

  test('merges scenarios; plugin id can override a builtin', () => {
    const pluginPath = writePlugin(testDir, 'p.js', `
      module.exports = {
        name: 'p',
        scenarios: [
          { id: 'Z', name: 'NewScenario', description: 'd', keywords: ['z-key'], template: 't' },
          { id: 'A', name: 'OverrideA', description: 'overridden', keywords: ['a-override'], template: 't' }
        ]
      };
    `);
    writeConfig(testDir, [pluginPath]);
    initPlugins(testDir);

    const scenarios = getScenarios();
    expect(scenarios.find(s => s.id === 'Z')).toMatchObject({ name: 'NewScenario' });
    expect(scenarios.find(s => s.id === 'A')).toMatchObject({ name: 'OverrideA' });
  });

  test('filterSensitive picks up plugin patterns', () => {
    const pluginPath = writePlugin(testDir, 'p.js', `
      module.exports = {
        name: 'p',
        sensitivePatterns: [{ pattern: /myorg-secret-[A-Z]+/g, replacement: '[FILTERED:myorg]' }]
      };
    `);
    writeConfig(testDir, [pluginPath]);
    initPlugins(testDir);

    const { content } = filterSensitive('see myorg-secret-ABCDEF here');
    expect(content).toContain('[FILTERED:myorg]');
  });

  test('scanDirectory picks up plugin detection patterns', () => {
    const pluginPath = writePlugin(testDir, 'p.js', `
      module.exports = {
        name: 'p',
        sensitiveDetectionPatterns: [{ regex: /myorg-secret/i, name: 'myorg_secret' }]
      };
    `);
    writeConfig(testDir, [pluginPath]);
    initPlugins(testDir);

    const docsDir = path.join(testDir, 'ai-docs');
    fs.mkdirSync(docsDir);
    fs.writeFileSync(path.join(docsDir, 'doc.md'), 'something myorg-secret stuff');

    const warnings = scanDirectory(docsDir);
    expect(warnings.some(w => w.field === 'myorg_secret')).toBe(true);
  });

  test('plugin load failure does not crash and is recorded', () => {
    const pluginPath = writePlugin(testDir, 'broken.js', `throw new Error('boom');`);
    writeConfig(testDir, [pluginPath]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      initPlugins(testDir);
      expect(getState().errors.length).toBe(1);
      expect(getState().errors[0].error).toMatch(/boom/);
      // Builtin filtering still works.
      const { content } = filterSensitive('password = "abc"');
      expect(content).toContain('[FILTERED]');
    } finally {
      warn.mockRestore();
    }
  });

  test('invalid adapter shape is rejected as an error', () => {
    const pluginPath = writePlugin(testDir, 'bad.js', `
      module.exports = { name: 'bad', adapters: [{ notAnAdapter: true }] };
    `);
    writeConfig(testDir, [pluginPath]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      initPlugins(testDir);
      expect(getState().errors.length).toBe(1);
      expect(getState().errors[0].error).toMatch(/适配器无效/);
    } finally {
      warn.mockRestore();
    }
  });

  test('plugin exporting a factory function is invoked', () => {
    const pluginPath = writePlugin(testDir, 'factory.js', `
      module.exports = () => ({
        name: 'factory',
        scenarios: [{ id: 'F', name: 'FromFactory' }]
      });
    `);
    writeConfig(testDir, [pluginPath]);
    initPlugins(testDir);
    expect(getScenarios().find(s => s.id === 'F')).toMatchObject({ name: 'FromFactory' });
  });

  test('re-init with same signature is a no-op', () => {
    const pluginPath = writePlugin(testDir, 'p.js', `
      module.exports = { name: 'p', scenarios: [{ id: 'Q', name: 'Q1' }] };
    `);
    writeConfig(testDir, [pluginPath]);
    initPlugins(testDir);
    const first = getState();
    initPlugins(testDir);
    const second = getState();
    expect(second.plugins.length).toBe(first.plugins.length);
    expect(second.plugins[0].name).toBe('p');
  });
});
