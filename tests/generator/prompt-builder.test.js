const { buildUsePrompt, buildInitPrompt } = require('../../src/generator/prompt-builder');

describe('prompt-builder', () => {
  describe('buildUsePrompt', () => {
    test('should combine scenario template with project context', () => {
      const result = buildUsePrompt({
        scenarioId: 'A',
        taskDescription: '新增用户登录',
        projectContext: '项目A是React前端，调用项目B的API',
        template: '任务：新增【{{featureName}}】功能。'
      });

      expect(result).toContain('项目上下文');
      expect(result).toContain('新增用户登录');
      expect(result).toContain('React前端');
    });

    test('should include OVERVIEW content when provided', () => {
      const result = buildUsePrompt({
        scenarioId: 'A',
        taskDescription: '测试',
        overviewContent: '# 项目总览\n这是一个测试项目',
        template: '任务模板'
      });

      expect(result).toContain('项目总览');
      expect(result).toContain('这是一个测试项目');
    });

    test('should include related project docs', () => {
      const result = buildUsePrompt({
        scenarioId: 'A',
        taskDescription: '测试',
        relatedDocs: {
          'mer.md': '# 商户端文档',
          'api.md': '# API文档'
        },
        template: '任务模板'
      });

      expect(result).toContain('商户端文档');
      expect(result).toContain('API文档');
    });

    test('should handle missing optional fields gracefully', () => {
      const result = buildUsePrompt({
        scenarioId: 'A',
        taskDescription: '测试',
        template: '简单任务'
      });

      expect(result).toContain('简单任务');
    });
  });

  describe('buildInitPrompt', () => {
    test('should build project doc prompt with scan results', () => {
      const result = buildInitPrompt({
        project: { name: 'my-app', type: 'react', alias: 'web' },
        scanResult: { tree: 'src/\n  App.jsx', keyFiles: ['src/App.jsx'] }
      });

      expect(result).toContain('my-app');
      expect(result).toContain('react');
      expect(result).toContain('src/');
    });

    test('should build overview prompt with all sub-project summaries', () => {
      const result = buildInitPrompt({
        type: 'overview',
        config: { projectName: 'test-app', projects: [{ alias: 'web', label: '前端', type: 'react' }] },
        generatedDocs: { web: '# 前端项目\n这是一个React应用' }
      });

      expect(result).toContain('OVERVIEW');
      expect(result).toContain('test-app');
      expect(result).toContain('前端项目');
    });
  });
});
