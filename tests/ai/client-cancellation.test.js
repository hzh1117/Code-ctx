const http = require('http');
const { generateWithAI, generateWithAIStream } = require('../../src/ai/client');

function baseOptions(server, overrides = {}) {
  const { port } = server.address();
  return {
    apiKey: 'test-key',
    protocol: 'openai',
    baseUrl: `http://127.0.0.1:${port}/v1`,
    model: 'test-model',
    maxTokens: 10,
    allowLocalBaseUrl: true,
    allowInsecureBaseUrl: true,
    ...overrides
  };
}

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

async function close(server) {
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
}

describe('AI request cancellation and deadlines', () => {
  test('aborts an active hanging request through AbortController', async () => {
    const server = http.createServer(() => {});
    await listen(server);
    const controller = new AbortController();

    try {
      const request = generateWithAI(
        'test',
        baseOptions(server, {
          signal: controller.signal,
          timeout: 10000,
          deadlineMs: 5000,
          maxRetries: 0
        })
      );
      setTimeout(() => controller.abort(), 30);

      await expect(request).rejects.toMatchObject({ code: 'AI_REQUEST_ABORTED' });
    } finally {
      await close(server);
    }
  });

  test('cancels the retry timer without sending another request', async () => {
    let requestCount = 0;
    const controller = new AbortController();
    const server = http.createServer((req, res) => {
      requestCount++;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'retry later' } }));
      setTimeout(() => controller.abort(), 30);
    });
    await listen(server);

    try {
      const startedAt = Date.now();
      await expect(
        generateWithAI(
          'test',
          baseOptions(server, {
            signal: controller.signal,
            timeout: 1000,
            deadlineMs: 5000
          })
        )
      ).rejects.toMatchObject({ code: 'AI_REQUEST_ABORTED' });

      expect(requestCount).toBe(1);
      expect(Date.now() - startedAt).toBeLessThan(1000);
    } finally {
      await close(server);
    }
  });

  test('enforces a total operation deadline on a hanging request', async () => {
    const server = http.createServer(() => {});
    await listen(server);

    try {
      const startedAt = Date.now();
      await expect(
        generateWithAI(
          'test',
          baseOptions(server, {
            timeout: 10000,
            deadlineMs: 60,
            maxRetries: 0
          })
        )
      ).rejects.toMatchObject({ code: 'AI_OPERATION_DEADLINE' });
      expect(Date.now() - startedAt).toBeLessThan(1000);
    } finally {
      await close(server);
    }
  });

  test('distinguishes a single request timeout from cancellation and deadline', async () => {
    const server = http.createServer(() => {});
    await listen(server);

    try {
      await expect(
        generateWithAI(
          'test',
          baseOptions(server, {
            timeout: 30,
            deadlineMs: 1000,
            maxRetries: 0
          })
        )
      ).rejects.toMatchObject({ code: 'AI_REQUEST_TIMEOUT' });
    } finally {
      await close(server);
    }
  });

  test('aborts a streaming request through the same signal', async () => {
    const server = http.createServer(() => {});
    await listen(server);
    const controller = new AbortController();

    try {
      const stream = generateWithAIStream(
        'test',
        baseOptions(server, {
          signal: controller.signal,
          timeout: 10000,
          deadlineMs: 5000
        })
      );
      const error = new Promise((resolve, reject) => {
        stream.once('error', resolve);
        stream.once('done', () => reject(new Error('stream unexpectedly completed')));
      });
      setTimeout(() => controller.abort(), 30);

      await expect(error).resolves.toMatchObject({ code: 'AI_REQUEST_ABORTED' });
    } finally {
      await close(server);
    }
  });
});
