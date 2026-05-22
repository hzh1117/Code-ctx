const { listPresets, getPreset } = require('../../src/ai/presets');

describe('AI provider presets', () => {
  test('listPresets includes the documented providers', () => {
    const ids = listPresets().map(p => p.id);
    expect(ids).toEqual(expect.arrayContaining(['openai', 'anthropic', 'deepseek', 'kimi', 'minimax']));
  });

  test('each preset has the required shape', () => {
    for (const p of listPresets()) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(['openai', 'anthropic']).toContain(p.protocol);
      expect(p.baseUrl).toMatch(/^https?:\/\//);
      expect(typeof p.model).toBe('string');
      expect(typeof p.maxTokens).toBe('number');
    }
  });

  test('listPresets returns a defensive copy', () => {
    const a = listPresets();
    a[0].baseUrl = 'mutated';
    const b = listPresets();
    expect(b[0].baseUrl).not.toBe('mutated');
  });

  test('getPreset returns null for unknown ids', () => {
    expect(getPreset('nope')).toBeNull();
  });

  test('getPreset returns the named preset', () => {
    const p = getPreset('deepseek');
    expect(p.protocol).toBe('openai');
    expect(p.baseUrl).toContain('deepseek');
  });
});
