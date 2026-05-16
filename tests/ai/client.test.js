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

  test('should reject 0.0.0.0', () => {
    expect(() => validateBaseUrl('https://0.0.0.0/v1')).toThrow(/localhost|内网|metadata/);
  });

  test('should reject IPv6 loopback ::1', () => {
    expect(() => validateBaseUrl('https://[::1]/v1')).toThrow(/localhost|内网|metadata/);
  });

  test('should reject 172.16-31.x private range', () => {
    expect(() => validateBaseUrl('https://172.16.0.1/v1')).toThrow(/localhost|内网|metadata/);
    expect(() => validateBaseUrl('https://172.31.255.255/v1')).toThrow(/localhost|内网|metadata/);
  });

  test('should reject 192.168.x private range', () => {
    expect(() => validateBaseUrl('https://192.168.1.1/v1')).toThrow(/localhost|内网|metadata/);
    expect(() => validateBaseUrl('https://192.168.0.100/v1')).toThrow(/localhost|内网|metadata/);
  });

  test('should reject case variations of localhost', () => {
    expect(() => validateBaseUrl('https://LOCALHOST/v1')).toThrow(/localhost|内网|metadata/);
    expect(() => validateBaseUrl('https://LocalHost/v1')).toThrow(/localhost|内网|metadata/);
  });

  test('should reject .localhost suffix', () => {
    expect(() => validateBaseUrl('https://foo.localhost/v1')).toThrow(/localhost|内网|metadata/);
  });

  test('should reject metadata hosts', () => {
    expect(() => validateBaseUrl('https://metadata.google.internal/latest')).toThrow(/localhost|内网|metadata/);
    expect(() => validateBaseUrl('https://metadata/latest')).toThrow(/localhost|内网|metadata/);
  });

  test('should handle trailing slashes correctly', () => {
    const url = validateBaseUrl('https://api.openai.com/v1///');
    expect(url.pathname).toBe('/v1');
  });

  test('should reject non-http/https protocols', () => {
    expect(() => validateBaseUrl('ftp://example.com')).toThrow(/仅支持/);
    expect(() => validateBaseUrl('file:///etc/passwd')).toThrow(/仅支持/);
  });

  test('should reject empty or invalid baseUrl', () => {
    expect(() => validateBaseUrl('')).toThrow(/不能为空/);
    expect(() => validateBaseUrl(null)).toThrow(/不能为空/);
    expect(() => validateBaseUrl('not-a-url')).toThrow(/有效 URL/);
  });

  test('should allow normal HTTPS provider addresses', () => {
    expect(() => validateBaseUrl('https://api.openai.com/v1')).not.toThrow();
    expect(() => validateBaseUrl('https://api.anthropic.com')).not.toThrow();
    expect(() => validateBaseUrl('https://api.deepseek.com')).not.toThrow();
    expect(() => validateBaseUrl('https://api.moonshot.cn/v1')).not.toThrow();
  });

  test('should reject DNS resolution failure', async () => {
    const url = validateBaseUrl('https://nonexistent.example.com/v1');
    await expect(validateResolvedBaseUrl(url, {
      dnsLookup: async () => { throw new Error('ENOTFOUND'); }
    })).rejects.toThrow(/DNS 解析失败/);
  });

  test('should reject DNS resolving to IPv6 loopback', async () => {
    const url = validateBaseUrl('https://ai-proxy.example.com/v1');
    await expect(validateResolvedBaseUrl(url, {
      dnsLookup: async () => [{ address: '::1', family: 6 }]
    })).rejects.toThrow(/DNS|localhost|内网|metadata/);
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

  test('should not leak full response content in debug output', async () => {
    const originalEnv = process.env.AI_DEBUG_RESPONSE;
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      process.env.AI_DEBUG_RESPONSE = 'true';
      jest.resetModules();
      const { generateWithAI: freshGenerate } = require('../../src/ai/client');

      const secretContent = 'SECRET_RESPONSE_CONTENT_SHOULD_NOT_APPEAR';
      const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          choices: [{ message: { content: secretContent } }],
          usage: { total_tokens: 42 }
        }));
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

      try {
        const { port } = server.address();
        await freshGenerate('test', {
          apiKey: 'sk-secret-key-should-not-appear',
          protocol: 'openai',
          baseUrl: `http://127.0.0.1:${port}/v1`,
          model: 'test-model',
          maxTokens: 10,
          allowLocalBaseUrl: true,
          allowInsecureBaseUrl: true
        });

        const allOutput = consoleSpy.mock.calls.map(args => args.join(' ')).join('\n');
        expect(allOutput).not.toContain(secretContent);
        expect(allOutput).not.toContain('sk-secret-key-should-not-appear');
        expect(allOutput).toContain('AI-RESPONSE');
      } finally {
        await new Promise(resolve => server.close(resolve));
      }
    } finally {
      process.env.AI_DEBUG_RESPONSE = originalEnv;
      consoleSpy.mockRestore();
      jest.resetModules();
    }
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

describe('AI retry mechanism', () => {
  const baseOpts = {
    apiKey: 'key',
    protocol: 'openai',
    model: 'test-model',
    maxTokens: 10,
    timeout: 5000,
    allowLocalBaseUrl: true,
    allowInsecureBaseUrl: true
  };

  test('retries on 429 and succeeds', async () => {
    let count = 0;
    const server = http.createServer((req, res) => {
      count++;
      res.setHeader('Content-Type', 'application/json');
      if (count === 1) {
        res.writeHead(429, { 'Retry-After': '1' });
        res.end(JSON.stringify({ error: { message: 'rate limited' } }));
      } else {
        res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
      }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try {
      const { port } = server.address();
      const result = await generateWithAI('test', { ...baseOpts, baseUrl: `http://127.0.0.1:${port}/v1` });
      expect(result).toBe('ok');
      expect(count).toBe(2);
    } finally {
      await new Promise(r => server.close(r));
    }
  }, 15000);

  test('retries on 500 and succeeds', async () => {
    let count = 0;
    const server = http.createServer((req, res) => {
      count++;
      res.setHeader('Content-Type', 'application/json');
      if (count === 1) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: { message: 'server error' } }));
      } else {
        res.end(JSON.stringify({ choices: [{ message: { content: 'recovered' } }] }));
      }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try {
      const { port } = server.address();
      const result = await generateWithAI('test', { ...baseOpts, baseUrl: `http://127.0.0.1:${port}/v1` });
      expect(result).toBe('recovered');
      expect(count).toBe(2);
    } finally {
      await new Promise(r => server.close(r));
    }
  }, 15000);

  test('fails after max retries on persistent 500', async () => {
    let count = 0;
    const server = http.createServer((req, res) => {
      count++;
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(500);
      res.end(JSON.stringify({ error: { message: 'persistent error' } }));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try {
      const { port } = server.address();
      await expect(generateWithAI('test', { ...baseOpts, baseUrl: `http://127.0.0.1:${port}/v1` }))
        .rejects.toThrow('500');
      // 1 initial + 3 retries = 4
      expect(count).toBe(4);
    } finally {
      await new Promise(r => server.close(r));
    }
  }, 30000);

  test('uses Retry-After header for delay', async () => {
    let count = 0;
    const server = http.createServer((req, res) => {
      count++;
      res.setHeader('Content-Type', 'application/json');
      if (count === 1) {
        res.writeHead(429, { 'Retry-After': '1' });
        res.end(JSON.stringify({ error: { message: 'rate limited' } }));
      } else {
        res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
      }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try {
      const { port } = server.address();
      const start = Date.now();
      const result = await generateWithAI('test', { ...baseOpts, baseUrl: `http://127.0.0.1:${port}/v1` });
      const elapsed = Date.now() - start;
      expect(result).toBe('ok');
      expect(count).toBe(2);
      // Retry-After: 1 = 1000ms delay
      expect(elapsed).toBeGreaterThanOrEqual(900);
    } finally {
      await new Promise(r => server.close(r));
    }
  }, 15000);

  test('error message does not leak full API response body', async () => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(400);
      res.end(JSON.stringify({
        error: {
          message: 'Invalid request',
          type: 'invalid_request_error',
          internal_secret: 'should-not-leak'
        }
      }));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try {
      const { port } = server.address();
      await expect(generateWithAI('test', { ...baseOpts, baseUrl: `http://127.0.0.1:${port}/v1` }))
        .rejects.toThrow(/400.*Invalid request/);
    } finally {
      await new Promise(r => server.close(r));
    }
  });
});
