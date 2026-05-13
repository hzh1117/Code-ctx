const { useCommand } = require('../../src/commands/use');
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
        taskDescription: '测试功能',
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

  describe('output format', () => {
    test('should return prompt with context and template sections', async () => {
      const result = await useCommand({
        taskDescription: '测试功能',
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
});
