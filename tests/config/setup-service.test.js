const fs = require('fs');
const os = require('os');
const path = require('path');
const { setupAIConfig } = require('../../src/config/setup-service');
const { loadProjectConfig, _clearCache } = require('../../src/utils/config');

describe('AI setup service', () => {
  let rootDir;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-ctx-setup-'));
  });

  afterEach(() => {
    _clearCache();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('writes provider config, protected env and gitignore then tests connection', async () => {
    const generateWithAI = jest.fn().mockResolvedValue('OK');
    const result = await setupAIConfig(rootDir, {
      provider: 'openai',
      apiKey: 'test-secret-key',
      testConnection: true
    }, { generateWithAI });

    expect(result.connection.success).toBe(true);
    expect(generateWithAI).toHaveBeenCalledWith('只回复 OK', expect.objectContaining({
      apiKey: 'test-secret-key',
      protocol: 'openai'
    }));
    expect(loadProjectConfig(rootDir).ai.openai).toEqual(expect.objectContaining({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.5'
    }));
    expect(fs.readFileSync(path.join(rootDir, '.env'), 'utf8')).toContain(
      'OPENAI_API_KEY=test-secret-key'
    );
    expect(fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8')).toContain('.env');
  });

  test('returns a structured connection failure without losing saved config', async () => {
    const result = await setupAIConfig(rootDir, {
      provider: 'anthropic',
      apiKey: 'test-secret-key',
      testConnection: true
    }, { generateWithAI: jest.fn().mockRejectedValue(new Error('401 unauthorized')) });

    expect(result.connection).toEqual({
      tested: true,
      success: false,
      error: '401 unauthorized'
    });
    expect(fs.existsSync(path.join(rootDir, 'code-ctx.config.json'))).toBe(true);
    expect(fs.readFileSync(path.join(rootDir, '.env'), 'utf8'))
      .toContain('ANTHROPIC_API_KEY=test-secret-key');
  });
});
