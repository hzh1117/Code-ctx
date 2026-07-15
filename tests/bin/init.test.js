jest.mock('../../src/commands/init', () => ({
  initCommand: jest.fn()
}));

const { initCommand } = require('../../src/commands/init');

describe('init CLI', () => {
  const originalExitCode = process.exitCode;

  afterEach(() => {
    jest.resetModules();
    initCommand.mockReset();
    process.exitCode = originalExitCode;
  });

  test('sets a non-zero exit code for a structured generation failure', async () => {
    initCommand.mockResolvedValue({ success: false, status: 'failed' });
    const command = require('../../bin/commands/init');

    await command.parseAsync(['node', 'test']);

    expect(process.exitCode).toBe(1);
  });
});
