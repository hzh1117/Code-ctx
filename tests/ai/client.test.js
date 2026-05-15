const http = require('http');
const {
  generateWithAI,
  generateWithContinuation,
  validateBaseUrl,
  validateResolvedBaseUrl,
  normalizeAnthropicMessages
} = require('../../src/ai/client');

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
        maxTokens: 10,
        allowLocalBaseUrl: true,
        allowInsecureBaseUrl: true
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
        maxTokens: 10,
        allowLocalBaseUrl: true,
        allowInsecureBaseUrl: true
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
        allowLocalBaseUrl: true,
        allowInsecureBaseUrl: true,
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

  test('should reject local and private AI base URLs by default', () => {
    expect(() => validateBaseUrl('http://127.0.0.1:3000/v1')).toThrow(/https|localhost|内网|metadata/);
    expect(() => validateBaseUrl('https://localhost/v1')).toThrow(/localhost|内网|metadata/);
    expect(() => validateBaseUrl('https://10.0.0.8/v1')).toThrow(/localhost|内网|metadata/);
    expect(() => validateBaseUrl('https://169.254.169.254/latest')).toThrow(/localhost|内网|metadata/);
  });

  test('should allow explicit local insecure URLs for tests and local debugging', () => {
    const url = validateBaseUrl('http://127.0.0.1:3000/v1/', {
      allowLocalBaseUrl: true,
      allowInsecureBaseUrl: true
    });

    expect(url.toString()).toBe('http://127.0.0.1:3000/v1');
  });

  test('should reject hostnames that resolve to private addresses', async () => {
    const url = validateBaseUrl('https://ai-proxy.example.com/v1');

    await expect(validateResolvedBaseUrl(url, {
      dnsLookup: async () => [{ address: '10.0.0.5', family: 4 }]
    })).rejects.toThrow(/DNS|localhost|内网|metadata/);
  });

  test('should allow public resolved AI base URLs', async () => {
    const url = validateBaseUrl('https://api.example.com/v1');

    await expect(validateResolvedBaseUrl(url, {
      dnsLookup: async () => [{ address: '8.8.8.8', family: 4 }]
    })).resolves.toBeUndefined();
  });

  test('should normalize Anthropic system messages into top-level system field', () => {
    const result = normalizeAnthropicMessages([
      { role: 'system', content: 'Use concise Chinese.' },
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好，有什么可以帮你？' }
    ]);

    expect(result).toEqual({
      system: 'Use concise Chinese.',
      messages: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好，有什么可以帮你？' }
      ]
    });
  });

  test('should send Anthropic system prompt outside messages', async () => {
    const requests = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        requests.push(JSON.parse(body));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }));
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    try {
      const { port } = server.address();
      await generateWithContinuation('write docs', {
        apiKey: 'key',
        protocol: 'anthropic',
        baseUrl: `http://127.0.0.1:${port}/v1`,
        model: 'test-model',
        maxTokens: 10,
        maxContinuations: 0,
        systemPrompt: 'You are concise.',
        allowLocalBaseUrl: true,
        allowInsecureBaseUrl: true
      });

      expect(requests).toHaveLength(1);
      expect(requests[0].system).toBe('You are concise.');
      expect(requests[0].messages.every(message => message.role !== 'system')).toBe(true);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
