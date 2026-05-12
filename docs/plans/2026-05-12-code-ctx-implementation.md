# Code-ctx 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现一个 AI 开发上下文工具，让 AI 编程助手在任意项目里都能立刻"认识"代码库

**Architecture:** Node.js CLI 工具，扫描项目结构生成文档，根据任务描述生成 prompt，支持多种 AI 工具集成

**Tech Stack:** Node.js, Commander, Express, Vue 3, Vite

---

## 里程碑 1：能用版（Task 1-8）

### Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `bin/cli.js`
- Create: `src/index.js`
- Create: `.gitignore`

**Step 1: 创建 package.json**

```json
{
  "name": "code-ctx",
  "version": "1.0.0",
  "description": "AI 开发上下文工具",
  "main": "src/index.js",
  "bin": {
    "code-ctx": "./bin/cli.js"
  },
  "scripts": {
    "test": "jest",
    "lint": "eslint src/"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "glob": "^10.0.0",
    "chardet": "^1.0.0",
    "iconv-lite": "^0.6.0",
    "clipboardy": "^3.0.0",
    "inquirer": "^9.0.0",
    "chalk": "^4.1.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  }
}
```

**Step 2: 创建 bin/cli.js**

```javascript
#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();

program
  .name('code-ctx')
  .description('AI 开发上下文工具')
  .version('1.0.0');

// 后续添加命令
// program.addCommand(require('../src/commands/init'));
// program.addCommand(require('../src/commands/use'));

program.parse();
```

**Step 3: 创建 src/index.js**

```javascript
module.exports = {
  // 主模块导出
};
```

**Step 4: 创建 .gitignore**

```
node_modules/
dist/
.ai-prompt.md
```

**Step 5: 运行验证**

Run: `node bin/cli.js --version`
Expected: `1.0.0`

**Step 6: 提交**

```bash
git add package.json bin/cli.js src/index.js .gitignore
git commit -m "feat: 初始化项目结构"
```

---

### Task 2: 工具函数 - 文件编码处理

**Files:**
- Create: `src/utils/file-reader.js`
- Create: `tests/utils/file-reader.test.js`

**Step 1: 编写测试**

```javascript
// tests/utils/file-reader.test.js
const { readFileUTF8 } = require('../../src/utils/file-reader');
const fs = require('fs');
const path = require('path');

describe('readFileUTF8', () => {
  const testDir = path.join(__dirname, '../fixtures');
  
  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  test('should read UTF-8 file correctly', () => {
    const filePath = path.join(testDir, 'utf8.txt');
    fs.writeFileSync(filePath, 'Hello World', 'utf8');
    expect(readFileUTF8(filePath)).toBe('Hello World');
  });

  test('should read GBK file correctly', () => {
    const filePath = path.join(testDir, 'gbk.txt');
    const iconv = require('iconv-lite');
    const buffer = iconv.encode('你好世界', 'gbk');
    fs.writeFileSync(filePath, buffer);
    expect(readFileUTF8(filePath)).toBe('你好世界');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/utils/file-reader.test.js`
Expected: FAIL with "Cannot find module"

**Step 3: 实现文件编码处理**

```javascript
// src/utils/file-reader.js
const fs = require('fs');
const chardet = require('chardet');
const iconv = require('iconv-lite');

function readFileUTF8(filePath) {
  const buffer = fs.readFileSync(filePath);
  const encoding = chardet.detect(buffer) || 'UTF-8';
  return iconv.decode(buffer, encoding);
}

module.exports = { readFileUTF8 };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/utils/file-reader.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/utils/file-reader.js tests/utils/file-reader.test.js
git commit -m "feat: 添加文件编码处理工具"
```

---

### Task 3: 项目探测器

**Files:**
- Create: `src/scanner/project-detector.js`
- Create: `tests/scanner/project-detector.test.js`

**Step 1: 编写测试**

```javascript
// tests/scanner/project-detector.test.js
const { detectProjects } = require('../../src/scanner/project-detector');
const fs = require('fs');
const path = require('path');

describe('detectProjects', () => {
  const testDir = path.join(__dirname, '../fixtures/projects');
  
  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should detect uni-app project', () => {
    const projectDir = path.join(testDir, 'my-app');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      dependencies: { 'uni-app': '^2.0.0' }
    }));
    fs.writeFileSync(path.join(projectDir, 'manifest.json'), JSON.stringify({
      'mp-weixin': {}
    }));

    const projects = detectProjects(testDir);
    expect(projects).toHaveLength(1);
    expect(projects[0].type).toBe('uniapp-miniprogram');
  });

  test('should detect Vue2 admin project', () => {
    const projectDir = path.join(testDir, 'admin');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      dependencies: { 'vue': '^2.0.0', 'element-ui': '^2.0.0' }
    }));

    const projects = detectProjects(testDir);
    expect(projects.some(p => p.type === 'vue2-admin')).toBe(true);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/scanner/project-detector.test.js`
Expected: FAIL

**Step 3: 实现项目探测器**

```javascript
// src/scanner/project-detector.js
const fs = require('fs');
const path = require('path');
const { readFileUTF8 } = require('../utils/file-reader');

const PROJECT_TYPES = {
  'uniapp-miniprogram': {
    check: (pkg, files) => {
      return pkg.dependencies?.['uni-app'] || files.includes('manifest.json');
    }
  },
  'vue2-admin': {
    check: (pkg) => {
      return pkg.dependencies?.vue && pkg.dependencies?.['element-ui'];
    }
  },
  'vue3-admin': {
    check: (pkg) => {
      return pkg.dependencies?.vue && pkg.dependencies?.['@element-plus'];
    }
  },
  'react': {
    check: (pkg) => {
      return pkg.dependencies?.react;
    }
  },
  'java-backend': {
    check: (pkg, files) => {
      return files.includes('pom.xml') || files.includes('build.gradle');
    }
  },
  'node-backend': {
    check: (pkg) => {
      return pkg.dependencies?.express || pkg.dependencies?.koa || pkg.dependencies?.['@nestjs/core'];
    }
  },
  'go-backend': {
    check: (pkg, files) => {
      return files.includes('go.mod');
    }
  },
  'python-backend': {
    check: (pkg, files) => {
      return files.includes('requirements.txt') || files.includes('pyproject.toml');
    }
  }
};

function detectProjects(rootDir) {
  const projects = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const projectDir = path.join(rootDir, entry.name);
    const files = fs.readdirSync(projectDir);
    
    if (!files.includes('package.json')) {
      // 检查非 Node 项目
      for (const [type, config] of Object.entries(PROJECT_TYPES)) {
        if (config.check({}, files)) {
          projects.push({
            alias: entry.name.replace(/[^a-z0-9]/g, '-').substring(0, 10),
            path: projectDir,
            type,
            name: entry.name
          });
        }
      }
      continue;
    }
    
    const pkgPath = path.join(projectDir, 'package.json');
    const pkg = JSON.parse(readFileUTF8(pkgPath));
    
    for (const [type, config] of Object.entries(PROJECT_TYPES)) {
      if (config.check(pkg, files)) {
        projects.push({
          alias: entry.name.replace(/[^a-z0-9]/g, '-').substring(0, 10),
          path: projectDir,
          type,
          name: entry.name
        });
        break;
      }
    }
  }
  
  return projects;
}

module.exports = { detectProjects };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/scanner/project-detector.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/scanner/project-detector.js tests/scanner/project-detector.test.js
git commit -m "feat: 添加项目探测器"
```

---

### Task 4: 文件扫描器

**Files:**
- Create: `src/scanner/file-scanner.js`
- Create: `tests/scanner/file-scanner.test.js`

**Step 1: 编写测试**

```javascript
// tests/scanner/file-scanner.test.js
const { scanProject } = require('../../src/scanner/file-scanner');
const fs = require('fs');
const path = require('path');

describe('scanProject', () => {
  const testDir = path.join(__dirname, '../fixtures/scan-project');
  
  beforeAll(() => {
    // 创建测试项目结构
    fs.mkdirSync(path.join(testDir, 'src/api'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'src/router'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(testDir, 'src/api/user.js'), 'export default {}');
    fs.writeFileSync(path.join(testDir, 'src/router/index.js'), 'export default []');
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should scan Vue2 admin project files', () => {
    const result = scanProject(testDir, 'vue2-admin');
    expect(result.tree).toBeDefined();
    expect(result.keyFiles).toBeDefined();
    expect(result.keyFiles.some(f => f.includes('api'))).toBe(true);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/scanner/file-scanner.test.js`
Expected: FAIL

**Step 3: 实现文件扫描器**

```javascript
// src/scanner/file-scanner.js
const fs = require('fs');
const path = require('path');
const { readFileUTF8 } = require('../utils/file-reader');

const SCAN_PATTERNS = {
  'vue2-admin': [
    'src/api/*.js',
    'src/router/modules/*.js',
    'src/store/modules/*.js',
    '.env.*'
  ],
  'vue3-admin': [
    'src/api/*.js',
    'src/router/*.js',
    'src/stores/*.js',
    '.env.*'
  ],
  'uniapp-miniprogram': [
    'api/*.js',
    'pages.json',
    'config/app.js',
    'utils/request.js'
  ],
  'java-backend': [
    '**/controller/**/*.java',
    'application.yml',
    'application.properties'
  ],
  'node-backend': [
    'routes/*.js',
    'controllers/*.js',
    'app.js'
  ]
};

function scanProject(projectDir, projectType) {
  const patterns = SCAN_PATTERNS[projectType] || [];
  const keyFiles = [];
  const tree = buildTree(projectDir);
  
  for (const pattern of patterns) {
    // 简化：直接扫描目录
    const dir = pattern.split('/')[0];
    const dirPath = path.join(projectDir, dir);
    if (fs.existsSync(dirPath)) {
      const files = getAllFiles(dirPath);
      keyFiles.push(...files);
    }
  }
  
  return { tree, keyFiles };
}

function buildTree(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let tree = '';
  
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tree += `${prefix}├── ${entry.name}/\n`;
      tree += buildTree(fullPath, prefix + '│   ');
    } else {
      tree += `${prefix}├── ${entry.name}\n`;
    }
  }
  
  return tree;
}

function getAllFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

module.exports = { scanProject };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/scanner/file-scanner.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/scanner/file-scanner.js tests/scanner/file-scanner.test.js
git commit -m "feat: 添加文件扫描器"
```

---

### Task 5: 模板引擎

**Files:**
- Create: `src/template/engine.js`
- Create: `templates/scenarios.json`
- Create: `tests/template/engine.test.js`

**Step 1: 编写测试**

```javascript
// tests/template/engine.test.js
const { renderTemplate, getScenarios } = require('../../src/template/engine');

describe('Template Engine', () => {
  test('should render template with variables', () => {
    const template = '项目：{{projectName}}，端口：{{port}}';
    const variables = { projectName: 'my-app', port: '8080' };
    expect(renderTemplate(template, variables)).toBe('项目：my-app，端口：8080');
  });

  test('should get default scenarios', () => {
    const scenarios = getScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios[0]).toHaveProperty('id');
    expect(scenarios[0]).toHaveProperty('name');
    expect(scenarios[0]).toHaveProperty('template');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/template/engine.test.js`
Expected: FAIL

**Step 3: 创建模板文件**

```json
// templates/scenarios.json
[
  {
    "id": "A",
    "name": "新增前端功能",
    "description": "新增页面、组件、功能",
    "relatedProjects": ["web", "api"],
    "template": "任务：在{{projectName}}新增【{{featureName}}】功能。\n\n要求：\n1. 页面位置：【待填写】\n2. 功能描述：【待填写】\n3. 接口路径：遵循 {{apiPrefix}} 约定\n\n先列出需要改动的完整文件清单，确认后逐个实现。"
  },
  {
    "id": "B",
    "name": "新增后台功能",
    "description": "新增管理后台功能",
    "relatedProjects": ["admin", "api"],
    "template": "任务：在管理后台新增【{{featureName}}】功能。\n\n要求：\n1. 菜单位置：【待填写】\n2. 页面功能：【待填写】\n3. 后端接口：路径遵循 {{apiPrefix}} 约定\n\n先列出需要改动的完整文件清单，确认后逐个实现。"
  },
  {
    "id": "F",
    "name": "排查 Bug",
    "description": "定位和修复问题",
    "relatedProjects": [],
    "template": "任务：排查并修复以下问题。\n\n问题描述：【待填写：详细描述问题现象】\n\n复现步骤：【待填写】\n\n期望行为：【待填写】\n\n请先分析可能的原因，然后给出修复方案。"
  }
]
```

**Step 4: 实现模板引擎**

```javascript
// src/template/engine.js
const fs = require('fs');
const path = require('path');

const DEFAULT_SCENARIOS_PATH = path.join(__dirname, '../../templates/scenarios.json');

function renderTemplate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

function getScenarios(customPath) {
  const scenariosPath = customPath || DEFAULT_SCENARIOS_PATH;
  const content = fs.readFileSync(scenariosPath, 'utf8');
  return JSON.parse(content);
}

module.exports = { renderTemplate, getScenarios };
```

**Step 5: 运行测试确认通过**

Run: `npm test -- tests/template/engine.test.js`
Expected: PASS

**Step 6: 提交**

```bash
git add src/template/engine.js templates/scenarios.json tests/template/engine.test.js
git commit -m "feat: 添加模板引擎和默认场景"
```

---

### Task 6: init 命令

**Files:**
- Create: `src/commands/init.js`
- Create: `tests/commands/init.test.js`

**Step 1: 编写测试**

```javascript
// tests/commands/init.test.js
const { initCommand } = require('../../src/commands/init');
const fs = require('fs');
const path = require('path');

describe('initCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/init-test');
  
  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  test('should create ai-docs directory', async () => {
    // 创建一个简单的测试项目
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');
    
    await initCommand(testDir, { skipPrompt: true });
    
    expect(fs.existsSync(path.join(testDir, 'ai-docs'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.js'))).toBe(true);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/commands/init.test.js`
Expected: FAIL

**Step 3: 实现 init 命令**

```javascript
// src/commands/init.js
const fs = require('fs');
const path = require('path');
const { detectProjects } = require('../scanner/project-detector');
const { scanProject } = require('../scanner/file-scanner');

async function initCommand(rootDir, options = {}) {
  console.log('🔍 扫描项目结构...');
  
  // 1. 探测子项目
  const projects = detectProjects(rootDir);
  console.log(`检测到 ${projects.length} 个子项目`);
  
  // 2. 创建输出目录
  const outputDir = path.join(rootDir, 'ai-docs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 3. 扫描每个子项目
  const scanResults = {};
  for (const project of projects) {
    console.log(`扫描 ${project.name} (${project.type})...`);
    scanResults[project.alias] = scanProject(project.path, project.type);
  }
  
  // 4. 生成配置文件
  const config = {
    projectName: path.basename(rootDir),
    outputDir: './ai-docs',
    aiMode: 'clipboard',
    projects: projects.map(p => ({
      alias: p.alias,
      path: `./${p.name}`,
      type: p.type,
      label: p.name
    })),
    excludeDirs: ['node_modules', '.git', 'dist', 'build', 'ai-docs'],
    gitTrack: true
  };
  
  const configPath = path.join(rootDir, 'code-ctx.config.js');
  fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(config, null, 2)};\n`);
  
  // 5. 生成初始化提示
  console.log('\n✓ 初始化完成！');
  console.log(`ai-docs/ 已创建`);
  console.log('\n下一步：');
  console.log('  开始开发前：  code-ctx use "你的任务描述"');
  console.log('  代码有大改动：code-ctx update');
  console.log('  检查文档健康：code-ctx doctor');
  
  return { projects, config };
}

module.exports = { initCommand };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/commands/init.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/commands/init.js tests/commands/init.test.js
git commit -m "feat: 添加 init 命令"
```

---

### Task 7: use 命令（手动模式）

**Files:**
- Create: `src/commands/use.js`
- Create: `tests/commands/use.test.js`

**Step 1: 编写测试**

```javascript
// tests/commands/use.test.js
const { useCommand } = require('../../src/commands/use');
const fs = require('fs');
const path = require('path');

describe('useCommand', () => {
  test('should generate prompt for scenario', async () => {
    const prompt = await useCommand({
      scenario: 'A',
      projectName: 'test-app',
      featureName: '用户登录',
      apiPrefix: '/api/'
    });
    
    expect(prompt).toContain('test-app');
    expect(prompt).toContain('用户登录');
    expect(prompt).toContain('/api/');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/commands/use.test.js`
Expected: FAIL

**Step 3: 实现 use 命令**

```javascript
// src/commands/use.js
const { getScenarios, renderTemplate } = require('../template/engine');

async function useCommand(options = {}) {
  const { scenario, projectName, featureName, apiPrefix } = options;
  
  // 获取场景模板
  const scenarios = getScenarios();
  const selectedScenario = scenarios.find(s => s.id === scenario);
  
  if (!selectedScenario) {
    throw new Error(`未找到场景: ${scenario}`);
  }
  
  // 渲染模板
  const prompt = renderTemplate(selectedScenario.template, {
    projectName: projectName || '项目',
    featureName: featureName || '新功能',
    apiPrefix: apiPrefix || '/api/'
  });
  
  return prompt;
}

module.exports = { useCommand };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/commands/use.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/commands/use.js tests/commands/use.test.js
git commit -m "feat: 添加 use 命令（手动模式）"
```

---

### Task 8: CLI 集成

**Files:**
- Modify: `bin/cli.js`
- Create: `bin/commands/init.js`
- Create: `bin/commands/use.js`

**Step 1: 创建 CLI init 命令**

```javascript
// bin/commands/init.js
const { Command } = require('commander');
const { initCommand } = require('../../src/commands/init');

const init = new Command('init')
  .description('初始化项目，扫描结构生成 ai-docs/')
  .action(async () => {
    try {
      await initCommand(process.cwd());
    } catch (err) {
      console.error('初始化失败:', err.message);
      process.exit(1);
    }
  });

module.exports = init;
```

**Step 2: 创建 CLI use 命令**

```javascript
// bin/commands/use.js
const { Command } = require('commander');
const { useCommand } = require('../../src/commands/use');
const clipboardy = require('clipboardy');

const use = new Command('use')
  .description('生成开发 prompt')
  .argument('[task]', '任务描述')
  .option('-s, --scenario <id>', '场景 ID')
  .action(async (task, options) => {
    try {
      // 简单模式：手动选择场景
      const scenario = options.scenario || 'A';
      const prompt = await useCommand({
        scenario,
        projectName: '项目',
        featureName: task || '新功能'
      });
      
      await clipboardy.write(prompt);
      console.log('✓ 已复制到剪贴板');
      console.log('\n提示：粘贴后记得补充具体需求细节');
    } catch (err) {
      console.error('生成失败:', err.message);
      process.exit(1);
    }
  });

module.exports = use;
```

**Step 3: 更新主 CLI 文件**

```javascript
#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();

program
  .name('code-ctx')
  .description('AI 开发上下文工具')
  .version('1.0.0');

program.addCommand(require('./commands/init'));
program.addCommand(require('./commands/use'));

program.parse();
```

**Step 4: 测试 CLI**

Run: `node bin/cli.js init --help`
Expected: 显示 init 命令帮助

Run: `node bin/cli.js use --help`
Expected: 显示 use 命令帮助

**Step 5: 提交**

```bash
git add bin/
git commit -m "feat: 集成 CLI 命令"
```

---

## 里程碑 2：好用版（Task 9-16）

### Task 9: 场景匹配器

**Files:**
- Create: `src/matcher/scenario-matcher.js`
- Create: `tests/matcher/scenario-matcher.test.js`

**Step 1: 编写测试**

```javascript
// tests/matcher/scenario-matcher.test.js
const { matchScenario } = require('../../src/matcher/scenario-matcher');

describe('matchScenario', () => {
  test('should match miniapp keyword to scenario A', () => {
    const result = matchScenario('新增小程序用户登录功能');
    expect(result.scenarioId).toBe('A');
    expect(result.confidence).toBe(100);
  });

  test('should match admin keyword to scenario B', () => {
    const result = matchScenario('商户后台新增优惠券管理');
    expect(result.scenarioId).toBe('B');
  });

  test('should match bug keyword to scenario F', () => {
    const result = matchScenario('修复登录页面无法显示的bug');
    expect(result.scenarioId).toBe('F');
  });

  test('should return low confidence for ambiguous task', () => {
    const result = matchScenario('优化性能');
    expect(result.confidence).toBeLessThan(100);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/matcher/scenario-matcher.test.js`
Expected: FAIL

**Step 3: 实现场景匹配器**

```javascript
// src/matcher/scenario-matcher.js
const KEYWORDS = {
  'A': ['小程序', 'miniapp', 'uni-app', '前端', '页面', 'C端', '用户端'],
  'B': ['商户', '管理后台', 'admin', '后台', '管理端'],
  'C': ['平台', '管控', '运营'],
  'D': ['数据库', '表结构', 'schema', '迁移'],
  'E': ['优化', '重构', '修改', '调整', '改进'],
  'F': ['bug', '错误', '问题', '修复', '排查', '异常'],
  'G': ['后端', '接口', 'API', '服务端'],
  'H': ['跨端', '多端', '联动', '全栈']
};

function matchScenario(taskDescription) {
  const task = taskDescription.toLowerCase();
  
  for (const [scenarioId, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      if (task.includes(keyword.toLowerCase())) {
        return {
          scenarioId,
          confidence: 100,
          matchedKeyword: keyword
        };
      }
    }
  }
  
  // 默认返回 A，低置信度
  return {
    scenarioId: 'A',
    confidence: 30,
    matchedKeyword: null
  };
}

module.exports = { matchScenario };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/matcher/scenario-matcher.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/matcher/scenario-matcher.js tests/matcher/scenario-matcher.test.js
git commit -m "feat: 添加场景匹配器"
```

---

### Task 10: update 命令

**Files:**
- Create: `src/commands/update.js`
- Create: `tests/commands/update.test.js`

**Step 1: 编写测试**

```javascript
// tests/commands/update.test.js
const { updateCommand } = require('../../src/commands/update');
const fs = require('fs');
const path = require('path');

describe('updateCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/update-test');
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should detect changed files', async () => {
    // 创建初始状态
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan'), JSON.stringify({
      timestamp: new Date().toISOString(),
      files: { 'src/index.js': 'abc123' }
    }));
    
    // 修改文件
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'new content');
    
    const result = await updateCommand(testDir, { dryRun: true });
    expect(result.changedFiles.length).toBeGreaterThan(0);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/commands/update.test.js`
Expected: FAIL

**Step 3: 实现 update 命令**

```javascript
// src/commands/update.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

async function updateCommand(rootDir, options = {}) {
  const lastScanPath = path.join(rootDir, 'ai-docs/.last-scan');
  
  // 读取上次扫描状态
  let lastScan = { timestamp: null, files: {} };
  if (fs.existsSync(lastScanPath)) {
    lastScan = JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
  }
  
  // 扫描当前文件
  const currentFiles = {};
  const srcDir = path.join(rootDir, 'src');
  if (fs.existsSync(srcDir)) {
    const files = getAllFiles(srcDir);
    for (const file of files) {
      const relativePath = path.relative(rootDir, file);
      currentFiles[relativePath] = getFileHash(file);
    }
  }
  
  // 找出变化的文件
  const changedFiles = [];
  for (const [file, hash] of Object.entries(currentFiles)) {
    if (lastScan.files[file] !== hash) {
      changedFiles.push(file);
    }
  }
  
  // 更新扫描状态
  if (!options.dryRun) {
    const newScan = {
      timestamp: new Date().toISOString(),
      files: currentFiles
    };
    fs.writeFileSync(lastScanPath, JSON.stringify(newScan, null, 2));
  }
  
  return { changedFiles };
}

function getAllFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

module.exports = { updateCommand };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/commands/update.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/commands/update.js tests/commands/update.test.js
git commit -m "feat: 添加 update 命令"
```

---

### Task 11: doctor 命令

**Files:**
- Create: `src/commands/doctor.js`
- Create: `tests/commands/doctor.test.js`

**Step 1: 编写测试**

```javascript
// tests/commands/doctor.test.js
const { doctorCommand } = require('../../src/commands/doctor');
const fs = require('fs');
const path = require('path');

describe('doctorCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/doctor-test');
  
  beforeEach(() => {
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should check section completeness', async () => {
    // 创建不完整的文档
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# Overview\nSome content');
    
    const report = await doctorCommand(testDir);
    expect(report.issues.length).toBeGreaterThan(0);
  });

  test('should detect sensitive information', async () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/config.md'), 'password = "secret123"');
    
    const report = await doctorCommand(testDir);
    expect(report.warnings.some(w => w.includes('敏感'))).toBe(true);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/commands/doctor.test.js`
Expected: FAIL

**Step 3: 实现 doctor 命令**

```javascript
// src/commands/doctor.js
const fs = require('fs');
const path = require('path');

const REQUIRED_SECTIONS = {
  'OVERVIEW.md': ['## 项目概述', '## 子项目列表', '## 技术栈'],
  'api-contracts.md': ['## 接口列表']
};

const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*["']?[^"'\s]+/i,
  /secret\s*[:=]\s*["']?[^"'\s]+/i,
  /token\s*[:=]\s*["']?[^"'\s]+/i,
  /api[_-]?key\s*[:=]\s*["']?[^"'\s]+/i
];

async function doctorCommand(rootDir) {
  const aiDocsDir = path.join(rootDir, 'ai-docs');
  const issues = [];
  const warnings = [];
  
  if (!fs.existsSync(aiDocsDir)) {
    issues.push('ai-docs/ 目录不存在');
    return { issues, warnings };
  }
  
  // 检查必要文件
  for (const [file, sections] of Object.entries(REQUIRED_SECTIONS)) {
    const filePath = path.join(aiDocsDir, file);
    if (!fs.existsSync(filePath)) {
      issues.push(`${file} 不存在`);
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    for (const section of sections) {
      if (!content.includes(section)) {
        issues.push(`${file} 缺少章节: ${section}`);
      }
    }
  }
  
  // 检查敏感信息
  const files = fs.readdirSync(aiDocsDir);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    
    const content = fs.readFileSync(path.join(aiDocsDir, file), 'utf8');
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(`${file} 可能包含敏感信息`);
        break;
      }
    }
  }
  
  return { issues, warnings };
}

module.exports = { doctorCommand };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/commands/doctor.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/commands/doctor.js tests/commands/doctor.test.js
git commit -m "feat: 添加 doctor 命令"
```

---

### Task 12: dashboard 命令（后端）

**Files:**
- Create: `src/web/server.js`
- Create: `src/web/api/config.js`
- Create: `src/web/api/projects.js`

**Step 1: 创建服务器**

```javascript
// src/web/server.js
const express = require('express');
const path = require('path');

function createServer(rootDir) {
  const app = express();
  
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));
  
  // API 路由
  app.use('/api/config', require('./api/config')(rootDir));
  app.use('/api/projects', require('./api/projects')(rootDir));
  
  // SPA 回退
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  
  return app;
}

function startServer(rootDir, port = 3456) {
  const app = createServer(rootDir);
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Dashboard 运行在 http://localhost:${port}`);
      resolve(server);
    });
  });
}

module.exports = { createServer, startServer };
```

**Step 2: 创建配置 API**

```javascript
// src/web/api/config.js
const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = function(rootDir) {
  const router = express.Router();
  
  router.get('/', (req, res) => {
    const configPath = path.join(rootDir, 'code-ctx.config.js');
    if (fs.existsSync(configPath)) {
      delete require.cache[require.resolve(configPath)];
      const config = require(configPath);
      res.json(config);
    } else {
      res.json({ error: '配置文件不存在' });
    }
  });
  
  router.put('/', (req, res) => {
    const configPath = path.join(rootDir, 'code-ctx.config.js');
    const content = `module.exports = ${JSON.stringify(req.body, null, 2)};\n`;
    fs.writeFileSync(configPath, content);
    res.json({ success: true });
  });
  
  return router;
};
```

**Step 3: 创建项目 API**

```javascript
// src/web/api/projects.js
const express = require('express');
const { detectProjects } = require('../../scanner/project-detector');

module.exports = function(rootDir) {
  const router = express.Router();
  
  router.get('/', (req, res) => {
    const projects = detectProjects(rootDir);
    res.json(projects);
  });
  
  return router;
};
```

**Step 4: 测试服务器**

Run: `node -e "const {startServer} = require('./src/web/server'); startServer('.').then(s => s.close())"`
Expected: 服务器启动成功

**Step 5: 提交**

```bash
git add src/web/
git commit -m "feat: 添加 dashboard 后端服务"
```

---

### Task 13: dashboard 命令（前端）

**Files:**
- Create: `web/` (Vue 3 项目)
- Create: `web/package.json`
- Create: `web/src/App.vue`
- Create: `web/src/views/Config.vue`

**Step 1: 创建前端项目结构**

```json
// web/package.json
{
  "name": "code-ctx-web",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "vue": "^3.3.0",
    "vue-router": "^4.2.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^4.4.0",
    "vite": "^4.5.0"
  }
}
```

**Step 2: 创建主应用**

```vue
// web/src/App.vue
<template>
  <div id="app">
    <nav>
      <router-link to="/">配置</router-link>
      <router-link to="/projects">项目</router-link>
      <router-link to="/generate">生成</router-link>
    </nav>
    <main>
      <router-view />
    </main>
  </div>
</template>

<style>
nav {
  padding: 1rem;
  background: #f5f5f5;
}
nav a {
  margin-right: 1rem;
}
</style>
```

**Step 3: 创建配置页面**

```vue
// web/src/views/Config.vue
<template>
  <div class="config">
    <h1>配置管理</h1>
    <div v-if="loading">加载中...</div>
    <div v-else>
      <div>
        <label>项目名称：</label>
        <input v-model="config.projectName" />
      </div>
      <div>
        <label>输出目录：</label>
        <input v-model="config.outputDir" />
      </div>
      <button @click="save">保存</button>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      config: {},
      loading: true
    };
  },
  async mounted() {
    const res = await axios.get('/api/config');
    this.config = res.data;
    this.loading = false;
  },
  methods: {
    async save() {
      await axios.put('/api/config', this.config);
      alert('保存成功');
    }
  }
};
</script>
```

**Step 4: 构建前端**

Run: `cd web && npm install && npm run build`
Expected: 构建成功，输出到 `web/dist/`

**Step 5: 提交**

```bash
git add web/
git commit -m "feat: 添加 dashboard 前端"
```

---

### Task 14: CLI dashboard 命令

**Files:**
- Modify: `bin/cli.js`
- Create: `bin/commands/dashboard.js`

**Step 1: 创建 dashboard CLI 命令**

```javascript
// bin/commands/dashboard.js
const { Command } = require('commander');
const { startServer } = require('../../src/web/server');

const dashboard = new Command('dashboard')
  .description('打开本地 Web 管理页面')
  .option('-p, --port <port>', '端口号', '3456')
  .action(async (options) => {
    try {
      await startServer(process.cwd(), parseInt(options.port));
    } catch (err) {
      console.error('启动失败:', err.message);
      process.exit(1);
    }
  });

module.exports = dashboard;
```

**Step 2: 更新主 CLI**

```javascript
#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();

program
  .name('code-ctx')
  .description('AI 开发上下文工具')
  .version('1.0.0');

program.addCommand(require('./commands/init'));
program.addCommand(require('./commands/use'));
program.addCommand(require('./commands/dashboard'));

program.parse();
```

**Step 3: 测试 CLI**

Run: `node bin/cli.js dashboard --help`
Expected: 显示 dashboard 命令帮助

**Step 4: 提交**

```bash
git add bin/
git commit -m "feat: 集成 dashboard CLI 命令"
```

---

### Task 15: 敏感信息过滤

**Files:**
- Create: `src/utils/sensitive-filter.js`
- Create: `tests/utils/sensitive-filter.test.js`

**Step 1: 编写测试**

```javascript
// tests/utils/sensitive-filter.test.js
const { filterSensitive } = require('../../src/utils/sensitive-filter');

describe('filterSensitive', () => {
  test('should redact password', () => {
    const input = 'password = "secret123"';
    const result = filterSensitive(input);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('secret123');
  });

  test('should redact api key', () => {
    const input = 'api_key: sk-1234567890';
    const result = filterSensitive(input);
    expect(result).toContain('[REDACTED]');
  });

  test('should keep normal content', () => {
    const input = 'This is normal content';
    const result = filterSensitive(input);
    expect(result).toBe(input);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/utils/sensitive-filter.test.js`
Expected: FAIL

**Step 3: 实现敏感信息过滤**

```javascript
// src/utils/sensitive-filter.js
const DEFAULT_PATTERNS = [
  { pattern: /(password\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[REDACTED]' },
  { pattern: /(secret\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[REDACTED]' },
  { pattern: /(token\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[REDACTED]' },
  { pattern: /(api[_-]?key\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[REDACTED]' },
  { pattern: /(private[_-]?key\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[REDACTED]' }
];

function filterSensitive(content, customPatterns = []) {
  let result = content;
  const patterns = [...DEFAULT_PATTERNS, ...customPatterns];
  
  for (const { pattern, replacement } of patterns) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

module.exports = { filterSensitive };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/utils/sensitive-filter.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/utils/sensitive-filter.js tests/utils/sensitive-filter.test.js
git commit -m "feat: 添加敏感信息过滤"
```

---

### Task 16: 任务历史记录

**Files:**
- Create: `src/utils/task-history.js`
- Create: `tests/utils/task-history.test.js`

**Step 1: 编写测试**

```javascript
// tests/utils/task-history.test.js
const { addTask, getHistory } = require('../../src/utils/task-history');
const fs = require('fs');
const path = require('path');

describe('task-history', () => {
  const testDir = path.join(__dirname, '../fixtures/history-test');
  const historyPath = path.join(testDir, '.task-history.jsonl');
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should add task to history', () => {
    addTask(testDir, {
      task: '新增用户登录',
      scenario: 'A',
      projects: ['web', 'api']
    });
    
    expect(fs.existsSync(historyPath)).toBe(true);
    const content = fs.readFileSync(historyPath, 'utf8');
    expect(content).toContain('新增用户登录');
  });

  test('should read history', () => {
    addTask(testDir, { task: '任务1', scenario: 'A' });
    addTask(testDir, { task: '任务2', scenario: 'B' });
    
    const history = getHistory(testDir);
    expect(history.length).toBe(2);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/utils/task-history.test.js`
Expected: FAIL

**Step 3: 实现任务历史记录**

```javascript
// src/utils/task-history.js
const fs = require('fs');
const path = require('path');

function addTask(rootDir, taskData) {
  const historyPath = path.join(rootDir, 'ai-docs/.task-history.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    ...taskData
  };
  
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(historyPath, line);
}

function getHistory(rootDir) {
  const historyPath = path.join(rootDir, 'ai-docs/.task-history.jsonl');
  
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  
  const content = fs.readFileSync(historyPath, 'utf8');
  return content.trim().split('\n')
    .filter(line => line)
    .map(line => JSON.parse(line));
}

module.exports = { addTask, getHistory };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/utils/task-history.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/utils/task-history.js tests/utils/task-history.test.js
git commit -m "feat: 添加任务历史记录"
```

---

## 里程碑 3：自动化版（Task 17-20）

### Task 17: AI 调用封装

**Files:**
- Create: `src/ai/client.js`
- Create: `tests/ai/client.test.js`

**Step 1: 编写测试**

```javascript
// tests/ai/client.test.js
const { generateWithAI } = require('../../src/ai/client');

describe('generateWithAI', () => {
  test('should throw error without API key', async () => {
    await expect(generateWithAI('test prompt')).rejects.toThrow('API key');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/ai/client.test.js`
Expected: FAIL

**Step 3: 实现 AI 调用封装**

```javascript
// src/ai/client.js
async function generateWithAI(prompt, options = {}) {
  const { apiKey, model = 'claude-3-sonnet-20240229', provider = 'anthropic' } = options;
  
  if (!apiKey) {
    throw new Error('需要配置 API key');
  }
  
  if (provider === 'anthropic') {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    
    return message.content[0].text;
  }
  
  throw new Error(`不支持的 provider: ${provider}`);
}

module.exports = { generateWithAI };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/ai/client.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/ai/client.js tests/ai/client.test.js
git commit -m "feat: 添加 AI 调用封装"
```

---

### Task 18: fix 命令

**Files:**
- Create: `src/commands/fix.js`
- Create: `tests/commands/fix.test.js`

**Step 1: 编写测试**

```javascript
// tests/commands/fix.test.js
const { fixCommand } = require('../../src/commands/fix');
const fs = require('fs');
const path = require('path');

describe('fixCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/fix-test');
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'ai-docs/web.md'), '# Old content');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should regenerate project documentation', async () => {
    const result = await fixCommand(testDir, 'web', { dryRun: true });
    expect(result.project).toBe('web');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/commands/fix.test.js`
Expected: FAIL

**Step 3: 实现 fix 命令**

```javascript
// src/commands/fix.js
const fs = require('fs');
const path = require('path');
const { scanProject } = require('../scanner/file-scanner');

async function fixCommand(rootDir, projectAlias, options = {}) {
  const configPath = path.join(rootDir, 'code-ctx.config.js');
  
  if (!fs.existsSync(configPath)) {
    throw new Error('配置文件不存在，请先运行 code-ctx init');
  }
  
  const config = require(configPath);
  const project = config.projects.find(p => p.alias === projectAlias);
  
  if (!project) {
    throw new Error(`未找到项目: ${projectAlias}`);
  }
  
  const projectDir = path.join(rootDir, project.path);
  const scanResult = scanProject(projectDir, project.type);
  
  // 生成修复提示
  const prompt = `请重新生成 ${project.name} (${project.type}) 的文档。

项目结构：
${scanResult.tree}

关键文件：
${scanResult.keyFiles.join('\n')}

请生成完整的项目文档，包含：
1. 项目概述
2. 目录结构说明
3. 核心模块说明
4. 开发注意事项`;

  if (!options.dryRun) {
    // 实际调用 AI 生成文档
    // 这里简化处理，实际应该调用 AI
    const docPath = path.join(rootDir, 'ai-docs', `${projectAlias}.md`);
    fs.writeFileSync(docPath, `# ${project.name}\n\n> 自动生成中...`);
  }
  
  return { project: projectAlias, prompt };
}

module.exports = { fixCommand };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/commands/fix.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/commands/fix.js tests/commands/fix.test.js
git commit -m "feat: 添加 fix 命令"
```

---

### Task 19: status 命令

**Files:**
- Create: `src/commands/status.js`
- Create: `tests/commands/status.test.js`

**Step 1: 编写测试**

```javascript
// tests/commands/status.test.js
const { statusCommand } = require('../../src/commands/status');
const fs = require('fs');
const path = require('path');

describe('statusCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/status-test');
  
  beforeEach(() => {
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# Overview');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should show document status', async () => {
    const status = await statusCommand(testDir);
    expect(status.documents.length).toBeGreaterThan(0);
    expect(status.documents[0].name).toBe('OVERVIEW.md');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/commands/status.test.js`
Expected: FAIL

**Step 3: 实现 status 命令**

```javascript
// src/commands/status.js
const fs = require('fs');
const path = require('path');

async function statusCommand(rootDir) {
  const aiDocsDir = path.join(rootDir, 'ai-docs');
  
  if (!fs.existsSync(aiDocsDir)) {
    return { documents: [], message: 'ai-docs/ 目录不存在' };
  }
  
  const files = fs.readdirSync(aiDocsDir).filter(f => f.endsWith('.md'));
  const documents = files.map(file => {
    const filePath = path.join(aiDocsDir, file);
    const stats = fs.statSync(filePath);
    return {
      name: file,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    };
  });
  
  return { documents };
}

module.exports = { statusCommand };
```

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/commands/status.test.js`
Expected: PASS

**Step 5: 提交**

```bash
git add src/commands/status.js tests/commands/status.test.js
git commit -m "feat: 添加 status 命令"
```

---

### Task 20: 完整集成测试

**Files:**
- Create: `tests/integration/full-flow.test.js`

**Step 1: 编写集成测试**

```javascript
// tests/integration/full-flow.test.js
const { initCommand } = require('../../src/commands/init');
const { useCommand } = require('../../src/commands/use');
const { doctorCommand } = require('../../src/commands/doctor');
const fs = require('fs');
const path = require('path');

describe('Full Flow Integration', () => {
  const testDir = path.join(__dirname, '../fixtures/integration-test');
  
  beforeAll(async () => {
    // 创建测试项目
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
      dependencies: { vue: '^2.0.0', 'element-ui': '^2.0.0' }
    }));
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should complete full workflow', async () => {
    // 1. Init
    await initCommand(testDir, { skipPrompt: true });
    expect(fs.existsSync(path.join(testDir, 'ai-docs'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'code-ctx.config.js'))).toBe(true);
    
    // 2. Use
    const prompt = await useCommand({
      scenario: 'B',
      projectName: 'test-app',
      featureName: '用户管理'
    });
    expect(prompt).toContain('用户管理');
    
    // 3. Doctor
    const report = await doctorCommand(testDir);
    expect(report).toBeDefined();
  });
});
```

**Step 2: 运行集成测试**

Run: `npm test -- tests/integration/full-flow.test.js`
Expected: PASS

**Step 3: 提交**

```bash
git add tests/integration/
git commit -m "test: 添加完整流程集成测试"
```

---

## 执行建议

**里程碑 1（Task 1-8）**：2-3 天完成，实现基础 CLI 功能

**里程碑 2（Task 9-16）**：1 周完成，实现智能模式和 Web 界面

**里程碑 3（Task 17-20）**：2 周完成，实现 AI 自动化

**每个 Task 的执行流程**：
1. 编写测试
2. 运行测试确认失败
3. 实现代码
4. 运行测试确认通过
5. 提交代码

**完成后**：
- 运行 `npm test` 确保所有测试通过
- 运行 `node bin/cli.js --help` 确认 CLI 正常工作
- 更新 README.md 文档
