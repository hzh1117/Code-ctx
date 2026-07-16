const fs = require('fs');
const os = require('os');
const path = require('path');
const { createIgnoreEngine } = require('../../src/utils/ignore-engine');
const { _clearCache } = require('../../src/utils/config');

describe('ignore engine', () => {
  let rootDir;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-ctx-ignore-'));
  });

  afterEach(() => {
    _clearCache();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('merges defaults, gitignore and configured excludeDirs', () => {
    fs.writeFileSync(path.join(rootDir, '.gitignore'), [
      'generated/*',
      '!generated/keep.js'
    ].join('\n'));
    fs.writeFileSync(path.join(rootDir, 'code-ctx.config.json'), JSON.stringify({
      excludeDirs: ['vendor-cache']
    }));

    const engine = createIgnoreEngine(rootDir);

    expect(engine.ignores('node_modules/pkg/index.js')).toBe(true);
    expect(engine.ignores('src/vendor-cache/value.js')).toBe(true);
    expect(engine.ignores('generated/drop.js')).toBe(true);
    expect(engine.ignores('generated/keep.js')).toBe(false);
    expect(engine.ignores('src/index.js')).toBe(false);
  });
});
