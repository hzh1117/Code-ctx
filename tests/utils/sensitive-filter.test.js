const { filterSensitive } = require('../../src/utils/sensitive-filter');

describe('filterSensitive', () => {
  test('should redact password', () => {
    const input = 'password = "secret123"';
    const result = filterSensitive(input);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('secret123');
  });

  test('should redact api key', () => {
    const input = 'api_key: sk-1234567890';
    const result = filterSensitive(input);
    expect(result).toContain('[REDACTED]');
  });

  test('should keep normal content', () => {
    const input = 'This is normal content';
    const result = filterSensitive(input);
    expect(result).toBe(input);
  });
});
