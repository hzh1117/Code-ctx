// Tests depend on real scenarios.json loaded via getScenarios() — acceptable for integration-style testing
const { useCommand, buildContext } = require('../../src/commands/use');
const { matchScenario } = require('../../src/matcher/scenario-matcher');
const path = require('path');
const fs = require('fs');

describe('useCommand', () => {
  const fixturesDir = path.join(__dirname, '../fixtures/use-test');

  beforeEach(() => {
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    const aiDocsDir = path.join(fixturesDir, 'ai-docs');
    if (!fs.existsSync(aiDocsDir)) {
      fs.mkdirSync(aiDocsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(aiDocsDir, 'OVERVIEW.md'), '# 项目总览\n这是一个测试项目');
    fs.writeFileSync(path.join(aiDocsDir, 'mer.md'), '# 商户端文档\n管理后台');
    fs.writeFileSync(path.join(aiDocsDir, 'api.md'), '# API文档\n接口列表');
  });

  afterEach(() => {
    if (fs.existsSync(fixturesDir)) {
      fs.rmSync(fixturesDir, { recursive: true, force: true });
    }
  });

  describe('smart mode', () => {
    test('should auto-detect scenario from task description', async () => {
      const result = await useCommand({
        taskDescription: '商户后台新增优惠券管理',
        rootDir: fixturesDir
      });

      expect(result.prompt).toContain('商户');
      expect(result.matchedScenario).toBe('B');
      expect(result.confidence).toBeGreaterThanOrEqual(60);
    });

    test('should inject OVERVIEW content into prompt', async () => {
      const result = await useCommand({
        taskDescription: '商户后台新增功能',
        rootDir: fixturesDir
      });

      expect(result.prompt).toContain('项目总览');
      expect(result.prompt).toContain('测试项目');
    });

    test('should inject related project docs based on scenario', async () => {
      const result = await useCommand({
        taskDescription: '商户后台新增功能',
        rootDir: fixturesDir
      });

      expect(result.prompt).toContain('商户端文档');
    });
  });

  describe('manual mode', () => {
    test('should use specified scenario', async () => {
      const result = await useCommand({
        scenario: 'F',
        taskDescription: '修复登录bug',
        rootDir: fixturesDir
      });

      expect(result.matchedScenario).toBe('F');
      expect(result.prompt).toContain('排查');
    });
  });

  describe('error handling', () => {
    test('should throw error when neither task nor scenario provided', async () => {
      await expect(useCommand({})).rejects.toThrow('请提供任务描述或指定场景');
    });

    test('should throw error for invalid scenario', async () => {
      await expect(useCommand({ scenario: 'X' })).rejects.toThrow('未找到场景');
    });
  });

  describe('no doc loading', () => {
    test('should work without rootDir (no doc loading)', async () => {
      const result = await useCommand({
        taskDescription: '新增页面',
        scenario: 'A'
      });

      expect(result.prompt).not.toContain('项目总览');
      expect(result.prompt).toContain('【第二部分：任务模板】');
      expect(result.matchedScenario).toBe('A');
    });
  });

  describe('output format', () => {
    test('should return prompt with context and template sections', async () => {
      const result = await useCommand({
        taskDescription: '商户后台新增功能',
        rootDir: fixturesDir
      });

      expect(result.prompt).toContain('【第一部分：项目上下文】');
      expect(result.prompt).toContain('【第二部分：任务模板】');
    });

    test('should include scenario name in result', async () => {
      const result = await useCommand({
        scenario: 'A',
        taskDescription: '新增页面',
        rootDir: fixturesDir
      });

      expect(result).toHaveProperty('scenarioName');
      expect(result.scenarioName).toBeTruthy();
    });
  });

  describe('low confidence', () => {
    test('should return lowConfidenceScenarios when confidence < 50%', async () => {
      const result = await useCommand({
        taskDescription: '随便写点什么'
      });

      expect(result.lowConfidenceScenarios).toBeDefined();
      expect(Array.isArray(result.lowConfidenceScenarios)).toBe(true);
      expect(result.lowConfidenceScenarios.length).toBeGreaterThan(0);
      expect(result.prompt).toBeUndefined();
      expect(result.confidence).toBeLessThan(50);
    });

    test('lowConfidenceScenarios should contain id, name, description', async () => {
      const result = await useCommand({
        taskDescription: 'xyz'
      });

      const first = result.lowConfidenceScenarios[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('description');
    });
  });

  describe('sensitive filtering', () => {
    test('should filter sensitive content from prompt', async () => {
      const aiDocsDir = path.join(fixturesDir, 'ai-docs');
      fs.writeFileSync(
        path.join(aiDocsDir, 'OVERVIEW.md'),
        '# 项目总览\npassword = "abc123"\ntoken = "secret_token_value"'
      );

      const result = await useCommand({
        taskDescription: '商户后台新增功能',
        rootDir: fixturesDir
      });

      expect(result.prompt).not.toContain('abc123');
      expect(result.prompt).not.toContain('secret_token_value');
      expect(result.prompt).toContain('[FILTERED]');
    });
  });

  describe('buildContext', () => {
    test('should return the assembled prompt string for CLI and Web reuse', async () => {
      const prompt = await buildContext('商户后台新增功能', 'B', {
        rootDir: fixturesDir,
        noAiMatch: true,
        language: 'zh'
      });

      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('【第一部分：项目上下文】');
      expect(prompt).toContain('商户端文档');
      expect(prompt).toContain('【第二部分：任务模板】');
    });
  });

  describe('compact mode', () => {
    test('should compress prompt when exceeding 8000 chars', async () => {
      const aiDocsDir = path.join(fixturesDir, 'ai-docs');
      const longContent = 'x'.repeat(4000);
      const overviewWithSections = [
        '# 总览',
        '<!-- section:overview -->',
        '| 项目 | 说明 |',
        '<!-- /section:overview -->',
        '<!-- section:其他 -->',
        longContent,
        '<!-- /section:其他 -->'
      ].join('\n');
      const merWithSections = [
        '# 商户端',
        '<!-- section:modules -->',
        '核心功能描述',
        '<!-- /section:modules -->',
        '<!-- section:notes -->',
        '注意事项',
        '<!-- /section:notes -->',
        '<!-- section:详细设计 -->',
        longContent,
        '<!-- /section:详细设计 -->'
      ].join('\n');
      fs.writeFileSync(path.join(aiDocsDir, 'OVERVIEW.md'), overviewWithSections);
      fs.writeFileSync(path.join(aiDocsDir, 'mer.md'), merWithSections);

      const result = await useCommand({
        taskDescription: '商户后台新增功能',
        rootDir: fixturesDir
      });

      expect(result.compactInfo).toBeDefined();
      expect(result.compactInfo.originalLength).toBeGreaterThan(8000);
      expect(result.compactInfo.compactLength).toBeLessThan(result.compactInfo.originalLength);
      expect(result.compactInfo.compactTokens).toBeLessThan(result.compactInfo.originalTokens);
      expect(result.prompt).toContain('| 项目 | 说明 |');
      expect(result.prompt).toContain('核心功能描述');
      expect(result.prompt).toContain('注意事项');
      expect(result.prompt).not.toContain(longContent);
      expect(result.prompt).toContain('商户后台新增功能');
      expect(result.prompt).toContain('Context compression report');
      expect(result.compactInfo.removed.length).toBeGreaterThan(0);
    });

    test('should compact using generated template section ids', async () => {
      const aiDocsDir = path.join(fixturesDir, 'ai-docs');
      const longContent = 'x'.repeat(4000);
      const overviewWithSections = [
        '# 总览',
        '<!-- section:overview -->',
        '项目总览核心内容',
        '<!-- /section:overview -->',
        '<!-- section:dependencies -->',
        longContent,
        '<!-- /section:dependencies -->'
      ].join('\n');
      const merWithSections = [
        '# 商户端',
        '<!-- section:modules -->',
        '英文 id 核心模块',
        '<!-- /section:modules -->',
        '<!-- section:notes -->',
        '英文 id 注意事项',
        '<!-- /section:notes -->',
        '<!-- section:data -->',
        longContent,
        '<!-- /section:data -->'
      ].join('\n');
      fs.writeFileSync(path.join(aiDocsDir, 'OVERVIEW.md'), overviewWithSections);
      fs.writeFileSync(path.join(aiDocsDir, 'mer.md'), merWithSections);

      const result = await useCommand({
        taskDescription: '商户后台新增功能',
        rootDir: fixturesDir
      });

      expect(result.compactInfo).toBeDefined();
      expect(result.prompt).toContain('项目总览核心内容');
      expect(result.prompt).toContain('英文 id 核心模块');
      expect(result.prompt).toContain('英文 id 注意事项');
      expect(result.prompt).not.toContain(longContent);
    });

    test('should not compress when under 8000 chars', async () => {
      const result = await useCommand({
        taskDescription: '商户后台新增功能',
        rootDir: fixturesDir
      });

      expect(result.compactInfo).toBeNull();
    });

    test('selects data sections for a database scenario', async () => {
      const aiDocsDir = path.join(fixturesDir, 'ai-docs');
      const longContent = 'x'.repeat(9000);
      fs.writeFileSync(path.join(aiDocsDir, 'OVERVIEW.md'), [
        '<!-- section:overview -->',
        'System overview',
        '<!-- /section:overview -->',
        '<!-- section:architecture -->',
        longContent,
        '<!-- /section:architecture -->'
      ].join('\n'));
      fs.writeFileSync(path.join(aiDocsDir, 'api.md'), [
        '<!-- section:data -->',
        'User table migration evidence',
        '<!-- /section:data -->',
        '<!-- section:api -->',
        longContent,
        '<!-- /section:api -->'
      ].join('\n'));

      const result = await useCommand({
        scenario: 'D',
        taskDescription: '修改数据库表结构',
        rootDir: fixturesDir
      });

      expect(result.compactInfo).not.toBeNull();
      expect(result.prompt).toContain('User table migration evidence');
      expect(result.prompt).toContain('api.md#api: not selected for scenario');
      expect(result.prompt).not.toContain(longContent);
    });
  });
});
