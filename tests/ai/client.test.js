const http = require('http');
const { generateWithAI } = require('../../src/ai/client');

describe('generateWithAI', () => {
  test('should throw error without API key', async () => {
    await expect(generateWithAI('test', { protocol: 'openai' }))
      .rejects.toThrow('API key');
  });

  test('should throw error for unsupported protocol', async () => {
    await expect(generateWithAI('test', { apiKey: 'key', protocol: 'unsupported' }))
      .rejects.toThrow('不支持的协议');
  });

  test('should trim trailing slash before OpenAI chat completions path', async () => {
    const seenPaths = [];
    const server = http.createServer((req, res) => {
      seenPaths.push(req.url);
      req.resume();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    try {
      const { port } = server.address();
      await generateWithAI('test', {
        apiKey: 'key',
        protocol: 'openai',
        baseUrl: `http://127.0.0.1:${port}/v1/`,
        model: 'test-model',
        maxTokens: 10
      });

      expect(seenPaths).toEqual(['/v1/chat/completions']);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('should trim trailing slash before Anthropic messages path', async () => {
    const seenPaths = [];
    const server = http.createServer((req, res) => {
      seenPaths.push(req.url);
      req.resume();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ content: [{ text: 'ok' }] }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    try {
      const { port } = server.address();
      await generateWithAI('test', {
        apiKey: 'key',
        protocol: 'anthropic',
        baseUrl: `http://127.0.0.1:${port}/v1/`,
        model: 'test-model',
        maxTokens: 10
      });

      expect(seenPaths).toEqual(['/v1/messages']);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
