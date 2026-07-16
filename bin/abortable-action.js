async function runWithInterrupt(handler, processTarget = process) {
  const controller = new AbortController();
  const onInterrupt = () => {
    if (controller.signal.aborted) return;
    processTarget.stderr?.write('\n正在取消当前操作...\n');
    controller.abort();
  };

  processTarget.once('SIGINT', onInterrupt);
  try {
    return await handler(controller.signal);
  } finally {
    processTarget.removeListener('SIGINT', onInterrupt);
  }
}

function exitCodeForError(error) {
  return error?.code === 'AI_REQUEST_ABORTED' ? 130 : 1;
}

module.exports = { runWithInterrupt, exitCodeForError };
