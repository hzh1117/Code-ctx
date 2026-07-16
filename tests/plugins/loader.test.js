const fs = require('fs');
const path = require('path');
const os = require('os');

const { initPlugins, _resetPluginState } = require('../../src/plugins/loader');
const { defaultRegistry } = require('../../src/adapters');
const { _clearCache } = require('../../src/utils/config');
const { getState } = require('../../src/plugins/state');
const { filterSensitive, scanDirectory } = require('../../src/utils/sensitive-filter');
const { getScenarios } = require('../../src/template/engine');

function writeConfig(dir, plugins) {
  fs.writeFileSync(
    path.join(dir, 'code-ctx.config.json'),
    JSON.stringify({
      projectName: 'plugin-test',
      plugins
    })
  );
}

function writePlugin(dir, name, body) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, body);
  return './' + name;
}

describe('plugin loader', () => {
  let testDir;
  let originalAllowAll;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codectx-plugin-'));
    _resetPluginState();
    _clearCache();
    // Plugin tests load arbitrary throwaway files from temp dirs that are
    // never going to be in any allowlist; bypass the trust gate for those.
    // The dedicated allowlist tests below toggle this on a per-test basis.
    originalAllowAll = process.env.CODE_CTX_PLUGINS_ALLOW_ALL;
    process.env.CODE_CTX_PLUGINS_ALLOW_ALL = '1';
  });

  afterEach(() => {
    _resetPluginState();
    _clearCache();
    fs.rmSync(testDir, { recursive: true, force: true });
    if (originalAllowAll === undefined) {
      delete process.env.CODE_CTX_PLUGINS_ALLOW_ALL;
    } else {
      process.env.CODE_CTX_PLUGINS_ALLOW_ALL = originalAllowAll;
    }
    delete process.env.CODE_CTX_PLUGINS_ALLOW;
  });

  test('no plugins configured → state stays empty', () => {
    writeConfig(testDir, []);
    initPlugins(testDir);
    expect(getState().plugins).toEqual([]);
    expect(getState().errors).toEqual([]);
  });

  test('loads adapter into the root-scoped registry', () => {
    const pluginPath = writePlugin(
      testDir,
      'p.js',
      `
      const { BaseAdapter } = require('${path.resolve(__dirname, '../../src/plugins/loader.js').replace(/\\/g, '/')}');
      class CustomAdapter extends BaseAdapter {
        get type() { return 'custom-stack'; }
        detect(pkg) { return !!(pkg && pkg.dependencies && pkg.dependencies['custom-stack']); }
        get scanPatterns() { return ['custom/**/*.ts']; }
      }
      module.exports = { name: 'p', adapters: [CustomAdapter] };
    `
    );
    writeConfig(testDir, [pluginPath]);

    const context = initPlugins(testDir);

    expect(context.registry.types).toContain('custom-stack');
    expect(context.registry.detect({ dependencies: { 'custom-stack': '1.0.0' } }, [])).toBe('custom-stack');
    expect(defaultRegistry.types).not.toContain('custom-stack');
  });

  test('merges scenarios; plugin id can override a builtin', () => {
    const pluginPath = writePlugin(
      testDir,
      'p.js',
      `
      module.exports = {
        name: 'p',
        scenarios: [
          { id: 'Z', name: 'NewScenario', description: 'd', keywords: ['z-key'], template: 't' },
          { id: 'A', name: 'OverrideA', description: 'overridden', keywords: ['a-override'], template: 't' }
        ]
      };
    `
    );
    writeConfig(testDir, [pluginPath]);
    initPlugins(testDir);

    const scenarios = getScenarios();
    expect(scenarios.find(s => s.id === 'Z')).toMatchObject({ name: 'NewScenario' });
    expect(scenarios.find(s => s.id === 'A')).toMatchObject({ name: 'OverrideA' });
  });

  test('filterSensitive picks up plugin patterns', () => {
    const pluginPath = writePlugin(
      testDir,
      'p.js',
      `
      module.exports = {
        name: 'p',
        sensitivePatterns: [{ pattern: /myorg-secret-[A-Z]+/g, replacement: '[FILTERED:myorg]' }]
      };
    `
    );
    writeConfig(testDir, [pluginPath]);
    initPlugins(testDir);

    const { content } = filterSensitive('see myorg-secret-ABCDEF here');
    expect(content).toContain('[FILTERED:myorg]');
  });

  test('scanDirectory picks up plugin detection patterns', () => {
    const pluginPath = writePlugin(
      testDir,
      'p.js',
      `
      module.exports = {
        name: 'p',
        sensitiveDetectionPatterns: [{ regex: /myorg-secret/i, name: 'myorg_secret' }]
      };
    `
    );
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
    const pluginPath = writePlugin(
      testDir,
      'bad.js',
      `
      module.exports = { name: 'bad', adapters: [{ notAnAdapter: true }] };
    `
    );
    writeConfig(testDir, [pluginPath]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      initPlugins(testDir);
      expect(getState().errors.length).toBe(1);
      expect(getState().errors[0].error).toMatch(/适配器无效.*BaseAdapter/);
    } finally {
      warn.mockRestore();
    }
  });

  test('validates all plugin adapters before registering any of them', () => {
    const pluginPath = writePlugin(
      testDir,
      'partially-bad.js',
      `
      const { BaseAdapter } = require('${path.resolve(__dirname, '../../src/plugins/loader.js').replace(/\\/g, '/')}');
      class ValidAdapter extends BaseAdapter {
        get type() { return 'must-not-leak'; }
        detect() { return false; }
      }
      module.exports = {
        name: 'partially-bad',
        adapters: [ValidAdapter, { type: 'duck', detect() { return true; } }]
      };
    `
    );
    writeConfig(testDir, [pluginPath]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const context = initPlugins(testDir);
      expect(context.errors).toHaveLength(1);
      expect(context.registry.types).not.toContain('must-not-leak');
      expect(context.registry.types).not.toContain('duck');
    } finally {
      warn.mockRestore();
    }
  });

  test('keeps immutable plugin contributions and registries isolated by root', () => {
    const secondRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codectx-plugin-second-'));
    try {
      const firstPlugin = writePlugin(
        testDir,
        'first.js',
        `
        const { BaseAdapter } = require('${path.resolve(__dirname, '../../src/plugins/loader.js').replace(/\\/g, '/')}');
        module.exports = { name: 'first', adapters: [class extends BaseAdapter {
          get type() { return 'first-only'; }
          detect() { return false; }
        }] };
      `
      );
      const secondPlugin = writePlugin(
        secondRoot,
        'second.js',
        `
        const { BaseAdapter } = require('${path.resolve(__dirname, '../../src/plugins/loader.js').replace(/\\/g, '/')}');
        module.exports = { name: 'second', adapters: [class extends BaseAdapter {
          get type() { return 'second-only'; }
          detect() { return false; }
        }] };
      `
      );
      writeConfig(testDir, [firstPlugin]);
      writeConfig(secondRoot, [secondPlugin]);

      const first = initPlugins(testDir);
      const second = initPlugins(secondRoot);

      expect(first.registry.types).toContain('first-only');
      expect(first.registry.types).not.toContain('second-only');
      expect(second.registry.types).toContain('second-only');
      expect(second.registry.types).not.toContain('first-only');
      expect(Object.isFrozen(first)).toBe(true);
      expect(Object.isFrozen(first.plugins)).toBe(true);
      expect(getState(testDir)).toBe(first);
      expect(getState(secondRoot)).toBe(second);
    } finally {
      fs.rmSync(secondRoot, { recursive: true, force: true });
    }
  });

  test('plugin exporting a factory function is invoked', () => {
    const pluginPath = writePlugin(
      testDir,
      'factory.js',
      `
      module.exports = () => ({
        name: 'factory',
        scenarios: [{ id: 'F', name: 'FromFactory' }]
      });
    `
    );
    writeConfig(testDir, [pluginPath]);
    initPlugins(testDir);
    expect(getScenarios().find(s => s.id === 'F')).toMatchObject({ name: 'FromFactory' });
  });

  test('re-init with same signature is a no-op', () => {
    const pluginPath = writePlugin(
      testDir,
      'p.js',
      `
      module.exports = { name: 'p', scenarios: [{ id: 'Q', name: 'Q1' }] };
    `
    );
    writeConfig(testDir, [pluginPath]);
    initPlugins(testDir);
    const first = getState();
    initPlugins(testDir);
    const second = getState();
    expect(second.plugins.length).toBe(first.plugins.length);
    expect(second.plugins[0].name).toBe('p');
  });

  describe('security gate', () => {
    let warn;

    beforeEach(() => {
      // The dedicated security tests want to exercise the real gate, so
      // turn the global bypass off and re-enable it after each test.
      delete process.env.CODE_CTX_PLUGINS_ALLOW_ALL;
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
      process.env.CODE_CTX_PLUGINS_ALLOW_ALL = '1';
    });

    test('non-TTY unknown plugin is rejected and recorded in state.errors', () => {
      // jest runs without a TTY, so `process.stdin.isTTY` is undefined here.
      const pluginPath = writePlugin(
        testDir,
        'unknown.js',
        `
        module.exports = { name: 'unknown', scenarios: [{ id: 'X', name: 'X' }] };
      `
      );
      writeConfig(testDir, [pluginPath]);
      initPlugins(testDir);
      const errors = getState().errors;
      expect(errors.length).toBe(1);
      expect(errors[0].error).toMatch(/不在信任列表/);
      // No contributions were applied.
      expect(getScenarios().find(s => s.id === 'X')).toBeUndefined();
    });

    test('CODE_CTX_PLUGINS_ALLOW=spec allows that spec', () => {
      const pluginPath = writePlugin(
        testDir,
        'envok.js',
        `
        module.exports = { name: 'envok', scenarios: [{ id: 'E', name: 'Env' }] };
      `
      );
      writeConfig(testDir, [pluginPath]);
      process.env.CODE_CTX_PLUGINS_ALLOW = pluginPath;
      initPlugins(testDir);
      expect(getState().errors).toEqual([]);
      expect(getScenarios().find(s => s.id === 'E')).toMatchObject({ name: 'Env' });
    });

    test('persistent allowlist file admits the plugin', () => {
      const pluginPath = writePlugin(
        testDir,
        'persisted.js',
        `
        module.exports = { name: 'persisted', scenarios: [{ id: 'P', name: 'Persist' }] };
      `
      );
      writeConfig(testDir, [pluginPath]);

      // Point the user allowlist at a temp path so we don't touch the real
      // ~/.code-ctx directory during tests.
      const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codectx-home-'));
      const allowlistFile = path.join(fakeHome, '.code-ctx', 'allowed-plugins.json');
      fs.mkdirSync(path.dirname(allowlistFile), { recursive: true });
      fs.writeFileSync(allowlistFile, JSON.stringify([pluginPath]));

      const origHome = os.homedir;
      jest.spyOn(os, 'homedir').mockReturnValue(fakeHome);
      try {
        initPlugins(testDir);
        expect(getState().errors).toEqual([]);
        expect(getScenarios().find(s => s.id === 'P')).toMatchObject({ name: 'Persist' });
      } finally {
        os.homedir = origHome;
        fs.rmSync(fakeHome, { recursive: true, force: true });
      }
    });

    test('CODE_CTX_PLUGINS_ALLOW_ALL=1 bypasses the gate', () => {
      const pluginPath = writePlugin(
        testDir,
        'bypass.js',
        `
        module.exports = { name: 'bypass', scenarios: [{ id: 'B', name: 'Bypass' }] };
      `
      );
      writeConfig(testDir, [pluginPath]);
      process.env.CODE_CTX_PLUGINS_ALLOW_ALL = '1';
      initPlugins(testDir);
      expect(getState().errors).toEqual([]);
      expect(getScenarios().find(s => s.id === 'B')).toMatchObject({ name: 'Bypass' });
    });
  });
});
