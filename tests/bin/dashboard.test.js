const fs = require('fs');
const os = require('os');
const path = require('path');
const dashboard = require('../../bin/commands/dashboard');

describe('dashboard command helpers', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-ctx-dashboard-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('prefers the JSON config and falls back to the legacy JS config', () => {
    const jsonPath = path.join(testDir, 'code-ctx.config.json');
    const jsPath = path.join(testDir, 'code-ctx.config.js');

    expect(dashboard.resolveConfigPath(testDir)).toBe(jsonPath);

    fs.writeFileSync(jsPath, 'module.exports = {};\n');
    expect(dashboard.resolveConfigPath(testDir)).toBe(jsPath);

    fs.writeFileSync(jsonPath, '{}\n');
    expect(dashboard.resolveConfigPath(testDir)).toBe(jsonPath);
  });

  test('uses bundled production assets without requiring frontend source files', () => {
    const webDir = path.join(testDir, 'web');
    fs.mkdirSync(path.join(webDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(webDir, 'dist', 'index.html'), '<!doctype html>');

    expect(() => dashboard.ensureDashboardAssets(webDir)).not.toThrow();
    expect(fs.existsSync(path.join(webDir, 'package.json'))).toBe(false);
  });

  test('reports a broken installation when bundled assets and source files are absent', () => {
    const webDir = path.join(testDir, 'web');
    fs.mkdirSync(webDir, { recursive: true });

    expect(() => dashboard.ensureDashboardAssets(webDir)).toThrow('请重新安装 code-ctx');
  });
});
