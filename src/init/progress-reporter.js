const { AI_CLIENT } = require('../utils/constants');
const { estimateTokensForContent } = require('../utils/token-estimator');

function createProgressReporter(options = {}) {
  const clock = options.clock || { now: () => Date.now() };
  const emit = options.emit || (message => console.log(message));
  const isTTY = options.isTTY ?? Boolean(process.stdout.isTTY);
  const startedAt = clock.now();
  const deadlineMs = options.deadlineMs || AI_CLIENT.DEFAULT_DEADLINE;
  let requestSequence = 0;

  function write(event) {
    const payload = {
      type: 'code-ctx.progress',
      elapsedMs: clock.now() - startedAt,
      deadlineMs,
      ...event
    };
    if (!isTTY) {
      emit(JSON.stringify(payload));
      return payload;
    }
    const sequence = payload.request ? ` ${payload.request}` : '';
    const target = payload.target ? ` ${payload.target}` : '';
    emit(`[AI${sequence}] ${payload.status}${target} (${payload.elapsedMs}ms / ${deadlineMs}ms)`);
    return payload;
  }

  return {
    phase(name, details = {}) {
      return write({ status: 'phase', phase: name, ...details });
    },
    requestStarted(target, prompt) {
      const request = ++requestSequence;
      write({
        status: 'request-start',
        phase: 'generation',
        request,
        target,
        promptChars: String(prompt || '').length,
        estimatedInputTokens: estimateTokensForContent(prompt || '')
      });
      return request;
    },
    requestFinished(request, target, status, details = {}) {
      return write({
        status,
        phase: 'generation',
        request,
        target,
        ...details
      });
    },
    continuation(request, target, attempt, maxAttempts) {
      return write({
        status: 'continuation',
        phase: 'generation',
        request,
        target,
        attempt,
        maxAttempts
      });
    }
  };
}

module.exports = { createProgressReporter };
