const { loadEnvConfig, getAIConfig } = require('../../src/utils/config');
const fs = require('fs');
const path = require('path');

describe('config', () => {
  const testDir = path.join(__dirname, '../fixtures/config-test');
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });
  
  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });
  
  test('should load env config', () => {
    fs.writeFileSync(path.join(testDir, '.env'), 'OPENAI_API_KEY=test-key');
    const config = loadEnvConfig(testDir);
    expect(config.OPENAI_API_KEY).toBe('test-key');
  });
  
  test('should get AI config with defaults', () => {
    const config = getAIConfig(testDir);
    expect(config.protocol).toBe('openai');
    expect(config.maxTokens).toBe(4096);
  });
});
