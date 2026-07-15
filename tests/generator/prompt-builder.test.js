const {
  buildUsePrompt,
  buildInitPrompt,
  buildOverviewPrompt,
  buildOneShotPrompt,
  buildSubprojectPrompt,
  buildApiPrompt,
  buildDatabasePrompt,
  getLabels
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

    test('将结构化源码内容而非仅文件名写入 prompt', () => {
      const result = buildSubprojectPrompt({
        project: { name: 'my-app', type: 'node', path: 'apps/my' },
        scanResult: {
          tree: 'src/',
          keyFiles: ['C:\\private\\repo\\src\\routes.js'],
          sourceFiles: [{
            path: 'src/routes.js',
            language: 'javascript',
            hash: 'abc123',
            content: 'router.get("/users", listUsers);',
            redactions: 0,
            truncation: { truncated: false, originalChars: 32, includedChars: 32, reason: null }
          }]
        }
      });

      expect(result).toContain('path="src/routes.js"');
      expect(result).toContain('router.get("/users", listUsers);');
      expect(result).toContain('sha256="abc123"');
      expect(result).not.toContain('C:\\private\\repo');
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

  describe('getLabels', () => {
    test('未传 language 返回中文 labels', () => {
      const labels = getLabels();
      expect(labels.projectName).toBe('项目名称');
    });

    test('zh 返回中文 labels', () => {
      const labels = getLabels('zh');
      expect(labels.projectName).toBe('项目名称');
    });

    test('en 返回英文 labels', () => {
      const labels = getLabels('en');
      expect(labels.projectName).toBe('Project Name');
    });

    test('未知 language 回退中文', () => {
      const labels = getLabels('fr');
      expect(labels.projectName).toBe('项目名称');
    });
  });

  describe('buildSubprojectPrompt 边界', () => {
    test('tree and sibling context limits are enforced in the final prompt', () => {
      const result = buildSubprojectPrompt({
        project: { name: 'bounded', type: 'generic-js-ts' },
        scanResult: { tree: 't'.repeat(20000), keyFiles: [] },
        otherDocs: { sibling: 'd'.repeat(30000) }
      });

      expect(result).toContain('[tree truncated at 8000 chars]');
      expect(result).toContain('[other docs truncated at 10000 chars]');
      expect(result).not.toContain('t'.repeat(9000));
    });
    test('keyFiles / tree 缺失时不出现 undefined', () => {
      const result = buildSubprojectPrompt({ project: { name: 'x' }, scanResult: {} });
      expect(result).not.toContain('undefined');
    });

    test('otherDocs 摘要被截断到前 15 行', () => {
      const longDoc = Array.from({ length: 50 }, (_, i) => `L${i}`).join('\n');
      const result = buildSubprojectPrompt({
        project: { name: 'app', type: 'react' },
        scanResult: { tree: '', keyFiles: [] },
        otherDocs: { sibling: longDoc }
      });
      expect(result).toContain('L0');
      expect(result).toContain('L14');
      expect(result).not.toContain('L20');
    });

    test('多个 otherDocs 同时摘要', () => {
      const result = buildSubprojectPrompt({
        project: { name: 'app' },
        scanResult: { tree: '', keyFiles: [] },
        otherDocs: { a: 'doc-a', b: 'doc-b' }
      });
      expect(result).toContain('doc-a');
      expect(result).toContain('doc-b');
    });
  });

  describe('buildOverviewPrompt 边界', () => {
    test('generatedDocs 中无对应 alias 时摘要为空', () => {
      const result = buildOverviewPrompt({
        config: { projectName: 'p', projects: [{ alias: 'x', label: 'X', type: 't' }] },
        generatedDocs: {} // 无 x
      });
      expect(result).toContain('x');
      expect(result).not.toContain('undefined');
    });

    test('generatedDocs 文档被截断到前 20 行', () => {
      const longDoc = Array.from({ length: 60 }, (_, i) => `Line ${i}`).join('\n');
      const result = buildOverviewPrompt({
        config: { projectName: 'p', projects: [{ alias: 'x', label: 'X', type: 't' }] },
        generatedDocs: { x: longDoc }
      });
      expect(result).toContain('Line 0');
      expect(result).toContain('Line 19');
      expect(result).not.toContain('Line 30');
    });
  });

  describe('buildOneShotPrompt 边界', () => {
    test('scanResults 中无对应 alias 时 tree/keyFiles 为空', () => {
      const result = buildOneShotPrompt({
        projects: [{ alias: 'p', name: 'P', type: 't', path: '/p' }],
        scanResults: {} // 无 p
      });
      expect(result).toContain('P');
      expect(result).not.toContain('undefined');
    });

    test('英文 language 走英文 labels', () => {
      const result = buildOneShotPrompt({
        projects: [{ alias: 'p', name: 'P', type: 't', path: '/p' }],
        scanResults: { p: { tree: 'tree-p', keyFiles: ['f'] } },
        language: 'en'
      });
      expect(result).toContain('Project Name');
    });
  });

  describe('buildApiPrompt', () => {
    test('正确归类 Controller / Service 文件', () => {
      const result = buildApiPrompt({
        project: { name: 'svc', type: 'spring-boot', path: '/svc' },
        scanResult: {
          tree: 'src/...',
          keyFiles: [
            'src/main/java/foo/controller/UserController.java',
            'src/main/java/foo/service/UserService.java',
            'src/main/java/foo/entity/User.java'
          ]
        }
      });
      expect(result).toContain('UserController.java');
      expect(result).toContain('UserService.java');
      expect(result).not.toContain('未找到 Controller 文件');
    });

    test('Windows 反斜杠路径也能正确归类', () => {
      const result = buildApiPrompt({
        project: { name: 'svc', type: 'spring-boot' },
        scanResult: {
          tree: '',
          keyFiles: ['src\\main\\java\\foo\\controller\\AController.java']
        }
      });
      expect(result).toContain('AController.java');
    });

    test('无 Controller / Service 时显示占位文本', () => {
      const result = buildApiPrompt({
        project: { name: 'empty' },
        scanResult: { tree: '', keyFiles: [] }
      });
      expect(result).toContain('未找到 Controller 文件');
      expect(result).toContain('未找到 Service 文件');
    });

    test('project / scanResult 缺失时返回字符串', () => {
      const result = buildApiPrompt({});
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('buildDatabasePrompt', () => {
    test('正确归类 Entity / Repository / Config 文件', () => {
      const result = buildDatabasePrompt({
        project: { name: 'svc', type: 'spring-boot' },
        scanResult: {
          tree: '',
          keyFiles: [
            'src/main/java/foo/entity/User.java',
            'src/main/java/foo/model/Order.java',
            'src/main/java/foo/repository/UserRepository.java',
            'src/main/java/foo/mapper/OrderMapper.java',
            'src/main/resources/application.yml',
            'pom.xml',
            'build.gradle'
          ]
        }
      });
      expect(result).toContain('User.java');
      expect(result).toContain('Order.java');
      expect(result).toContain('UserRepository.java');
      expect(result).toContain('OrderMapper.java');
      expect(result).toContain('application.yml');
      expect(result).toContain('pom.xml');
      expect(result).toContain('build.gradle');
    });

    test('application.properties 也算配置', () => {
      const result = buildDatabasePrompt({
        project: { name: 'svc' },
        scanResult: { tree: '', keyFiles: ['src/main/resources/application.properties'] }
      });
      expect(result).toContain('application.properties');
    });

    test('未匹配任何类别时全部回退占位', () => {
      const result = buildDatabasePrompt({
        project: { name: 'misc' },
        scanResult: { tree: '', keyFiles: ['unrelated/file.txt'] }
      });
      expect(result).toContain('未找到 Entity/Model 文件');
      expect(result).toContain('未找到 Repository/Mapper 文件');
      expect(result).toContain('未找到配置文件');
    });
  });
});
