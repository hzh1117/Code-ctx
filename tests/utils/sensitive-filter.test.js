const fs = require('fs');
const os = require('os');
const path = require('path');
const { filterSensitive, scanDirectory } = require('../../src/utils/sensitive-filter');

describe('filterSensitive', () => {
  test('should redact password', () => {
    const input = 'password = "secret123"';
    const { content, count } = filterSensitive(input);
    expect(content).toContain('[FILTERED]');
    expect(content).not.toContain('secret123');
    expect(count).toBe(1);
  });

  test('should redact api key', () => {
    const input = 'api_key: sk-1234567890';
    const { content, count } = filterSensitive(input);
    expect(content).toContain('[FILTERED]');
    expect(count).toBe(1);
  });

  test('should keep normal content', () => {
    const input = 'This is normal content';
    const { content, count } = filterSensitive(input);
    expect(content).toBe(input);
    expect(count).toBe(0);
  });

  test('should filter JWT token', () => {
    const input =
      'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const { content, count } = filterSensitive(input);
    expect(content).toContain('[FILTERED]');
    expect(content).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(count).toBe(2);
  });

  test('should filter AWS Access Key', () => {
    const input = 'key = AKIAIOSFODNN7EXAMPLE';
    const { content, count } = filterSensitive(input);
    expect(content).toContain('[FILTERED]');
    expect(content).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(count).toBe(1);
  });

  test('should filter Bearer token', () => {
    const input = 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123';
    const { content, count } = filterSensitive(input);
    expect(content).toContain('Bearer [FILTERED]');
    expect(content).not.toContain('abcdefghijklmnopqrstuvwxyz0123');
    expect(count).toBe(1);
  });

  test('should filter URL key parameter', () => {
    const input = 'https://api.example.com/data?token=supersecretvalue123';
    const { content, count } = filterSensitive(input);
    expect(content).toBe('https://api.example.com/data?token=[FILTERED]');
    expect(content).not.toContain('supersecretvalue123');
    expect(count).toBe(1);
  });

  test('should keep URL parameter separator while filtering multiple secret params', () => {
    const input = 'https://api.example.com/data?token=supersecretvalue123&api_key=anothersecret456&safe=1';
    const { content, count } = filterSensitive(input);
    expect(content).toBe('https://api.example.com/data?token=[FILTERED]&api_key=[FILTERED]&safe=1');
    expect(count).toBe(2);
  });

  test('should filter connection string', () => {
    const input = 'mongodb://admin:password123@db.example.com:27017/mydb';
    const { content, count } = filterSensitive(input);
    expect(content).toContain('mongodb://[FILTERED]');
    expect(content).not.toContain('admin:password123');
    expect(count).toBe(1);
  });

  test('should count multiple sensitive items', () => {
    const input = 'password = "abc"\napi_key: sk-1234567890\nsecret="xyz"';
    const { content, count } = filterSensitive(input);
    expect(count).toBe(3);
    expect(content).not.toContain('abc');
    expect(content).not.toContain('sk-1234567890');
    expect(content).not.toContain('xyz');
  });

  test('supports caller-provided redaction patterns', () => {
    const { content, count } = filterSensitive('credential=custom-value', [
      { pattern: /credential=[^\s]+/, replacement: 'credential=[FILTERED]' }
    ]);

    expect(content).toBe('credential=[FILTERED]');
    expect(count).toBe(1);
  });

  test('scans markdown files and ignores other file types', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-ctx-sensitive-'));
    try {
      fs.writeFileSync(path.join(dir, 'safe.txt'), 'password=ignored');
      fs.writeFileSync(path.join(dir, 'context.md'), 'api_key=supersecretvalue');

      expect(scanDirectory(dir)).toEqual([{ file: 'context.md', field: 'api_key' }]);
      expect(scanDirectory(path.join(dir, 'missing'))).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
