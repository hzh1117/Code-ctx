const fs = require('fs');
const path = require('path');
const { detectProjects } = require('../scanner/project-detector');
const { scanProject } = require('../scanner/file-scanner');
const { getAIConfig } = require('../utils/config');
const { generateWithAI } = require('../ai/client');
const { filterSensitive, DETECTION_PATTERNS } = require('../utils/sensitive-filter');
const { buildInitPrompt } = require('../generator/prompt-builder');

function loadInitState(outputDir) {
  const statePath = path.join(outputDir, '.init-state.json');
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {
      return { lastRun: null, projects: {} };
    }
  }
  return { lastRun: null, projects: {} };
}

function saveInitState(outputDir, state) {
  const statePath = path.join(outputDir, '.init-state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function detectSensitiveInDir(dir) {
  const warnings = [];
  if (!fs.existsSync(dir)) return warnings;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const { regex, name } of DETECTION_PATTERNS) {
      if (regex.test(content)) {
        warnings.push({ file, field: name });
      }
    }
  }
  return warnings;
}

async function initCommand(rootDir, options = {}) {
  console.log('🔍 扫描项目结构...');

  const projects = detectProjects(rootDir);
  console.log(`检测到 ${projects.length} 个子项目`);

  // 用户确认（除非跳过）
  if (!options.skipPrompt && projects.length > 0) {
    console.log('\n检测到以下子项目：');
    projects.forEach(p => {
      console.log(`  [${p.alias}] ${p.name} → ${p.type}`);
    });
    console.log('\n确认后继续，或手动调整 code-ctx.config.js 中的 projects 配置');
  }

  const outputDir = path.join(rootDir, 'ai-docs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 加载已有状态（容错）
  const state = loadInitState(outputDir);
  const scanResults = {};

  for (const project of projects) {
    // 跳过已完成的项目
    if (state.projects[project.alias]?.status === 'completed' && !options.force) {
      console.log(`⏭ 跳过 ${project.alias}（已完成）`);
      continue;
    }

    console.log(`扫描 ${project.name} (${project.type})...`);
    scanResults[project.alias] = scanProject(project.path, project.type);
    state.projects[project.alias] = { status: 'scanned' };
  }

  saveInitState(outputDir, state);

  // 生成配置文件
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
  if (!fs.existsSync(configPath) || options.force) {
    fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(config, null, 2)};\n`);
  }

  const warnings = [];
  const generatedDocs = {};

  // 生成文档（除非跳过 AI）
  if (options.generateDocs !== false && !options.skipAI) {
    console.log('\n📝 生成项目文档...');

    try {
      const aiConfig = getAIConfig(rootDir);

      if (!aiConfig.apiKey) {
        console.log('\n⚠️ 未配置 API Key，请先在 .env 文件中配置');
      } else {
        const failedDocs = [];
        for (const project of projects) {
          if (state.projects[project.alias]?.status === 'completed' && !options.force) continue;

          console.log(`\n生成 ${project.alias}.md...`);
          try {
            const projectPrompt = buildInitPrompt({
              project,
              scanResult: scanResults[project.alias]
            });
            const doc = await generateWithAI(projectPrompt, aiConfig);
            const safeDoc = filterSensitive(doc);
            fs.writeFileSync(path.join(outputDir, `${project.alias}.md`), safeDoc);
            generatedDocs[project.alias] = safeDoc;
            state.projects[project.alias] = { status: 'completed' };
            saveInitState(outputDir, state);
          } catch (err) {
            console.error(`  ⚠️ ${project.alias}.md 生成失败:`, err.message);
            failedDocs.push({ alias: project.alias, error: err.message });
            state.projects[project.alias] = { status: 'failed', error: err.message };
            saveInitState(outputDir, state);
          }
        }

        const successCount = Object.keys(generatedDocs).length;
        if (successCount > 0) {
          console.log('\n生成 OVERVIEW.md...');
          const overviewPrompt = buildInitPrompt({
            type: 'overview',
            config,
            generatedDocs
          });
          const overview = await generateWithAI(overviewPrompt, aiConfig);
          fs.writeFileSync(path.join(outputDir, 'OVERVIEW.md'), filterSensitive(overview));
          console.log(`\n✓ 成功生成 ${successCount} 个子项目文档 + OVERVIEW.md`);
        }
      }
    } catch (err) {
      console.error('\n❌ 文档生成失败:', err.message);
    }
  }

  // 敏感信息检查
  const sensitiveWarnings = detectSensitiveInDir(outputDir);
  if (sensitiveWarnings.length > 0) {
    console.log('\n⚠️ 检测到 ai-docs/ 中可能包含敏感信息：');
    sensitiveWarnings.forEach(w => {
      console.log(`  - ${w.file}: ${w.field}`);
    });
    console.log('建议运行 code-ctx doctor 查看详细报告');
    warnings.push(...sensitiveWarnings);
  }

  // 保存最终状态
  state.lastRun = new Date().toISOString();
  saveInitState(outputDir, state);

  // 引导提示
  console.log('\n✓ 初始化完成！');
  console.log('ai-docs/ 已创建');
  console.log('\n下一步：');
  console.log('  开始开发前：  code-ctx use "你的任务描述"');
  console.log('  代码有大改动：code-ctx update');
  console.log('  检查文档健康：code-ctx doctor');
  console.log('  重新生成文档：code-ctx fix <子项目别名>');

  return { projects, config, warnings };
}

module.exports = { initCommand };
