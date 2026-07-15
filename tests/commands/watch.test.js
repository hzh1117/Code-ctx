const { EventEmitter } = require('events');
const path = require('path');

jest.mock('fs');
jest.mock('../../src/commands/update', () => ({
  updateCommand: jest.fn(),
  executeUpdateTransaction: jest.fn()
}));
jest.mock('../../src/utils/config', () => ({
  getAIConfig: jest.fn()
}));
jest.mock('../../src/template/engine', () => ({
  clearCache: jest.fn()
}));

const fs = require('fs');
const { watchCommand } = require('../../src/commands/watch');
const { updateCommand, executeUpdateTransaction } = require('../../src/commands/update');
const { getAIConfig } = require('../../src/utils/config');

describe('commands/watch', () => {
  let watchCallbacks;
  let watchers;
  let exitSpy;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    watchCallbacks = [];
    watchers = [];

    fs.readdirSync = jest.fn().mockReturnValue([
      { name: 'src', isDirectory: () => true },
      { name: 'tests', isDirectory: () => true },
      { name: 'node_modules', isDirectory: () => true },
      { name: '.git', isDirectory: () => true },
      { name: '.hidden', isDirectory: () => true },
      { name: 'README.md', isDirectory: () => false }
    ]);

    fs.watch = jest.fn().mockImplementation((dirPath, opts, cb) => {
      watchCallbacks.push({ dirPath, cb });
      const watcher = new EventEmitter();
      watcher.close = jest.fn();
      watchers.push(watcher);
      return watcher;
    });

    updateCommand.mockResolvedValue({ changedFiles: [], sectionUpdates: [] });
    executeUpdateTransaction.mockResolvedValue({ success: 0, failed: 0, skipped: 0, committed: true });
    getAIConfig.mockReturnValue({ apiKey: 'test-key' });

    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    process.removeAllListeners('SIGINT');
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('启动监听非忽略子目录', () => {
    watchCommand('/project', { debounce: 100 });

    const watchedDirs = fs.watch.mock.calls.map(call => call[0]);
    expect(watchedDirs).toEqual(expect.arrayContaining([
      path.join('/project', 'src'),
      path.join('/project', 'tests')
    ]));
    expect(watchedDirs).not.toContain(path.join('/project', 'node_modules'));
    expect(watchedDirs).not.toContain(path.join('/project', '.git'));
    expect(watchedDirs).not.toContain(path.join('/project', '.hidden'));
  });

  test('文件变化经过防抖后触发 update', async () => {
    watchCommand('/project', { debounce: 100 });

    const srcWatchCall = fs.watch.mock.calls.find(c => c[0].endsWith('src'));
    expect(srcWatchCall).toBeDefined();
    const watchCb = srcWatchCall[2];

    watchCb('change', 'App.js');
    expect(updateCommand).not.toHaveBeenCalled();

    jest.advanceTimersByTime(150);
    await Promise.resolve();
    expect(updateCommand).toHaveBeenCalledWith('/project', { dryRun: false });
  });

  test('防抖合并多次快速变化为一次调用', async () => {
    watchCommand('/project', { debounce: 100 });
    const watchCb = fs.watch.mock.calls.find(c => c[0].endsWith('src'))[2];

    watchCb('change', 'a.js');
    watchCb('change', 'b.js');
    watchCb('change', 'c.js');

    jest.advanceTimersByTime(150);
    await Promise.resolve();

    expect(updateCommand).toHaveBeenCalledTimes(1);
  });

  test('忽略 node_modules / .git / dist / build / ai-docs 内的变化', async () => {
    watchCommand('/project', { debounce: 100 });
    const watchCb = fs.watch.mock.calls.find(c => c[0].endsWith('src'))[2];

    // filePath 形如 path.join('src', 'node_modules/file.js')，包含 'node_modules' 部分
    watchCb('change', path.join('node_modules', 'pkg', 'index.js'));
    jest.advanceTimersByTime(150);
    await Promise.resolve();

    expect(updateCommand).not.toHaveBeenCalled();
  });

  test('autoApply=true 时自动执行 update transaction', async () => {
    updateCommand.mockResolvedValue({
      changedFiles: ['src/App.js'],
      sectionUpdates: [{ section: 'overview' }]
    });

    watchCommand('/project', { debounce: 100, autoApply: true });
    const watchCb = fs.watch.mock.calls.find(c => c[0].endsWith('src'))[2];
    watchCb('change', 'App.js');

    jest.advanceTimersByTime(150);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(executeUpdateTransaction).toHaveBeenCalledWith('/project', expect.any(Object), { apiKey: 'test-key' });
  });

  test('autoApply=false 时不执行 update transaction', async () => {
    updateCommand.mockResolvedValue({
      changedFiles: ['src/App.js'],
      sectionUpdates: [{ section: 'overview' }]
    });

    watchCommand('/project', { debounce: 100, autoApply: false });
    const watchCb = fs.watch.mock.calls.find(c => c[0].endsWith('src'))[2];
    watchCb('change', 'App.js');

    jest.advanceTimersByTime(150);
    await Promise.resolve();
    await Promise.resolve();

    expect(executeUpdateTransaction).not.toHaveBeenCalled();
  });

  test('fs.watch 抛错时不中断整体监听', () => {
    fs.watch.mockImplementationOnce(() => {
      throw new Error('EACCES');
    });

    expect(() => watchCommand('/project', { debounce: 100 })).not.toThrow();
    // 后续目录仍然成功 watch
    expect(fs.watch.mock.calls.length).toBeGreaterThan(1);
  });

  test('updateCommand 抛错时被捕获且打印错误', async () => {
    updateCommand.mockRejectedValue(new Error('boom'));

    watchCommand('/project', { debounce: 100 });
    const watchCb = fs.watch.mock.calls.find(c => c[0].endsWith('src'))[2];
    watchCb('change', 'App.js');

    jest.advanceTimersByTime(150);
    // 等待所有微任务
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  test('SIGINT 信号关闭所有 watcher', () => {
    watchCommand('/project', { debounce: 100 });
    expect(watchers.length).toBeGreaterThan(0);

    process.emit('SIGINT');

    for (const w of watchers) {
      expect(w.close).toHaveBeenCalled();
    }
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('未传 filename 时不触发处理', () => {
    watchCommand('/project', { debounce: 100 });
    const watchCb = fs.watch.mock.calls.find(c => c[0].endsWith('src'))[2];

    watchCb('change', null);
    jest.advanceTimersByTime(200);

    expect(updateCommand).not.toHaveBeenCalled();
  });
});
