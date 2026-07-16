const { createInitCommand, createInitServices } = require('../../src/commands/init');

describe('init pipeline', () => {
  test('runs the six services in order through injected boundaries', async () => {
    const calls = [];
    const state = { projects: {} };
    const stateStore = { save: jest.fn() };
    const generation = {
      generatedDocs: { app: '# app' },
      failedDocs: [],
      status: 'completed',
      success: true
    };
    const logger = {
      setVerbose: jest.fn(),
      log: jest.fn(),
      verbose: jest.fn(),
      step: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      isVerbose: () => false
    };
    const command = createInitCommand({
      logger,
      discoveryService: {
        discover: () => {
          calls.push('discovery');
          return [{ alias: 'app', path: '/repo', type: 'unknown' }];
        }
      },
      snapshotService: {
        capture: () => {
          calls.push('snapshot');
          return { outputDir: '/repo/ai-docs', scanResults: { app: {} }, state, stateStore };
        }
      },
      planningService: {
        plan: () => {
          calls.push('planning');
          return { config: { projects: [] }, selectStrategy: () => 'ONE_SHOT' };
        }
      },
      generationService: {
        generate: async context => {
          calls.push('generation');
          expect(context.stateStore).toBe(stateStore);
          return generation;
        }
      },
      validationService: {
        inspect: outputDir => {
          calls.push('validation');
          expect(outputDir).toBe('/repo/ai-docs');
          return [];
        }
      },
      commitService: {
        commit: context => {
          calls.push('commit');
          expect(context.generation).toBe(generation);
        }
      }
    });

    const result = await command('/repo', { verbose: true });

    expect(calls).toEqual([
      'discovery',
      'snapshot',
      'planning',
      'generation',
      'validation',
      'commit'
    ]);
    expect(logger.setVerbose).toHaveBeenCalledWith(true);
    expect(result).toEqual(expect.objectContaining({ success: true, status: 'completed' }));
  });

  test('accepts AI, filesystem, clock and state store dependencies', () => {
    const fs = { existsSync: jest.fn() };
    const clock = { now: jest.fn(() => 1), isoNow: jest.fn(() => 'now') };
    const stateStore = { load: jest.fn(), save: jest.fn() };
    const generateAI = jest.fn();
    const services = createInitServices({
      fs,
      clock,
      stateStore,
      generateAI,
      logger: {
        setVerbose: jest.fn(),
        log: jest.fn(),
        verbose: jest.fn(),
        step: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        isVerbose: () => false
      }
    });

    expect(services).toEqual(expect.objectContaining({
      discovery: expect.any(Object),
      snapshot: expect.any(Object),
      planning: expect.any(Object),
      generation: expect.any(Object),
      validation: expect.any(Object),
      commit: expect.any(Object)
    }));
  });
});
