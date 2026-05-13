const fs = require('fs');
const path = require('path');
const { detectProjects } = require('../scanner/project-detector');
const { scanProject, estimateTokens } = require('../scanner/file-scanner');
const { getAIConfig } = require('../utils/config');
const { generateWithAI } = require('../ai/client');
const { filterSensitive, scanDirectory } = require('../utils/sensitive-filter');
const { buildInitPrompt } = require('../generator/prompt-builder');
const { TOKEN_THRESHOLDS, STATE_FILES } = require('../utils/constants');
const { hasGitRepo, getCurrentCommitHash } = require('../utils/git-utils');

function loadInitState(outputDir) {
  const statePath = path.join(outputDir, STATE_FILES.INIT_STATE);
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
  const statePath = path.join(outputDir, STATE_FILES.INIT_STATE);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

async function initCommand(rootDir, options = {}) {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`目录不存在: ${rootDir}`);
  }

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
  const defaultExcludeDirs = ['node_modules', '.git', 'dist', 'build', 'ai-docs'];
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
    excludeDirs: defaultExcludeDirs,
    gitTrack: true
  };

  const configPath = path.join(rootDir, 'code-ctx.config.js');
  if (!fs.existsSync(configPath) || options.force) {
    fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(config, null, 2)};\n`);
  }

  const warnings = [];
  const generatedDocs = {};

  // 生成文档（除非跳过 AI）
  if (options.generateDocs !== false && !options.skipAi) {
    console.log('\n📝 生成项目文档...');

    // 估算 token 数量
    let totalTokens = 0;
    for (const project of projects) {
      const result = scanResults[project.alias];
      if (result && result.keyFiles) {
        const tokens = estimateTokens(result.keyFiles);
        totalTokens += tokens;
        console.log(`  ${project.alias}: ~${tokens} tokens`);
      }
    }
    console.log(`  总计: ~${totalTokens} tokens`);

    // 选择策略
    let strategy;
    if (totalTokens < TOKEN_THRESHOLDS.ONE_SHOT) {
      strategy = 'ONE_SHOT';
    } else if (totalTokens <= TOKEN_THRESHOLDS.BATCH) {
      strategy = 'BATCH_WITH_CONTEXT';
    } else {
      strategy = 'BATCH_MINIMAL';
    }
    console.log(`  策略: ${strategy}`);

    try {
      const aiConfig = getAIConfig(rootDir);

      if (!aiConfig.apiKey) {
        console.log('\n⚠️ 未配置 API Key，请先在 .env 文件中配置');
      } else {
        const failedDocs = [];

        if (strategy === 'ONE_SHOT') {
          // ONE_SHOT: 所有子项目拼一个 prompt
          console.log('\n🚀 ONE_SHOT 模式：所有子项目合并生成...');
          const allPrompt = buildInitPrompt({
            projects,
            scanResults,
            type: 'one-shot'
          });
          const allDocs = await generateWithAI(allPrompt, aiConfig);
          const safeDocs = filterSensitive(allDocs).content;

          // 拆分各子项目文档
          for (const project of projects) {
            if (state.projects[project.alias]?.status === 'completed' && !options.force) continue;
            const strictRegex = new RegExp(`(?:^|\\n)## ${project.alias}[\\s\\S]*?(?=\\n## |$)`, 'i');
            const fuzzyRegex = new RegExp(`(?:^|\\n)##[^\\n]*${project.alias}[\\s\\S]*?(?=\\n## |$)`, 'i');
            const match = safeDocs.match(strictRegex) || safeDocs.match(fuzzyRegex);
            if (!match) {
              console.warn(`  ⚠️ ${project.alias}: 文档拆分失败，标记为待重新生成`);
            }
            const doc = match ? match[0].trim() : `# ${project.alias}\n\n文档生成中，请稍后重试。`;
            fs.writeFileSync(path.join(outputDir, `${project.alias}.md`), doc);
            generatedDocs[project.alias] = doc;
            state.projects[project.alias] = { status: match ? 'completed' : 'needs-regen' };
          }
          saveInitState(outputDir, state);
        } else {
          // BATCH: 逐个生成
          if (strategy === 'BATCH_MINIMAL') {
            // BATCH_MINIMAL: 可并行生成（不需要其他子项目文档作为上下文）
            const pendingProjects = projects.filter(p =>
              !(state.projects[p.alias]?.status === 'completed' && !options.force)
            );

            console.log(`\n并行生成 ${pendingProjects.length} 个子项目文档...`);
            const results = await Promise.allSettled(
              pendingProjects.map(async (project) => {
                const projectPrompt = buildInitPrompt({
                  project,
                  scanResult: scanResults[project.alias]
                });
                const doc = await generateWithAI(projectPrompt, aiConfig);
                const safeDoc = filterSensitive(doc).content;
                fs.writeFileSync(path.join(outputDir, `${project.alias}.md`), safeDoc);
                return { alias: project.alias, doc: safeDoc };
              })
            );

            for (const result of results) {
              if (result.status === 'fulfilled') {
                generatedDocs[result.value.alias] = result.value.doc;
                state.projects[result.value.alias] = { status: 'completed' };
              } else {
                console.error(`  ⚠️ 生成失败:`, result.reason?.message);
                failedDocs.push({ error: result.reason?.message });
              }
            }
            saveInitState(outputDir, state);
          } else {
            // BATCH_WITH_CONTEXT: 串行生成（需要其他子项目文档作为上下文）
            for (const project of projects) {
              if (state.projects[project.alias]?.status === 'completed' && !options.force) continue;

              console.log(`\n生成 ${project.alias}.md...`);
              try {
                const otherDocs = Object.fromEntries(
                  Object.entries(generatedDocs).filter(([k]) => k !== project.alias)
                );
                const projectPrompt = buildInitPrompt({
                  project,
                  scanResult: scanResults[project.alias],
                  otherDocs
                });

                const doc = await generateWithAI(projectPrompt, aiConfig);
                const safeDoc = filterSensitive(doc).content;
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
          }
        }

        // OVERVIEW 始终最后生成
        const successCount = Object.keys(generatedDocs).length;
        if (successCount > 0) {
          console.log('\n生成 OVERVIEW.md...');
          const overviewPrompt = buildInitPrompt({
            type: 'overview',
            config,
            generatedDocs
          });
          const overview = await generateWithAI(overviewPrompt, aiConfig);
          fs.writeFileSync(path.join(outputDir, 'OVERVIEW.md'), filterSensitive(overview).content);
          console.log(`\n✓ 成功生成 ${successCount} 个子项目文档 + OVERVIEW.md`);
        }
      }
    } catch (err) {
      console.error('\n❌ 文档生成失败:', err.message);
    }
  }

  // 敏感信息检查
  const sensitiveWarnings = scanDirectory(outputDir);
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

  // 写入 .last-scan.json 供 update 命令使用
  const lastScanPath = path.join(outputDir, STATE_FILES.LAST_SCAN);
  const commitHash = hasGitRepo(rootDir) ? getCurrentCommitHash(rootDir) : null;
  fs.writeFileSync(lastScanPath, JSON.stringify({
    timestamp: Date.now(),
    lastCommitHash: commitHash,
    projects: projects.map(p => p.alias)
  }, null, 2));

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
