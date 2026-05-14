const http = require('http');
const { generateWithAI, generateWithContinuation } = require('../../src/ai/client');

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

  test('should continue and join responses when marker is present', async () => {
    const requests = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        requests.push(parsed);
        res.setHeader('Content-Type', 'application/json');
        const content = requests.length === 1 ? 'part one <<<CONTINUE>>>' : 'part two';
        res.end(JSON.stringify({ choices: [{ message: { content } }] }));
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    const progress = [];
    try {
      const { port } = server.address();
      const result = await generateWithContinuation('write docs', {
        apiKey: 'key',
        protocol: 'openai',
        baseUrl: `http://127.0.0.1:${port}/v1`,
        model: 'test-model',
        maxTokens: 10,
        maxContinuations: 5,
        onProgress: event => progress.push(event)
      });

      expect(result).toBe('part one part two');
      expect(requests).toHaveLength(2);
      expect(requests[0].messages[0].content).toContain('<<<CONTINUE>>>');
      expect(requests[1].messages).toEqual([
        { role: 'user', content: 'write docs\n\n若回答因长度限制被截断，请在截断位置输出 <<<CONTINUE>>> 标记' },
        { role: 'assistant', content: 'part one <<<CONTINUE>>>' },
        { role: 'user', content: '请从 <<<CONTINUE>>> 处继续，不要重复' }
      ]);
      expect(progress).toEqual([{ attempt: 2, maxAttempts: 5 }]);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
