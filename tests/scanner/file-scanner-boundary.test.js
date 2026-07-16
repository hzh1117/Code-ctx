// scanProject / estimateTokens 边界用例
// 现有 tests/scanner/file-scanner.test.js 覆盖了各 projectType 的扫描，
// 本文件补错误分支、限流分支、estimateTokens。

const fs = require('fs');
const path = require('path');
const os = require('os');
const { scanProject, scanProjectAsync, estimateTokens } = require('../../src/scanner/file-scanner');

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scan-bound-'));
}

describe('scanProject — 错误分支', () => {
  test('目录不存在时抛错', () => {
    const ghost = path.join(os.tmpdir(), 'ghost-' + Date.now());
    expect(() => scanProject(ghost, 'react')).toThrow(/does not exist/);
  });

  test('路径指向文件而非目录时抛错', () => {
    const dir = createTmpDir();
    const file = path.join(dir, 'not-a-dir.txt');
    fs.writeFileSync(file, 'x');
    try {
      expect(() => scanProject(file, 'react')).toThrow(/does not exist/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('scanProject — 限流分支', () => {
  test('文件数超过 maxFiles 时调用 prioritizeFiles 截断', () => {
    const dir = createTmpDir();
    fs.mkdirSync(path.join(dir, 'src/components'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src/pages'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src/hooks'), { recursive: true });
    try {
      // 创建 30 个文件（patterns 涵盖：App.* / components/**/* / pages/**/* / hooks/**/*）
      for (let i = 0; i < 10; i++) {
        fs.writeFileSync(path.join(dir, `src/components/C${i}.jsx`), `export default () => null;`);
        fs.writeFileSync(path.join(dir, `src/pages/P${i}.jsx`), `export default () => null;`);
        fs.writeFileSync(path.join(dir, `src/hooks/h${i}.js`), `export default () => null;`);
      }
      fs.writeFileSync(path.join(dir, 'src/App.jsx'), 'export default () => null;');

      const result = scanProject(dir, 'react', { maxFiles: 5, maxTokens: 1000000 });
      expect(result.keyFiles.length).toBeLessThanOrEqual(5);
      expect(result.totalFiles).toBeGreaterThan(5);
      // App.jsx 优先级高，应被保留
      expect(result.keyFiles.some(f => f.endsWith('App.jsx'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('内容超过 maxTokens 时提前 break，至少保留 1 个文件', () => {
    const dir = createTmpDir();
    fs.mkdirSync(path.join(dir, 'src/components'), { recursive: true });
    try {
      const huge = 'x'.repeat(200000); // 远超 maxTokens
      for (let i = 0; i < 5; i++) {
        fs.writeFileSync(path.join(dir, `src/components/Big${i}.jsx`), huge);
      }

      const result = scanProject(dir, 'react', { maxFiles: 100, maxTokens: 100 });
      // 由于第一个文件已经超 maxTokens 但 resultFiles 为空，会保留它，
      // 后续文件应 break
      expect(result.keyFiles.length).toBeGreaterThanOrEqual(1);
      expect(result.keyFiles.length).toBeLessThan(5);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('limitByTokens 跳过 readFileSync 抛错的文件', () => {
    const dir = createTmpDir();
    fs.mkdirSync(path.join(dir, 'src/components'), { recursive: true });
    try {
      const goodFile = path.join(dir, 'src/components/Good.jsx');
      const badFile = path.join(dir, 'src/components/Bad.jsx');
      fs.writeFileSync(goodFile, 'export default () => null;');
      fs.writeFileSync(badFile, 'export default () => null;');

      // spy 让 Bad.jsx 的 readFileSync 抛错
      const realRead = jest.requireActual('fs').readFileSync;
      const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((p, opts) => {
        if (typeof p === 'string' && p === badFile) {
          throw new Error('EACCES');
        }
        return realRead(p, opts);
      });

      try {
        const result = scanProject(dir, 'react');
        const fileNames = result.keyFiles.map(f => path.basename(f));
        expect(fileNames).toContain('Good.jsx');
        // Bad.jsx 在 limitByTokens 阶段被跳过
        expect(fileNames).not.toContain('Bad.jsx');
      } finally {
        spy.mockRestore();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('limitByTokens 跳过 glob 后已被删除的文件（!existsSync 分支）', () => {
    const dir = createTmpDir();
    fs.mkdirSync(path.join(dir, 'src/components'), { recursive: true });
    try {
      const realExists = jest.requireActual('fs').existsSync;
      const target = path.join(dir, 'src/components/Ghost.jsx');
      fs.writeFileSync(target, 'export default () => null;');
      fs.writeFileSync(path.join(dir, 'src/components/Keep.jsx'), 'export default () => null;');

      // glob 已经收集到 Ghost.jsx，但 limitByTokens 时 existsSync 返回 false
      const spy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (p === target) return false;
        return realExists(p);
      });

      try {
        const result = scanProject(dir, 'react');
        const names = result.keyFiles.map(f => path.basename(f));
        expect(names).toContain('Keep.jsx');
        expect(names).not.toContain('Ghost.jsx');
      } finally {
        spy.mockRestore();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('estimateTokens', () => {
  test('多个文件累加 token', () => {
    const dir = createTmpDir();
    try {
      const a = path.join(dir, 'a.js');
      const b = path.join(dir, 'b.js');
      fs.writeFileSync(a, 'console.log("hello world")');
      fs.writeFileSync(b, 'export default function foo() { return 1; }');
      const tokens = estimateTokens([a, b]);
      expect(tokens).toBeGreaterThan(0);
      expect(Number.isInteger(tokens)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('跳过不存在的文件', () => {
    const dir = createTmpDir();
    try {
      const real = path.join(dir, 'real.js');
      const ghost = path.join(dir, 'ghost.js');
      fs.writeFileSync(real, 'x'.repeat(100));
      const both = estimateTokens([real, ghost]);
      const onlyReal = estimateTokens([real]);
      expect(both).toBe(onlyReal); // ghost 被跳过，结果相等
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('跳过 readFileSync 抛错的文件', () => {
    const dir = createTmpDir();
    const file = path.join(dir, 'unreadable.js');
    fs.writeFileSync(file, 'content');

    const realRead = jest.requireActual('fs').readFileSync;
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((p, opts) => {
      if (p === file) throw new Error('EACCES');
      return realRead(p, opts);
    });

    try {
      const tokens = estimateTokens([file]);
      expect(tokens).toBe(0);
    } finally {
      spy.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('空数组返回 0', () => {
    expect(estimateTokens([])).toBe(0);
  });
});

describe('scanProjectAsync budgets', () => {
  test('yields the event loop and reports byte-budget skips', async () => {
    const dir = createTmpDir();
    try {
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), '{}');
      fs.writeFileSync(path.join(dir, 'src', 'large.js'), 'x'.repeat(10000));
      fs.writeFileSync(path.join(dir, 'src', 'small.js'), 'export const small = true;');
      let eventLoopAdvanced = false;
      setImmediate(() => { eventLoopAdvanced = true; });

      const result = await scanProjectAsync(dir, 'generic-js-ts', {
        maxScanBytes: 100,
        maxSampleBytesPerFile: 1000,
        ioConcurrency: 2
      });

      expect(eventLoopAdvanced).toBe(true);
      expect(result.scanBudget.sampledBytes).toBeLessThanOrEqual(100);
      expect(result.scanBudget.skipped).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason: 'byte-budget' })
      ]));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
