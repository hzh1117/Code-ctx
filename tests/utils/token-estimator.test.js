const { estimateTokensForContent, evaluatePromptBudget } = require('../../src/utils/token-estimator');

describe('token-estimator', () => {
  test('estimates more tokens for longer text', () => {
    const short = estimateTokensForContent('Hi');
    const long = estimateTokensForContent('a'.repeat(1000));
    expect(long).toBeGreaterThan(short);
  });

  test('Chinese characters cost more than equivalent ASCII letters', () => {
    const en = estimateTokensForContent('a'.repeat(100));
    const cn = estimateTokensForContent('你'.repeat(100));
    expect(cn).toBeGreaterThan(en);
  });

  test('returns at least 1 for non-empty content', () => {
    expect(estimateTokensForContent('x')).toBeGreaterThanOrEqual(1);
  });

  test('returns 0 for empty string', () => {
    expect(estimateTokensForContent('')).toBe(0);
  });

  test('handles mixed English/Chinese/code content', () => {
    const mixed = 'function hello() { return "你好世界"; }';
    const tokens = estimateTokensForContent(mixed);
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(50);
  });

  test('numbers are estimated at ~1 token per 3 digits', () => {
    const digits = estimateTokensForContent('1234567890');
    // 10 digits → ~4 tokens (ceil(10/3))
    expect(digits).toBeGreaterThanOrEqual(3);
    expect(digits).toBeLessThanOrEqual(6);
  });

  test('short words are 1 token each', () => {
    const tokens = estimateTokensForContent('I am a test');
    // 4 short words → ~4 tokens
    expect(tokens).toBeGreaterThanOrEqual(3);
    expect(tokens).toBeLessThanOrEqual(8);
  });

  test('evaluatePromptBudget returns ok below 80% of budget', () => {
    const result = evaluatePromptBudget('a'.repeat(100), 10000);
    expect(result.status).toBe('ok');
    expect(result.estimate).toBeGreaterThan(0);
    expect(result.maxTokens).toBe(10000);
  });

  test('evaluatePromptBudget returns warn above 80% of budget', () => {
    // Find a prompt size that lands in the warn band — use the estimator
    // directly to back-solve to avoid relying on exact constants.
    const sample = 'a'.repeat(1000);
    const sampleTokens = estimateTokensForContent(sample);
    const budget = Math.floor(sampleTokens / 0.85);
    const result = evaluatePromptBudget(sample, budget);
    expect(result.status).toBe('warn');
  });

  test('evaluatePromptBudget returns over when prompt exceeds budget', () => {
    const result = evaluatePromptBudget('a'.repeat(10000), 10);
    expect(result.status).toBe('over');
  });

  test('evaluatePromptBudget handles missing maxTokens gracefully', () => {
    const result = evaluatePromptBudget('abc', null);
    expect(result.status).toBe('ok');
    expect(result.maxTokens).toBe(null);
  });

  test('evaluatePromptBudget handles null prompt', () => {
    const result = evaluatePromptBudget(null, 1000);
    expect(result.status).toBe('ok');
    expect(result.estimate).toBe(0);
  });
});
