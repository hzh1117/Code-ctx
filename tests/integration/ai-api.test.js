const { generateWithAI } = require('../../src/ai/client');

describe('AI API Integration', () => {
  test('should throw error without API key', async () => {
    await expect(generateWithAI('test', { protocol: 'openai' }))
      .rejects.toThrow('API key');
  });

  test('should throw error for unsupported protocol', async () => {
    await expect(generateWithAI('test', { apiKey: 'key', protocol: 'unsupported' }))
      .rejects.toThrow('不支持的协议');
  });
});
