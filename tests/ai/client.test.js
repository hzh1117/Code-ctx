const { generateWithAI } = require('../../src/ai/client');

describe('generateWithAI', () => {
  test('should throw error without API key', async () => {
    await expect(generateWithAI('test prompt')).rejects.toThrow('API key');
  });
});
