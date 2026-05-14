const { readFileUTF8 } = require('../../src/utils/file-reader');
const fs = require('fs');
const path = require('path');

describe('readFileUTF8', () => {
  const testDir = path.join(__dirname, '../fixtures/file-reader-test');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should read UTF-8 file correctly', () => {
    const filePath = path.join(testDir, 'utf8.txt');
    fs.writeFileSync(filePath, 'Hello World', 'utf8');
    expect(readFileUTF8(filePath)).toBe('Hello World');
  });

  test('should read GBK file correctly', () => {
    const filePath = path.join(testDir, 'gbk.txt');
    const iconv = require('iconv-lite');
    const buffer = iconv.encode('你好世界', 'gbk');
    fs.writeFileSync(filePath, buffer);
    expect(readFileUTF8(filePath)).toBe('你好世界');
  });

  test('should read empty file correctly', () => {
    const filePath = path.join(testDir, 'empty.txt');
    fs.writeFileSync(filePath, '', 'utf8');
    expect(readFileUTF8(filePath)).toBe('');
  });

  test('should throw meaningful error for non-existent file', () => {
    const filePath = path.join(testDir, 'nonexistent.txt');
    expect(() => readFileUTF8(filePath)).toThrow('File not found');
  });
});
