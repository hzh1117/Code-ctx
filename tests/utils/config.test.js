const { loadEnvConfig, getAIConfig, saveAIConfig, loadConfigWithVM, loadProjectConfig } = require('../../src/utils/config');
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
    // Protocol may be overridden by tool-level config
    expect(['openai', 'anthropic']).toContain(config.protocol);
    expect(config.maxTokens).toBeDefined();
  });

  test('should use Kimi Code defaults when ANTHROPIC_BASE_URL points to Kimi', () => {
    fs.writeFileSync(
      path.join(testDir, '.env'),
      [
        'ANTHROPIC_BASE_URL=https://api.kimi.com/coding/',
        'ANTHROPIC_API_KEY=test-key'
      ].join('\n')
    );

    const config = getAIConfig(testDir);

    expect(config.protocol).toBe('anthropic');
    expect(config.baseUrl).toBe('https://api.kimi.com/coding/');
    expect(config.model).toBe('kimi-for-coding');
  });

  test('should select OpenAI provider config and key from grouped config', () => {
    fs.writeFileSync(path.join(testDir, '.env'), [
      'OPENAI_API_KEY=openai-key',
      'ANTHROPIC_API_KEY=anthropic-key'
    ].join('\n'));
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = ${JSON.stringify({
      ai: {
        protocol: 'openai',
        openai: {
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-chat',
          maxTokens: 2048
        },
        anthropic: {
          baseUrl: 'https://api.anthropic.com',
          model: 'claude-sonnet-4-5-20250929',
          maxTokens: 4096
        }
      }
    })};`);

    const config = getAIConfig(testDir);

    expect(config.protocol).toBe('openai');
    expect(config.baseUrl).toBe('https://api.deepseek.com');
    expect(config.model).toBe('deepseek-chat');
    expect(config.maxTokens).toBe(2048);
    expect(config.apiKey).toBe('openai-key');
  });

  test('should select Anthropic provider config and key from grouped config', () => {
    fs.writeFileSync(path.join(testDir, '.env'), [
      'OPENAI_API_KEY=openai-key',
      'ANTHROPIC_API_KEY=anthropic-key'
    ].join('\n'));
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = ${JSON.stringify({
      ai: {
        protocol: 'anthropic',
        openai: {
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-chat',
          maxTokens: 2048
        },
        anthropic: {
          baseUrl: 'https://api.anthropic.com',
          model: 'claude-sonnet-4-5-20250929',
          maxTokens: 4096
        }
      }
    })};`);

    const config = getAIConfig(testDir);

    expect(config.protocol).toBe('anthropic');
    expect(config.baseUrl).toBe('https://api.anthropic.com');
    expect(config.model).toBe('claude-sonnet-4-5-20250929');
    expect(config.maxTokens).toBe(4096);
    expect(config.apiKey).toBe('anthropic-key');
  });

  test('should save grouped AI config without dropping the other provider', () => {
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = ${JSON.stringify({
      projectName: 'demo',
      ai: {
        protocol: 'openai',
        openai: {
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-chat',
          maxTokens: 2048
        },
        anthropic: {
          baseUrl: 'https://api.anthropic.com',
          model: 'claude-sonnet-4-5-20250929',
          maxTokens: 4096
        }
      }
    })};`);

    const saved = saveAIConfig(testDir, {
      protocol: 'anthropic',
      anthropic: {
        baseUrl: 'https://proxy.example.com/anthropic',
        model: 'claude-opus-4-6',
        maxTokens: 8192
      }
    });

    expect(saved.protocol).toBe('anthropic');
    expect(saved.openai.model).toBe('deepseek-chat');
    expect(saved.anthropic.baseUrl).toBe('https://proxy.example.com/anthropic');
    expect(saved.anthropic.model).toBe('claude-opus-4-6');
  });

  test('loadConfigWithVM: normal module.exports config loads correctly', () => {
    const configPath = path.join(testDir, 'code-ctx.config.js');
    fs.writeFileSync(configPath, `module.exports = { projectName: 'test', ai: { protocol: 'openai' } };`);
    const config = loadConfigWithVM(configPath);
    expect(config.projectName).toBe('test');
    expect(config.ai.protocol).toBe('openai');
  });

  test('loadConfigWithVM: exports.xxx pattern loads correctly', () => {
    const configPath = path.join(testDir, 'code-ctx.config.js');
    fs.writeFileSync(configPath, `exports.projectName = 'test'; exports.ai = { protocol: 'openai' };`);
    const config = loadConfigWithVM(configPath);
    expect(config.projectName).toBe('test');
    expect(config.ai.protocol).toBe('openai');
  });

  test('loadConfigWithVM: malicious config cannot require child_process', () => {
    const configPath = path.join(testDir, 'code-ctx.config.js');
    fs.writeFileSync(configPath, `const cp = require('child_process'); module.exports = { cmd: cp.execSync('whoami').toString() };`);
    expect(() => loadConfigWithVM(configPath)).toThrow();
  });

  test('loadConfigWithVM: malicious config cannot access process', () => {
    const configPath = path.join(testDir, 'code-ctx.config.js');
    fs.writeFileSync(configPath, `module.exports = { env: process.env };`);
    expect(() => loadConfigWithVM(configPath)).toThrow();
  });

  test('loadConfigWithVM: syntax error returns safe error message', () => {
    const configPath = path.join(testDir, 'code-ctx.config.js');
    fs.writeFileSync(configPath, `module.exports = { broken`);
    expect(() => loadConfigWithVM(configPath)).toThrow('配置文件解析失败');
  });

  test('loadProjectConfig: returns empty object when config file does not exist', () => {
    const config = loadProjectConfig(testDir);
    expect(config).toEqual({});
  });

  test('loadProjectConfig: loads valid config file', () => {
    const configPath = path.join(testDir, 'code-ctx.config.js');
    fs.writeFileSync(configPath, `module.exports = { projectName: 'my-app' };`);
    const config = loadProjectConfig(testDir);
    expect(config.projectName).toBe('my-app');
  });
});
