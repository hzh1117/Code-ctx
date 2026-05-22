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
});
