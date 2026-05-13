const { filterSensitive } = require('../../src/utils/sensitive-filter');

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
    const input = 'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
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
    expect(content).toContain('=[FILTERED]');
    expect(content).not.toContain('supersecretvalue123');
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
});
