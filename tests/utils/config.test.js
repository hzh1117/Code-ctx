const {
  loadEnvConfig,
  getAIConfig,
  saveAIConfig,
  loadConfigWithVM,
  loadProjectConfig,
  loadJsonConfig,
  getConfigFile,
  validateProjectConfig,
  validateProjectConfigDetailed,
  saveProjectConfig,
  _clearCache
} = require('../../src/utils/config');
const fs = require('fs');
const path = require('path');

describe('config', () => {
  const testDir = path.join(__dirname, '../fixtures/config-test');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    _clearCache();
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    _clearCache();
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
    expect(config.maxInputTokens).toBe(120000);
  });

  test('should allow a separate input token budget', () => {
    fs.writeFileSync(path.join(testDir, '.env'), ['OPENAI_API_KEY=test-key', 'AI_MAX_INPUT_TOKENS=32000'].join('\n'));

    const config = getAIConfig(testDir);

    expect(config.maxInputTokens).toBe(32000);
    expect(config.maxTokens).not.toBe(config.maxInputTokens);
  });

  test('should use Kimi Code defaults when ANTHROPIC_BASE_URL points to Kimi', () => {
    fs.writeFileSync(
      path.join(testDir, '.env'),
      ['ANTHROPIC_BASE_URL=https://api.kimi.com/coding/', 'ANTHROPIC_API_KEY=test-key'].join('\n')
    );

    const config = getAIConfig(testDir);

    expect(config.protocol).toBe('anthropic');
    expect(config.baseUrl).toBe('https://api.kimi.com/coding/');
    expect(config.model).toBe('kimi-for-coding');
  });

  test('显式设置 ANTHROPIC_MODEL 时不会被 preset 推断覆盖', () => {
    fs.writeFileSync(
      path.join(testDir, '.env'),
      [
        'ANTHROPIC_BASE_URL=https://api.kimi.com/coding/',
        'ANTHROPIC_API_KEY=test-key',
        'ANTHROPIC_MODEL=custom-model'
      ].join('\n')
    );

    const config = getAIConfig(testDir);

    expect(config.model).toBe('custom-model');
  });

  test('preset 推断同样适用 DeepSeek（openai 兼容）默认 model', () => {
    fs.writeFileSync(path.join(testDir, '.env'), 'OPENAI_API_KEY=test-key');
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.json'),
      JSON.stringify({
        ai: {
          protocol: 'openai',
          openai: { baseUrl: 'https://api.deepseek.com' }
        }
      })
    );

    const config = getAIConfig(testDir);

    expect(config.protocol).toBe('openai');
    expect(config.baseUrl).toBe('https://api.deepseek.com');
    expect(config.model).toBe('deepseek-chat');
  });

  test('should select OpenAI provider config and key from grouped config', () => {
    fs.writeFileSync(
      path.join(testDir, '.env'),
      ['OPENAI_API_KEY=openai-key', 'ANTHROPIC_API_KEY=anthropic-key'].join('\n')
    );
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.js'),
      `module.exports = ${JSON.stringify({
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
      })};`
    );

    const config = getAIConfig(testDir);

    expect(config.protocol).toBe('openai');
    expect(config.baseUrl).toBe('https://api.deepseek.com');
    expect(config.model).toBe('deepseek-chat');
    expect(config.maxTokens).toBe(2048);
    expect(config.apiKey).toBe('openai-key');
  });

  test('should select Anthropic provider config and key from grouped config', () => {
    fs.writeFileSync(
      path.join(testDir, '.env'),
      ['OPENAI_API_KEY=openai-key', 'ANTHROPIC_API_KEY=anthropic-key'].join('\n')
    );
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.js'),
      `module.exports = ${JSON.stringify({
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
      })};`
    );

    const config = getAIConfig(testDir);

    expect(config.protocol).toBe('anthropic');
    expect(config.baseUrl).toBe('https://api.anthropic.com');
    expect(config.model).toBe('claude-sonnet-4-5-20250929');
    expect(config.maxTokens).toBe(4096);
    expect(config.apiKey).toBe('anthropic-key');
  });

  test('should save grouped AI config without dropping the other provider', () => {
    fs.writeFileSync(
      path.join(testDir, 'code-ctx.config.js'),
      `module.exports = ${JSON.stringify({
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
      })};`
    );

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

  test('loadConfigWithVM: rejects executable assignment sequences', () => {
    const configPath = path.join(testDir, 'code-ctx.config.js');
    fs.writeFileSync(configPath, `exports.projectName = 'test'; exports.ai = { protocol: 'openai' };`);
    expect(() => loadConfigWithVM(configPath)).toThrow(/静态数据/);
  });

  test('loadConfigWithVM: malicious config cannot require child_process', () => {
    const configPath = path.join(testDir, 'code-ctx.config.js');
    fs.writeFileSync(
      configPath,
      `const cp = require('child_process'); module.exports = { cmd: cp.execSync('whoami').toString() };`
    );
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

  test('loadProjectConfig: reuses cached result when file mtime unchanged', () => {
    const configPath = path.join(testDir, 'code-ctx.config.js');
    fs.writeFileSync(configPath, `module.exports = { projectName: 'cached' };`);
    const first = loadProjectConfig(testDir);
    // Returning the same object reference proves the cache hit path is used.
    const second = loadProjectConfig(testDir);
    expect(second).toBe(first);
  });

  test('loadProjectConfig: invalidates cache when file mtime changes', () => {
    const configPath = path.join(testDir, 'code-ctx.config.js');
    fs.writeFileSync(configPath, `module.exports = { projectName: 'a' };`);
    expect(loadProjectConfig(testDir).projectName).toBe('a');

    // Bump mtime explicitly so the change is visible regardless of FS resolution.
    fs.writeFileSync(configPath, `module.exports = { projectName: 'b' };`);
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(configPath, future, future);

    expect(loadProjectConfig(testDir).projectName).toBe('b');
  });

  test('loadEnvConfig: invalidates cache when .env mtime changes', () => {
    const envPath = path.join(testDir, '.env');
    fs.writeFileSync(envPath, 'OPENAI_API_KEY=first');
    expect(loadEnvConfig(testDir).OPENAI_API_KEY).toBe('first');

    fs.writeFileSync(envPath, 'OPENAI_API_KEY=second');
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(envPath, future, future);

    expect(loadEnvConfig(testDir).OPENAI_API_KEY).toBe('second');
  });

  describe('JSON config (P25)', () => {
    test('getConfigFile: returns json format when only JSON exists', () => {
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), '{"projectName":"json-only"}');
      const info = getConfigFile(testDir);
      expect(info.exists).toBe(true);
      expect(info.format).toBe('json');
      expect(info.hasOtherFormat).toBe(false);
    });

    test('getConfigFile: returns js format when only JS exists', () => {
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = { projectName: 'js-only' };`);
      const info = getConfigFile(testDir);
      expect(info.exists).toBe(true);
      expect(info.format).toBe('js');
    });

    test('getConfigFile: returns absent target when neither exists', () => {
      const info = getConfigFile(testDir);
      expect(info.exists).toBe(false);
      expect(info.format).toBe('json');
    });

    test('loadProjectConfig: reads JSON when both formats exist (JSON wins)', () => {
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), '{"projectName":"from-json"}');
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = { projectName: 'from-js' };`);
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const config = loadProjectConfig(testDir);
        expect(config.projectName).toBe('from-json');
        // Warns once on the dual-format situation.
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('同时检测到'));
      } finally {
        warn.mockRestore();
      }
    });

    test('loadProjectConfig: throws on malformed JSON', () => {
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), '{ "broken": ');
      expect(() => loadProjectConfig(testDir)).toThrow(/JSON/);
    });

    test('loadJsonConfig: rejects non-object root', () => {
      const p = path.join(testDir, 'array.json');
      fs.writeFileSync(p, '[1,2,3]');
      expect(() => loadJsonConfig(p)).toThrow(/对象/);
    });

    test('validateProjectConfig: accepts a minimal valid config', () => {
      const errors = validateProjectConfig({ projectName: 'x', outputDir: './ai-docs' });
      expect(errors).toEqual([]);
    });

    test('validateProjectConfig: rejects unknown top-level keys', () => {
      const errors = validateProjectConfig({ projectName: 'x', evilKey: 1 });
      expect(errors.some(e => e.includes('evilKey'))).toBe(true);
    });

    test('validateProjectConfig: rejects wrong types', () => {
      const errors = validateProjectConfig({
        projectName: 123,
        outputDir: false,
        aiMode: 'unknown',
        gitTrack: 'yes',
        excludeDirs: 'oops',
        projects: 'oops'
      });
      // projectName, outputDir, aiMode, gitTrack, excludeDirs, projects
      expect(errors.length).toBeGreaterThanOrEqual(6);
    });

    test('validateProjectConfig: validates project entries', () => {
      const errors = validateProjectConfig({
        projects: [{/* missing alias */}, { alias: 'ok' }, { alias: 'bad', path: 1 }]
      });
      expect(errors.some(e => e.includes('projects[0].alias'))).toBe(true);
      expect(errors.some(e => e.includes('projects[2].path'))).toBe(true);
    });

    test('classifies unknown fields as migration warnings', () => {
      expect(validateProjectConfigDetailed({ projectName: 'x', futureField: true })).toEqual({
        errors: [],
        warnings: ['未知字段: futureField']
      });
    });

    test('loadProjectConfig blocks invalid schema types', () => {
      fs.writeFileSync(
        path.join(testDir, 'code-ctx.config.json'),
        JSON.stringify({
          projectName: 123,
          projects: 'invalid'
        })
      );
      expect(() => loadProjectConfig(testDir)).toThrow(/schema 校验失败.*projectName/);
    });

    test('saveProjectConfig validates before changing the existing file', () => {
      const configPath = path.join(testDir, 'code-ctx.config.json');
      fs.writeFileSync(configPath, JSON.stringify({ projectName: 'original' }));

      expect(() => saveProjectConfig(testDir, { projectName: false })).toThrow(/schema 校验失败/);
      expect(JSON.parse(fs.readFileSync(configPath, 'utf8')).projectName).toBe('original');
      expect(fs.existsSync(`${configPath}.bak`)).toBe(false);
    });

    test('validateProjectConfig: accepts string scan pattern overrides', () => {
      expect(
        validateProjectConfig({
          projects: [{ alias: 'custom', path: '.', scanPatterns: ['custom/**/*.foo'] }]
        })
      ).toEqual([]);
      expect(
        validateProjectConfig({
          projects: [{ alias: 'custom', path: '.', scanPatterns: [123] }]
        })
      ).toEqual(expect.arrayContaining([expect.stringContaining('scanPatterns')]));
    });

    test('saveProjectConfig: defaults to JSON when nothing exists', () => {
      saveProjectConfig(testDir, { projectName: 'fresh' });
      expect(fs.existsSync(path.join(testDir, 'code-ctx.config.json'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'code-ctx.config.js'))).toBe(false);
    });

    test('saveProjectConfig: writes JSON when a legacy JS config exists', () => {
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = { projectName: 'old' };`);
      saveProjectConfig(testDir, { projectName: 'updated' });
      const content = JSON.parse(fs.readFileSync(path.join(testDir, 'code-ctx.config.json'), 'utf8'));
      expect(content.projectName).toBe('updated');
      expect(fs.existsSync(path.join(testDir, 'code-ctx.config.js'))).toBe(true);
    });

    test('saveProjectConfig: rejects JS output format', () => {
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.js'), `module.exports = { projectName: 'old' };`);
      expect(() => saveProjectConfig(testDir, { projectName: 'new' }, { format: 'js' })).toThrow(/不再支持写入 JS/);
    });

    test('saveProjectConfig: writes a .bak alongside existing file', () => {
      fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), '{"projectName":"original"}');
      saveProjectConfig(testDir, { projectName: 'changed' });
      expect(fs.existsSync(path.join(testDir, 'code-ctx.config.json.bak'))).toBe(true);
    });

    test('saveProjectConfig: converts absolute project paths to portable relative paths', () => {
      const childDir = path.join(testDir, 'packages', 'app');
      fs.mkdirSync(childDir, { recursive: true });

      saveProjectConfig(testDir, {
        projectName: 'portable',
        projects: [{ alias: 'app', path: childDir, type: 'react' }]
      });

      const persisted = JSON.parse(fs.readFileSync(path.join(testDir, 'code-ctx.config.json'), 'utf8'));
      expect(persisted.projects[0].path).toBe('./packages/app');
    });

    test('loadProjectConfig: migrates legacy absolute paths within the repository', () => {
      const childDir = path.join(testDir, 'app');
      fs.mkdirSync(childDir, { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'code-ctx.config.json'),
        JSON.stringify({
          projects: [{ alias: 'app', path: childDir, type: 'react' }]
        })
      );
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const config = loadProjectConfig(testDir);
        expect(config.projects[0].path).toBe('./app');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('绝对项目路径迁移'));
      } finally {
        warn.mockRestore();
      }
    });

    test.each([
      ['legacy absolute path', path.resolve(testDir, '..', 'outside')],
      ['relative traversal', '../outside']
    ])('loadProjectConfig: rejects out-of-root %s', (_label, projectPath) => {
      fs.writeFileSync(
        path.join(testDir, 'code-ctx.config.json'),
        JSON.stringify({
          projects: [{ alias: 'outside', path: projectPath, type: 'unknown' }]
        })
      );

      expect(() => loadProjectConfig(testDir)).toThrow(/越界/);
    });

    test('saveAIConfig: writes back to JSON when JSON is the active format', () => {
      fs.writeFileSync(
        path.join(testDir, 'code-ctx.config.json'),
        JSON.stringify({
          projectName: 'json-app',
          ai: { protocol: 'openai' }
        })
      );
      saveAIConfig(testDir, { protocol: 'anthropic' });
      const parsed = JSON.parse(fs.readFileSync(path.join(testDir, 'code-ctx.config.json'), 'utf8'));
      expect(parsed.ai.protocol).toBe('anthropic');
      expect(parsed.projectName).toBe('json-app');
    });

    test('getAIConfig: reads protocol from JSON config', () => {
      fs.writeFileSync(path.join(testDir, '.env'), 'ANTHROPIC_API_KEY=k');
      fs.writeFileSync(
        path.join(testDir, 'code-ctx.config.json'),
        JSON.stringify({
          ai: { protocol: 'anthropic' }
        })
      );
      const cfg = getAIConfig(testDir);
      expect(cfg.protocol).toBe('anthropic');
      expect(cfg.apiKey).toBe('k');
    });
  });
});
