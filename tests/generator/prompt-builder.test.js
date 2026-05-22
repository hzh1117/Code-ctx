const {
  buildUsePrompt,
  buildInitPrompt,
  buildOverviewPrompt,
  buildOneShotPrompt,
  buildSubprojectPrompt
} = require('../../src/generator/prompt-builder');

describe('prompt-builder', () => {
  describe('buildUsePrompt', () => {
    test('should combine scenario template with project context', () => {
      const result = buildUsePrompt({
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
        taskDescription: '测试',
        overviewContent: '# 项目总览\n这是一个测试项目',
        template: '任务模板'
      });

      expect(result).toContain('项目总览');
      expect(result).toContain('这是一个测试项目');
    });

    test('should include related project docs', () => {
      const result = buildUsePrompt({
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
        taskDescription: '测试',
        template: '简单任务'
      });

      expect(result).toContain('简单任务');
    });

    test('should handle missing template gracefully', () => {
      const result = buildUsePrompt({
        taskDescription: '用户登录功能'
      });

      expect(result).toContain('用户登录功能');
      expect(result).toContain('项目上下文');
    });

    test('should handle null template gracefully', () => {
      const result = buildUsePrompt({
        taskDescription: '测试任务',
        template: null
      });

      expect(result).toContain('测试任务');
    });

    test('should substitute {{featureName}} in template', () => {
      const result = buildUsePrompt({
        taskDescription: '用户注册',
        template: '请实现{{featureName}}模块，调用{{apiPrefix}}接口'
      });

      expect(result).toContain('用户注册');
      expect(result).toContain('/api/');
      expect(result).not.toContain('{{featureName}}');
    });

    test('should handle empty relatedDocs', () => {
      const result = buildUsePrompt({
        taskDescription: '测试',
        template: '任务',
        relatedDocs: {}
      });

      expect(result).toContain('任务');
      expect(result).not.toContain('项目关系');
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

    test('should handle missing project and scanResult gracefully', () => {
      const result = buildInitPrompt({});

      expect(result).toContain('结构文档');
      expect(result).not.toThrow;
    });

    test('should handle null project and scanResult', () => {
      const result = buildInitPrompt({
        project: null,
        scanResult: null
      });

      expect(result).toContain('结构文档');
    });

    test('should handle overview with missing config', () => {
      const result = buildInitPrompt({
        type: 'overview'
      });

      expect(result).toContain('OVERVIEW');
    });

    test('should handle overview with null config', () => {
      const result = buildInitPrompt({
        type: 'overview',
        config: null
      });

      expect(result).toContain('OVERVIEW');
    });
  });

  describe('buildOverviewPrompt', () => {
    test('生成包含项目名和子项目摘要的概览', () => {
      const result = buildOverviewPrompt({
        config: { projectName: 'demo', projects: [{ alias: 'web', label: '前端', type: 'react' }] },
        generatedDocs: { web: '# 前端\n第二行\n' }
      });
      expect(result).toContain('demo');
      expect(result).toContain('web');
      expect(result).toContain('前端');
    });

    test('无参数时返回模板默认值', () => {
      expect(() => buildOverviewPrompt()).not.toThrow();
      const result = buildOverviewPrompt();
      expect(result).toContain('OVERVIEW');
    });
  });

  describe('buildOneShotPrompt', () => {
    test('合并多项目结构到单个 prompt', () => {
      const result = buildOneShotPrompt({
        projects: [
          { alias: 'web', name: 'frontend', type: 'react', path: 'apps/web' },
          { alias: 'api', name: 'backend', type: 'node', path: 'apps/api' }
        ],
        scanResults: {
          web: { tree: 'web-tree', keyFiles: ['web/App.jsx'] },
          api: { tree: 'api-tree', keyFiles: ['api/index.js'] }
        }
      });
      expect(result).toContain('frontend');
      expect(result).toContain('backend');
      expect(result).toContain('web-tree');
      expect(result).toContain('api/index.js');
    });

    test('无参数时也能稳定渲染', () => {
      expect(() => buildOneShotPrompt()).not.toThrow();
    });
  });

  describe('buildSubprojectPrompt', () => {
    test('渲染单个子项目结构', () => {
      const result = buildSubprojectPrompt({
        project: { name: 'my-app', type: 'vue', path: 'apps/my' },
        scanResult: { tree: 'src/\n  index.vue', keyFiles: ['src/index.vue'] }
      });
      expect(result).toContain('my-app');
      expect(result).toContain('vue');
      expect(result).toContain('src/index.vue');
    });

    test('otherDocs 非空时包含摘要', () => {
      const result = buildSubprojectPrompt({
        project: { name: 'app', type: 'react' },
        scanResult: { tree: '', keyFiles: [] },
        otherDocs: { sibling: '# 邻居项目\n说明\n' }
      });
      expect(result).toContain('sibling');
      expect(result).toContain('邻居项目');
    });

    test('无参数时不抛错', () => {
      expect(() => buildSubprojectPrompt()).not.toThrow();
    });
  });

  describe('buildInitPrompt 兼容分发', () => {
    test('type 为 overview 时与 buildOverviewPrompt 等价', () => {
      const args = {
        config: { projectName: 'eq', projects: [{ alias: 'a', label: 'A', type: 't' }] },
        generatedDocs: { a: 'doc' }
      };
      expect(buildInitPrompt({ type: 'overview', ...args }))
        .toBe(buildOverviewPrompt(args));
    });

    test('type 为 one-shot 时与 buildOneShotPrompt 等价', () => {
      const args = {
        projects: [{ alias: 'a', name: 'A', type: 't', path: '/a' }],
        scanResults: { a: { tree: 'tree-a', keyFiles: ['f.js'] } }
      };
      expect(buildInitPrompt({ type: 'one-shot', ...args }))
        .toBe(buildOneShotPrompt(args));
    });

    test('默认分支等价于 buildSubprojectPrompt', () => {
      const args = {
        project: { name: 'p', type: 't' },
        scanResult: { tree: 'tree', keyFiles: ['f'] }
      };
      expect(buildInitPrompt(args)).toBe(buildSubprojectPrompt(args));
    });
  });
});
