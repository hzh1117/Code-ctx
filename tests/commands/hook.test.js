const path = require('path');

jest.mock('fs');
jest.mock('../../src/utils/git-utils', () => ({
  hasGitRepo: jest.fn(),
  getChangedFilesSince: jest.fn(),
  getCurrentCommitHash: jest.fn()
}));

const fs = require('fs');
const { hookCommand } = require('../../src/commands/hook');
const { hasGitRepo } = require('../../src/utils/git-utils');

describe('commands/hook', () => {
  const rootDir = '/project';
  const hooksDir = path.join(rootDir, '.git', 'hooks');
  const hookPath = path.join(hooksDir, 'post-commit');
  const backupPath = hookPath + '.bak';

  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    hasGitRepo.mockReturnValue(true);
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.readFileSync = jest.fn().mockReturnValue('');
    fs.writeFileSync = jest.fn();
    fs.mkdirSync = jest.fn();
    fs.copyFileSync = jest.fn();
    fs.unlinkSync = jest.fn();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('install', () => {
    test('非 git 仓库时打印错误并返回', async () => {
      hasGitRepo.mockReturnValue(false);

      await hookCommand(rootDir, 'install');

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('git'));
    });

    test('hooks 目录不存在时自动创建', async () => {
      fs.existsSync.mockImplementation((p) => false);

      await hookCommand(rootDir, 'install');

      expect(fs.mkdirSync).toHaveBeenCalledWith(hooksDir, { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        hookPath,
        expect.stringContaining('code-ctx'),
        { mode: 0o755 }
      );
    });

    test('hook 不存在时写入新 hook，权限 0o755', async () => {
      fs.existsSync.mockImplementation((p) => p === hooksDir);

      await hookCommand(rootDir, 'install');

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const call = fs.writeFileSync.mock.calls[0];
      expect(call[0]).toBe(hookPath);
      expect(call[2]).toEqual({ mode: 0o755 });
    });

    test('code-ctx hook 已存在时跳过安装', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('# code-ctx post-commit hook\n');

      await hookCommand(rootDir, 'install');

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });

    test('存在其它 hook 时先备份再写入', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('#!/bin/sh\necho other');

      await hookCommand(rootDir, 'install');

      expect(fs.copyFileSync).toHaveBeenCalledWith(hookPath, backupPath);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        hookPath,
        expect.stringContaining('code-ctx'),
        { mode: 0o755 }
      );
    });
  });

  describe('uninstall', () => {
    test('hook 不存在时直接返回', async () => {
      fs.existsSync.mockReturnValue(false);

      await hookCommand(rootDir, 'uninstall');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });

    test('非 code-ctx 的 hook 保留不动', async () => {
      fs.existsSync.mockImplementation((p) => p === hookPath);
      fs.readFileSync.mockReturnValue('# other hook');

      await hookCommand(rootDir, 'uninstall');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    test('有备份时恢复备份并删除备份文件', async () => {
      fs.existsSync.mockImplementation((p) => p === hookPath || p === backupPath);
      fs.readFileSync.mockReturnValue('# code-ctx post-commit hook');

      await hookCommand(rootDir, 'uninstall');

      expect(fs.copyFileSync).toHaveBeenCalledWith(backupPath, hookPath);
      expect(fs.unlinkSync).toHaveBeenCalledWith(backupPath);
    });

    test('无备份时直接删除 hook 文件', async () => {
      fs.existsSync.mockImplementation((p) => p === hookPath);
      fs.readFileSync.mockReturnValue('# code-ctx post-commit hook');

      await hookCommand(rootDir, 'uninstall');

      expect(fs.unlinkSync).toHaveBeenCalledWith(hookPath);
      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });

    test('非 git 仓库时直接返回', async () => {
      hasGitRepo.mockReturnValue(false);

      await hookCommand(rootDir, 'uninstall');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('status (默认分支)', () => {
    test('hook 不存在时打印未安装', async () => {
      fs.existsSync.mockReturnValue(false);

      await hookCommand(rootDir, 'status');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('未安装'));
    });

    test('code-ctx hook 存在时打印已安装', async () => {
      fs.existsSync.mockImplementation((p) => p === hookPath);
      fs.readFileSync.mockReturnValue('# code-ctx post-commit hook');

      await hookCommand(rootDir, 'status');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('已安装'));
    });

    test('非 code-ctx 的 hook 存在时打印来源说明', async () => {
      fs.existsSync.mockImplementation((p) => p === hookPath);
      fs.readFileSync.mockReturnValue('#!/bin/sh\necho hi');

      await hookCommand(rootDir, 'status');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('非 code-ctx'));
    });
  });
});
