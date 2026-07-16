const { createProgressReporter } = require('../../src/init/progress-reporter');

describe('init progress reporter', () => {
  test('emits value-free structured progress outside a TTY', () => {
    let now = 1000;
    const output = [];
    const reporter = createProgressReporter({
      clock: { now: () => now },
      emit: message => output.push(message),
      isTTY: false,
      deadlineMs: 5000
    });

    reporter.phase('generation-planning', { projectCount: 2 });
    now = 1100;
    const request = reporter.requestStarted('api', 'const secret = "not-logged";');
    now = 1250;
    reporter.requestFinished(request, 'api', 'request-complete', { outputChars: 42 });

    const events = output.map(line => JSON.parse(line));
    expect(events.map(event => event.status)).toEqual([
      'phase', 'request-start', 'request-complete'
    ]);
    expect(events[1]).toEqual(expect.objectContaining({
      request: 1,
      target: 'api',
      promptChars: 28,
      estimatedInputTokens: expect.any(Number),
      deadlineMs: 5000,
      elapsedMs: 100
    }));
    expect(output.join('\n')).not.toContain('not-logged');
    expect(events[2].elapsedMs).toBe(250);
  });

  test('emits concise human progress in a TTY', () => {
    const output = [];
    const reporter = createProgressReporter({
      clock: { now: () => 10 },
      emit: message => output.push(message),
      isTTY: true,
      deadlineMs: 1000
    });

    reporter.requestStarted('OVERVIEW', 'prompt');

    expect(output[0]).toMatch(/^\[AI 1\] request-start OVERVIEW/);
  });
});
