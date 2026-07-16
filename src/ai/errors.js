function createAIError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createAbortError() {
  return createAIError('AI_REQUEST_ABORTED', 'AI 请求已由用户取消');
}

function createDeadlineError() {
  return createAIError('AI_OPERATION_DEADLINE', 'AI 操作超过总耗时上限');
}

function createRequestTimeoutError(timeout) {
  return createAIError('AI_REQUEST_TIMEOUT', `AI 单次请求超时 (${timeout}ms)`);
}

function isAICancellationError(error) {
  return error?.code === 'AI_REQUEST_ABORTED' || error?.code === 'AI_OPERATION_DEADLINE';
}

module.exports = {
  createAbortError,
  createDeadlineError,
  createRequestTimeoutError,
  isAICancellationError
};
