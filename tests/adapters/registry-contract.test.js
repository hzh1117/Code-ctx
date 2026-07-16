const path = require('path');
const { loadBuiltinAdapters } = require('../../src/adapters');
const { buildInitPrompt } = require('../../src/generator/prompt-builder');

describe('adapter extension contracts', () => {
  test('every builtin exposes consumable key files and prompt hints', () => {
    const registry = loadBuiltinAdapters();

    for (const type of registry.types) {
      expect(typeof registry.getPromptHints(type)).toBe('string');
      const keyFiles = registry.extractKeyFiles(type, path.resolve('fixture-project'));
      expect(Array.isArray(keyFiles)).toBe(true);
      keyFiles.forEach(file => expect(path.isAbsolute(file)).toBe(true));
    }
  });

  test('unknown adapters use empty extension values', () => {
    const registry = loadBuiltinAdapters();
    expect(registry.getPromptHints('missing')).toBe('');
    expect(registry.extractKeyFiles('missing', process.cwd())).toEqual([]);
  });

  test('adapter hints are included in initialization prompts', () => {
    const prompt = buildInitPrompt({
      project: { name: 'app', type: 'react', path: '.' },
      scanResult: {
        tree: 'src/',
        keyFiles: [],
        promptHints: 'Inspect custom hook boundaries.'
      }
    });

    expect(prompt).toContain('技术栈分析提示');
    expect(prompt).toContain('Inspect custom hook boundaries.');
  });
});
