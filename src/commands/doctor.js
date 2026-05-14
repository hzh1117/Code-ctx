const fs = require('fs');
const path = require('path');
const { DETECTION_PATTERNS, scanDirectory } = require('../utils/sensitive-filter');
const { detectProjects } = require('../scanner/project-detector');
const { scanProject } = require('../scanner/file-scanner');
const { getAIConfig, loadConfigWithVM } = require('../utils/config');
const { generateWithAI } = require('../ai/client');
const { filterSensitive } = require('../utils/sensitive-filter');
const { readFileUTF8 } = require('../utils/file-reader');
const { buildInitPrompt } = require('../generator/prompt-builder');
const { defaultRegistry } = require('../adapters');

function checkSectionIntegrity(aiDocsDir) {
  const issues = [];
  const requiredDocs = ['OVERVIEW.md'];

  // 检查必要文档是否存在
  for (const doc of requiredDocs) {
    if (!fs.existsSync(path.join(aiDocsDir, doc))) {
      issues.push({ type: 'missing', file: doc, message: `${doc} 不存在` });
    }
  }

  // 检查已有文档的章节完整性
  const files = fs.readdirSync(aiDocsDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const content = readFileUTF8(path.join(aiDocsDir, file));
    const lines = content.split('\n');

    // 检查是否有实质内容（不只是标题）
    const contentLines = lines.filter(l => l.trim() && !l.startsWith('#'));
    if (contentLines.length < 5) {
      issues.push({ type: 'sparse', file, message: `${file} 内容过少（${contentLines.length} 行有效内容）` });
    }

    // 检查 OVERVIEW 必要章节
    if (file === 'OVERVIEW.md') {
      const requiredSections = ['项目概述', '子项目', '技术栈'];
      for (const section of requiredSections) {
        const hasSection = lines.some(l => l.includes(section));
        if (!hasSection) {
          issues.push({ type: 'missing-section', file, message: `OVERVIEW.md 缺少「${section}」相关内容` });
        }
      }
    }
  }

  return issues;
}

function checkDocsVsCode(rootDir) {
  const issues = [];
  const configPath = path.join(rootDir, 'code-ctx.config.js');
  const aiDocsDir = path.join(rootDir, 'ai-docs');

  if (!fs.existsSync(configPath)) {
    issues.push({ type: 'no-config', message: 'code-ctx.config.js 不存在，请先运行 code-ctx init' });
    return issues;
  }

  let config;
  try {
    config = loadConfigWithVM(configPath);
  } catch {
    issues.push({ type: 'config-error', message: 'code-ctx.config.js 解析失败' });
    return issues;
  }

  const configProjects = config.projects || [];

  // 检查配置中的子项目是否真的存在
  for (const project of configProjects) {
    const projectDir = path.join(rootDir, project.path);
    if (!fs.existsSync(projectDir)) {
      issues.push({ type: 'project-missing', alias: project.alias, message: `子项目 ${project.alias} 目录不存在: ${project.path}` });
    }
  }

  // 检查实际目录是否都被配置覆盖
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'ai-docs') continue;

      const subDir = path.join(rootDir, entry.name);
      let files;
      try {
        files = fs.readdirSync(subDir);
      } catch {
        continue;
      }

      // 检查是否有 package.json、pom.xml 等项目标识文件
      const hasProjectFile = files.some(f => ['package.json', 'pom.xml', 'build.gradle', 'go.mod', 'requirements.txt', 'pyproject.toml'].includes(f));
      if (!hasProjectFile) continue;

      const isConfigured = configProjects.some(p => p.path === `./${entry.name}` || p.path === entry.name);
      if (!isConfigured) {
        issues.push({ type: 'unconfigured', directory: entry.name, message: `目录 ${entry.name} 看起来是子项目但未在配置中` });
      }
    }
  } catch {
    // 读取目录失败
  }

  return issues;
}

function checkDocsVsActual(rootDir) {
  const issues = [];
  const configPath = path.join(rootDir, 'code-ctx.config.js');
  const aiDocsDir = path.join(rootDir, 'ai-docs');

  if (!fs.existsSync(configPath) || !fs.existsSync(aiDocsDir)) return issues;

  let config;
  try {
    config = loadConfigWithVM(configPath);
  } catch {
    return issues;
  }

  for (const project of (config.projects || [])) {
    const docPath = path.join(aiDocsDir, `${project.alias}.md`);
    if (!fs.existsSync(docPath)) {
      issues.push({ type: 'doc-missing', alias: project.alias, message: `${project.alias}.md 不存在` });
      continue;
    }

    // 扫描实际项目
    try {
      const projectDir = path.join(rootDir, project.path);
      if (!fs.existsSync(projectDir)) continue;

      const scanResult = scanProject(projectDir, project.type);
      const docContent = readFileUTF8(docPath);

      // 检查关键文件是否在文档中被提及
      const keyFileNames = scanResult.keyFiles
        .map(f => path.basename(f))
        .filter(name => !['package.json', 'pom.xml', 'build.gradle'].includes(name));

      const mentionedCount = keyFileNames.filter(name => docContent.includes(name)).length;
      const mentionRate = keyFileNames.length > 0 ? mentionedCount / keyFileNames.length : 1;

      if (mentionRate < 0.3 && keyFileNames.length > 3) {
        issues.push({
          type: 'outdated',
          alias: project.alias,
          message: `${project.alias}.md 可能已过期（仅提及 ${Math.round(mentionRate * 100)}% 的关键文件）`,
          details: { mentionedCount, total: keyFileNames.length }
        });
      }

      // 检查目录结构是否与文档一致
      const treeLines = scanResult.tree.split('\n').filter(l => l.trim());
      const topDirs = treeLines
        .filter(l => l.includes('├──') && l.includes('/'))
        .map(l => l.match(/├── (\w+)\//)?.[1])
        .filter(Boolean);

      const mentionedDirs = topDirs.filter(dir => docContent.includes(dir));
      const dirMentionRate = topDirs.length > 0 ? mentionedDirs.length / topDirs.length : 1;

      if (dirMentionRate < 0.5 && topDirs.length > 2) {
        issues.push({
          type: 'structure-mismatch',
          alias: project.alias,
          message: `${project.alias}.md 目录结构与实际不符（匹配 ${Math.round(dirMentionRate * 100)}%）`
        });
      }
    } catch (err) {
      console.warn(`  ⚠ 扫描 ${project.alias} 失败: ${err.message}`);
    }
  }

  return issues;
}

function extractRoutesFromCode(projectDir, projectType) {
  const routes = [];
  const { globSync } = require('glob');

  try {
    // Use adapter scanPatterns to find relevant files
    const patterns = defaultRegistry.getScanPatterns(projectType);
    if (patterns.length === 0) return routes;

    const files = [];
    for (const pattern of patterns) {
      const matches = globSync(pattern, { cwd: projectDir, absolute: true, nodir: true });
      files.push(...matches);
    }
    const uniqueFiles = [...new Set(files)];

    for (const file of uniqueFiles) {
      const content = readFileUTF8(file);
      const basename = path.basename(file);

      // Java: @RequestMapping, @GetMapping, etc.
      if (basename.endsWith('.java')) {
        const classMapping = content.match(/@RequestMapping\(["']([^"']+)["']\)/)?.[1] || '';
        const methodMappings = content.matchAll(/@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*(?:\(\s*)?(?:["']([^"']+)["'])?/g);
        for (const match of methodMappings) {
          const method = match[1].replace('Mapping', '').toUpperCase();
          const subPath = match[2] || '';
          const fullPath = (classMapping + '/' + subPath).replace(/\/+/g, '/');
          routes.push({ method: method === 'REQUEST' ? 'GET' : method, path: fullPath, file: basename });
        }
      }

      // Node.js: router.get/post etc.
      if (basename.endsWith('.js') || basename.endsWith('.ts')) {
        const matches = content.matchAll(/router\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g);
        for (const match of matches) {
          routes.push({ method: match[1].toUpperCase(), path: match[2], file: basename });
        }
      }

      // Python: path() in urls.py
      if (basename === 'urls.py') {
        const matches = content.matchAll(/path\s*\(\s*["']([^"']+)["']/g);
        for (const match of matches) {
          routes.push({ method: 'ANY', path: '/' + match[1], file: basename });
        }
      }
    }
  } catch (err) {
    // 解析失败
  }

  return routes;
}

async function doctorCommand(rootDir, options = {}) {
  const aiDocsDir = path.join(rootDir, 'ai-docs');
  const issues = [];
  const warnings = [];
  const info = { projects: [], routes: [] };

  console.log('🔍 正在分析项目...\n');

  // 1. 检查 ai-docs 目录
  if (!fs.existsSync(aiDocsDir)) {
    console.log('❌ ai-docs/ 目录不存在');
    console.log('\n修复：运行 code-ctx init 初始化项目');
    return { issues: [{ type: 'no-ai-docs', message: 'ai-docs/ 目录不存在' }], warnings, info };
  }

  // 2. 检测项目结构
  console.log('📁 检测项目结构...');
  const projects = detectProjects(rootDir);
  info.projects = projects.map(p => ({ alias: p.alias, type: p.type, name: p.name }));

  if (projects.length === 0) {
    console.log('  ⚠️ 未检测到子项目');
  } else {
    console.log(`  ✓ 检测到 ${projects.length} 个子项目: ${projects.map(p => p.alias).join(', ')}`);
  }

  // 3. 检查配置与实际的一致性
  console.log('\n📋 检查配置一致性...');
  const configIssues = checkDocsVsCode(rootDir);
  for (const issue of configIssues) {
    if (issue.type === 'unconfigured') {
      warnings.push({ type: issue.type, message: issue.message });
      console.log(`  ⚠️ ${issue.message}`);
    } else {
      issues.push(issue);
      console.log(`  ❌ ${issue.message}`);
    }
  }

  // 4. 检查文档完整性
  console.log('\n📄 检查文档完整性...');
  const docIssues = checkSectionIntegrity(aiDocsDir);
  for (const issue of docIssues) {
    if (issue.type === 'sparse') {
      warnings.push(issue);
      console.log(`  ⚠️ ${issue.message}`);
    } else {
      issues.push(issue);
      console.log(`  ❌ ${issue.message}`);
    }
  }

  // 5. 检查文档与代码的一致性
  console.log('\n🔄 检查文档与代码一致性...');
  const consistencyIssues = checkDocsVsActual(rootDir);
  for (const issue of consistencyIssues) {
    if (issue.type === 'outdated' || issue.type === 'structure-mismatch') {
      warnings.push(issue);
      console.log(`  ⚠️ ${issue.message}`);
    } else {
      issues.push(issue);
      console.log(`  ❌ ${issue.message}`);
    }
  }

  // 6. 严格模式：解析代码路由
  if (options.strict) {
    console.log('\n🔎 严格模式：解析代码路由...');
    for (const project of projects) {
      const routes = extractRoutesFromCode(project.path, project.type);
      if (routes.length > 0) {
        info.routes.push(...routes);
        console.log(`  📊 ${project.alias}: 发现 ${routes.length} 个路由`);

        // 检查 api-contracts.md 是否记录了这些路由
        const contractsPath = path.join(aiDocsDir, 'api-contracts.md');
        if (fs.existsSync(contractsPath)) {
          const contractsContent = readFileUTF8(contractsPath);
          const unrecorded = routes.filter(r => !contractsContent.includes(r.path));
          if (unrecorded.length > 0) {
            warnings.push({
              type: 'unrecorded-routes',
              message: `${project.alias} 有 ${unrecorded.length} 个路由未在 api-contracts.md 中记录`,
              details: unrecorded.slice(0, 5).map(r => `${r.method} ${r.path}`)
            });
            console.log(`  ⚠️ ${unrecorded.length} 个路由未记录`);
          }
        }
      }
    }
  }

  // 7. 敏感信息检查
  console.log('\n🔒 检查敏感信息...');
  const sensitiveWarnings = scanDirectory(aiDocsDir);
  for (const w of sensitiveWarnings) {
    warnings.push({ ...w, message: `${w.file} 可能包含敏感信息 (${w.field})` });
    console.log(`  ⚠️ ${w.file} 可能包含敏感信息 (${w.field})`);
  }

  // 8. 输出统计
  console.log('\n' + '─'.repeat(50));
  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ 文档健康检查通过');
  } else {
    if (issues.length > 0) {
      console.log(`\n❌ ${issues.length} 个问题需要修复：`);
      issues.forEach(i => console.log(`  - ${i.message}`));
    }
    if (warnings.length > 0) {
      console.log(`\n⚠️ ${warnings.length} 个警告：`);
      warnings.forEach(w => console.log(`  - ${w.message}`));
    }

    // 提供修复建议
    console.log('\n💡 修复建议：');
    const hasMissingDocs = issues.some(i => i.type === 'missing' || i.type === 'doc-missing');
    const hasOutdated = warnings.some(w => w.type === 'outdated' || w.type === 'structure-mismatch');

    if (hasMissingDocs || hasOutdated) {
      console.log('  运行 code-ctx doctor --fix 自动修复文档问题');
    }
    if (issues.some(i => i.type === 'unconfigured')) {
      console.log('  运行 code-ctx init 重新扫描项目结构');
    }
  }

  if (info.routes.length > 0) {
    console.log(`\n📊 共发现 ${info.routes.length} 个 API 路由`);
  }

  return { issues, warnings, info };
}

async function doctorFix(rootDir, options = {}) {
  const aiDocsDir = path.join(rootDir, 'ai-docs');
  const configPath = path.join(rootDir, 'code-ctx.config.js');

  if (!fs.existsSync(configPath)) {
    console.log('❌ code-ctx.config.js 不存在，请先运行 code-ctx init');
    return;
  }

  let config;
  try {
    config = loadConfigWithVM(configPath);
  } catch {
    console.log('❌ code-ctx.config.js 解析失败');
    return;
  }

  const aiConfig = getAIConfig(rootDir);
  if (!aiConfig.apiKey) {
    console.log('❌ 未配置 API Key，请先在 .env 文件中配置');
    console.log('   然后运行 code-ctx doctor --fix');
    return;
  }

  if (!fs.existsSync(aiDocsDir)) {
    fs.mkdirSync(aiDocsDir, { recursive: true });
  }

  console.log('🔧 开始修复文档...\n');

  const projects = config.projects || [];
  let fixedCount = 0;

  for (const project of projects) {
    const docPath = path.join(aiDocsDir, `${project.alias}.md`);
    const projectDir = path.join(rootDir, project.path);

    // 检查是否需要修复
    let needFix = false;
    let reason = '';

    if (!fs.existsSync(docPath)) {
      needFix = true;
      reason = '文档不存在';
    } else if (options.force) {
      needFix = true;
      reason = '强制重新生成';
    } else {
      // 检查文档是否过期
      try {
        if (fs.existsSync(projectDir)) {
          const scanResult = scanProject(projectDir, project.type);
          const docContent = readFileUTF8(docPath);
          const keyFileNames = scanResult.keyFiles
            .map(f => path.basename(f))
            .filter(name => !['package.json', 'pom.xml', 'build.gradle'].includes(name));

          const mentionedCount = keyFileNames.filter(name => docContent.includes(name)).length;
          const mentionRate = keyFileNames.length > 0 ? mentionedCount / keyFileNames.length : 1;

          if (mentionRate < 0.3 && keyFileNames.length > 3) {
            needFix = true;
            reason = `文档过期（仅匹配 ${Math.round(mentionRate * 100)}%）`;
          }
        }
      } catch (err) {
        // 扫描失败，跳过
      }
    }

    if (!needFix) {
      console.log(`  ✓ ${project.alias}.md - 正常`);
      continue;
    }

    console.log(`  🔧 修复 ${project.alias}.md - ${reason}...`);

    try {
      if (!fs.existsSync(projectDir)) {
        console.log(`    ❌ 项目目录不存在: ${project.path}`);
        continue;
      }

      const scanResult = scanProject(projectDir, project.type);
      const prompt = buildInitPrompt({ project, scanResult });
      const doc = await generateWithAI(prompt, aiConfig);
      const safeDoc = filterSensitive(doc).content;
      fs.writeFileSync(docPath, safeDoc);
      console.log(`    ✓ 已重新生成 ${project.alias}.md`);
      fixedCount++;
    } catch (err) {
      console.log(`    ❌ 生成失败: ${err.message}`);
    }
  }

  // 检查并修复 OVERVIEW.md
  const overviewPath = path.join(aiDocsDir, 'OVERVIEW.md');
  if (!fs.existsSync(overviewPath) || options.force) {
    console.log('\n  🔧 生成 OVERVIEW.md...');
    try {
      const generatedDocs = {};
      for (const project of projects) {
        const docPath = path.join(aiDocsDir, `${project.alias}.md`);
        if (fs.existsSync(docPath)) {
          generatedDocs[project.alias] = readFileUTF8(docPath);
        }
      }

      const overviewPrompt = buildInitPrompt({ type: 'overview', config, generatedDocs });
      const overview = await generateWithAI(overviewPrompt, aiConfig);
      fs.writeFileSync(overviewPath, filterSensitive(overview).content);
      console.log('    ✓ 已生成 OVERVIEW.md');
      fixedCount++;
    } catch (err) {
      console.log(`    ❌ 生成失败: ${err.message}`);
    }
  }

  console.log(`\n✅ 修复完成，共修复 ${fixedCount} 个文档`);
}

async function runDoctor(options = {}) {
  const { rootDir = process.cwd(), silent = false, ...doctorOptions } = options;
  if (!silent) {
    return doctorCommand(rootDir, doctorOptions);
  }

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return await doctorCommand(rootDir, doctorOptions);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

module.exports = { doctorCommand, doctorFix, runDoctor };
