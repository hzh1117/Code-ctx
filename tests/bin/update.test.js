jest.mock('../../src/commands/update', () => ({
  updateCommand: jest.fn(),
  executeUpdateTransaction: jest.fn()
}));
jest.mock('../../src/utils/config', () => ({
  getAIConfig: jest.fn(() => ({ apiKey: 'test-key' }))
}));
jest.mock('../../src/utils/prompt-output', () => ({
  outputPrompt: jest.fn()
}));

const {
  updateCommand,
  executeUpdateTransaction
} = require('../../src/commands/update');

describe('update CLI exit codes', () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    process.exitCode = undefined;
    updateCommand.mockReset();
    executeUpdateTransaction.mockReset();
    updateCommand.mockResolvedValue({
      changedFiles: ['src/app.js'],
      changes: [{ path: 'src/app.js', status: 'modified' }],
      detectionMethod: 'hash',
      sectionUpdates: [{ docName: 'app.md', sectionName: 'modules', prompt: 'update' }],
      confirmationRequired: [],
      prompt: 'non-empty prompt'
    });
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    jest.resetModules();
  });

  test('returns non-zero when apply has failures or cannot commit', async () => {
    executeUpdateTransaction.mockResolvedValue({
      success: 0,
      failed: 1,
      skipped: 0,
      committed: false,
      results: [{
        docName: 'app.md',
        sectionName: 'modules',
        status: 'failed',
        reason: 'provider failed'
      }]
    });
    const command = require('../../bin/commands/update');

    await command.parseAsync(['node', 'update', '--apply']);

    expect(process.exitCode).toBe(1);
    expect(executeUpdateTransaction).toHaveBeenCalledTimes(1);
  });
});
