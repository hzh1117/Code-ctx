const EventEmitter = require('events');
const { runWithInterrupt, exitCodeForError } = require('../../bin/abortable-action');

describe('CLI interrupt handling', () => {
  test('aborts the operation and removes its SIGINT listener', async () => {
    const processTarget = new EventEmitter();
    processTarget.stderr = { write: jest.fn() };
    let receivedSignal;

    const operation = runWithInterrupt(signal => {
      receivedSignal = signal;
      return new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    }, processTarget);

    expect(processTarget.listenerCount('SIGINT')).toBe(1);
    processTarget.emit('SIGINT');
    await operation;

    expect(receivedSignal.aborted).toBe(true);
    expect(processTarget.listenerCount('SIGINT')).toBe(0);
    expect(processTarget.stderr.write).toHaveBeenCalledTimes(1);
  });

  test('maps user cancellation to the conventional Ctrl+C exit code', () => {
    expect(exitCodeForError({ code: 'AI_REQUEST_ABORTED' })).toBe(130);
    expect(exitCodeForError(new Error('failure'))).toBe(1);
  });
});
