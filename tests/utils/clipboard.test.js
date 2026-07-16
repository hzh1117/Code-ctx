const path = require('path');

jest.mock('clipboardy', () => ({
  write: jest.fn(),
  read: jest.fn()
}));
jest.mock('fs');
jest.mock('os');

const clipboardy = require('clipboardy');
const fs = require('fs');
const os = require('os');
const { writeToClipboard } = require('../../src/utils/clipboard');

describe('utils/clipboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    os.tmpdir = jest.fn().mockReturnValue('/tmp');
    fs.writeFileSync = jest.fn();
  });

  test('成功写入剪贴板，读取一致返回 success:true', async () => {
    const content = 'hello world';
    clipboardy.write.mockResolvedValue();
    clipboardy.read.mockResolvedValue(content);

    const result = await writeToClipboard(content);

    expect(clipboardy.write).toHaveBeenCalledWith(content);
    expect(result).toEqual({ success: true });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test('剪贴板写入失败时降级到临时文件', async () => {
    clipboardy.write.mockRejectedValue(new Error('no display'));

    const result = await writeToClipboard('content');

    const expectedPath = path.join('/tmp', '.ai-prompt.md');
    expect(fs.writeFileSync).toHaveBeenCalledWith(expectedPath, 'content');
    expect(result.success).toBe(false);
    expect(result.fallbackPath).toBe(expectedPath);
    expect(result.error).toContain('no display');
  });

  test('剪贴板读回内容不完整时降级到临时文件', async () => {
    const content = 'x'.repeat(100);
    clipboardy.write.mockResolvedValue();
    // 读回长度 < 0.9 * content.length → 视为不完整
    clipboardy.read.mockResolvedValue('x'.repeat(50));

    const result = await writeToClipboard(content);

    expect(fs.writeFileSync).toHaveBeenCalledWith(path.join('/tmp', '.ai-prompt.md'), content);
    expect(result.success).toBe(false);
    expect(result.error).toContain('不完整');
  });

  test('剪贴板读回 0.9 倍长度视为完整', async () => {
    const content = 'x'.repeat(100);
    clipboardy.write.mockResolvedValue();
    clipboardy.read.mockResolvedValue('x'.repeat(91));

    const result = await writeToClipboard(content);

    expect(result).toEqual({ success: true });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test('clipboardy.read 抛错也降级到临时文件', async () => {
    clipboardy.write.mockResolvedValue();
    clipboardy.read.mockRejectedValue(new Error('read fail'));

    const result = await writeToClipboard('content');

    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toContain('read fail');
  });

  test('降级路径基于 os.tmpdir()', async () => {
    os.tmpdir.mockReturnValue('/custom/tmp');
    clipboardy.write.mockRejectedValue(new Error('fail'));

    const result = await writeToClipboard('content');

    expect(result.fallbackPath).toBe(path.join('/custom/tmp', '.ai-prompt.md'));
  });

  test('处理大段长内容（10 万字符）也能正常工作', async () => {
    const longContent = 'a'.repeat(100000);
    clipboardy.write.mockResolvedValue();
    clipboardy.read.mockResolvedValue(longContent);

    const result = await writeToClipboard(longContent);

    expect(clipboardy.write).toHaveBeenCalledWith(longContent);
    expect(result.success).toBe(true);
  });
});
