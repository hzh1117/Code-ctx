const fs = require('fs');
const path = require('path');
const { detectProjects } = require('../scanner/project-detector');
const { scanProject, estimateTokens } = require('../scanner/file-scanner');
const { getAIConfig, getProjectLimits } = require('../utils/config');
const { generateWithContinuation } = require('../ai/client');
const { filterSensitive, scanDirectory } = require('../utils/sensitive-filter');
const { buildInitPrompt, buildApiPrompt, buildDatabasePrompt } = require('../generator/prompt-builder');
const { TOKEN_THRESHOLDS, STATE_FILES } = require('../utils/constants');
const { hasGitRepo, getCurrentCommitHash } = require('../utils/git-utils');
const { listSections } = require('../core/section');

let verboseMode = false;

function log(...args) {
  console.log(...args);
}

function logVerbose(...args) {
  if (verboseMode) {
    console.log('[详细]', ...args);
  }
}

function logStep(step, ...args) {
  console.log(`\n[${step}]`, ...args);
}

function getExpectedSectionsFromTemplate(templateName) {
  const templatePath = path.join(__dirname, '../../templates', templateName);
  if (!fs.existsSync(templatePath)) return [];
  const content = fs.readFileSync(templatePath, 'utf8');
  return listSections(content);
}

async function generateDocument(prompt, aiConfig, alias) {
  return generateWithContinuation(prompt, {
    ...aiConfig,
    onProgress: ({ attempt, maxAttempts }) => {
      console.log(`[续写 ${attempt}/${maxAttempts}] ${alias}...`);
    }
  });
}

async function completeMissingSections(doc, expectedSections, aiConfig, alias) {
  const existing = listSections(doc);
  const missing = expectedSections.filter(section => !existing.includes(section));
  if (missing.length === 0) return doc;

  const prompt = [
    `以上文档缺少以下章节，请补充完整：${missing.join(', ')}`,
    '',
    '要求：',
    '- 只输出缺失章节内容',
    '- 每个章节必须使用对应的 HTML section 标记包裹',
    '- 不要重复已经存在的章节',
    '',
    '原文档：',
    doc
  ].join('\n');
  const completion = await generateDocument(prompt, aiConfig, alias);
  const safeCompletion = filterSensitive(completion).content;
  return `${doc.trim()}\n\n${safeCompletion.trim()}\n`;
}

async function generateTypeSpecificDoc(project, scanResult, docType, aiConfig, outputDir) {
  const templateName = docType === 'api' ? 'java-api-prompt.md' : 'java-database-prompt.md';
  const expectedSections = getExpectedSectionsFromTemplate(templateName);
  
  let prompt;
  if (docType === 'api') {
    prompt = buildApiPrompt({ project, scanResult });
  } else {
    prompt = buildDatabasePrompt({ project, scanResult });
  }
  
  const doc = await generateDocument(prompt, aiConfig, `${project.alias}-${docType}`);
  const safeDoc = await completeMissingSections(
    filterSensitive(doc).content,
    expectedSections,
    aiConfig,
    `${project.alias}-${docType}`
  );
  
  const outputFileName = `${project.alias}-${docType}.md`;
  fs.writeFileSync(path.join(outputDir, outputFileName), safeDoc);
  return { alias: project.alias, docType, doc: safeDoc, fileName: outputFileName };
}

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
  verboseMode = options.verbose || false;
  
  logStep('1/7', '检查项目目录');
  logVerbose('根目录:', rootDir);
  
  if (!fs.existsSync(rootDir)) {
    throw new Error(`目录不存在: ${rootDir}`);
  }
  logVerbose('目录存在 ✓');

  logStep('2/7', '检测子项目');
  const startTime = Date.now();
  let projects = detectProjects(rootDir);
  const detectTime = Date.now() - startTime;
  log(`检测到 ${projects.length} 个子项目 (耗时 ${detectTime}ms)`);
  
  if (verboseMode) {
    projects.forEach(p => {
      logVerbose(`  - ${p.alias}: ${p.name} (${p.type}) → ${p.path}`);
    });
  }

  // 支持 --project 参数处理单个子项目
  if (options.project) {
    const targetAlias = options.project;
    const targetProject = projects.find(p => p.alias === targetAlias);
    if (!targetProject) {
      throw new Error(`未找到子项目: ${targetAlias}，可用的子项目: ${projects.map(p => p.alias).join(', ')}`);
    }
    projects = [targetProject];
    log(`仅处理子项目: ${targetAlias}`);
  }

  // 用户确认（除非跳过）
  if (!options.skipPrompt && projects.length > 0) {
    log('\n检测到以下子项目：');
    projects.forEach(p => {
      console.log(`  [${p.alias}] ${p.name} → ${p.type}`);
    });
  }

  logStep('3/7', '创建输出目录');
  const outputDir = path.join(rootDir, 'ai-docs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    logVerbose('创建目录:', outputDir);
  } else {
    logVerbose('目录已存在:', outputDir);
  }

  // 获取项目限制配置
  const projectLimits = options.unlimited 
    ? { maxFiles: Infinity, maxTokens: Infinity }
    : getProjectLimits(rootDir);
  logVerbose('项目限制:', projectLimits);

  // 加载已有状态（容错）
  const state = loadInitState(outputDir);
  const scanResults = {};

  logStep('4/7', '扫描项目文件');
  for (const project of projects) {
    // 跳过已完成的项目
    if (state.projects[project.alias]?.status === 'completed' && !options.force) {
      log(`跳过 ${project.alias}（已完成）`);
      continue;
    }

    logVerbose(`\n开始扫描: ${project.alias}`);
    const scanStartTime = Date.now();
    const scanResult = scanProject(project.path, project.type, projectLimits);
    const scanTime = Date.now() - scanStartTime;
    scanResults[project.alias] = scanResult;
    
    log(`扫描 ${project.name} 完成 (耗时 ${scanTime}ms)`);
    logVerbose(`  - 文件数: ${scanResult.scannedFiles}/${scanResult.totalFiles}`);
    logVerbose(`  - 预估 tokens: ${scanResult.estimatedTokens}`);
    
    // 显示扫描统计
    if (scanResult.totalFiles > scanResult.limitedTo) {
      log(`  文件数量限制: ${scanResult.totalFiles} → ${scanResult.limitedTo}`);
    }
    console.log(`  预估 tokens: ~${scanResult.estimatedTokens}`);
    
    state.projects[project.alias] = { status: 'scanned' };
  }

  saveInitState(outputDir, state);
  logVerbose('状态已保存');

  // 生成配置文件
  logStep('5/7', '生成配置文件');
  const defaultExcludeDirs = ['node_modules', '.git', 'dist', 'build', 'ai-docs'];
  const config = {
    projectName: path.basename(rootDir),
    outputDir: './ai-docs',
    aiMode: 'clipboard',
    projects: projects.map(p => ({
      alias: p.alias,
      path: p.path,
      type: p.type,
      label: p.name
    })),
    excludeDirs: defaultExcludeDirs,
    gitTrack: true
  };

  const configPath = path.join(rootDir, 'code-ctx.config.js');
  if (!fs.existsSync(configPath) || options.force) {
    fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(config, null, 2)};\n`);
    logVerbose('配置文件已写入:', configPath);
  } else {
    logVerbose('配置文件已存在，跳过');
  }

  const warnings = [];
  const generatedDocs = {};

  // 生成文档（除非跳过 AI）
  if (options.generateDocs !== false && !options.skipAi) {
    logStep('6/7', '生成项目文档');

    // 使用扫描结果中的 token 估算
    let totalTokens = 0;
    for (const project of projects) {
      const result = scanResults[project.alias];
      if (result) {
        const tokens = result.estimatedTokens || estimateTokens(result.keyFiles);
        totalTokens += tokens;
        logVerbose(`  ${project.alias}: ~${tokens} tokens`);
      }
    }
    console.log(`总计: ~${totalTokens} tokens`);

    // 选择策略
    let strategy;
    if (totalTokens < TOKEN_THRESHOLDS.ONE_SHOT) {
      strategy = 'ONE_SHOT';
    } else if (totalTokens <= TOKEN_THRESHOLDS.BATCH) {
      strategy = 'BATCH_WITH_CONTEXT';
    } else {
      strategy = 'BATCH_MINIMAL';
    }
    console.log(`策略: ${strategy}`);

    try {
      logVerbose('加载 AI 配置...');
      const aiConfig = getAIConfig(rootDir);
      logVerbose('协议:', aiConfig.protocol);
      logVerbose('Base URL:', aiConfig.baseUrl);
      logVerbose('模型:', aiConfig.model);
      logVerbose('超时时间:', aiConfig.timeout, 'ms');

      if (!aiConfig.apiKey) {
        console.log('\n未配置 API Key，请先在 .env 文件中配置');
      } else {
        const failedDocs = [];
        
        // 处理特定类型的文档生成
        if (options.docType && ['api', 'database'].includes(options.docType)) {
          log(`生成 ${options.docType.toUpperCase()} 文档...`);
          
          const pendingProjects = projects.filter(p => {
            const projectType = p.type;
            // API 文档只适用于后端项目，数据库文档适用于有数据库的项目
            if (options.docType === 'api') {
              return projectType.includes('backend') || projectType.includes('java');
            }
            return projectType.includes('backend') || projectType.includes('java');
          });
          
          if (pendingProjects.length === 0) {
            log(`没有适合生成 ${options.docType} 文档的项目`);
          } else {
            log(`串行生成 ${pendingProjects.length} 个子项目 ${options.docType.toUpperCase()} 文档...`);
            for (const project of pendingProjects) {
              try {
                logVerbose(`\n生成 ${project.alias}-${options.docType}.md...`);
                const genStartTime = Date.now();
                const result = await generateTypeSpecificDoc(
                  project,
                  scanResults[project.alias],
                  options.docType,
                  aiConfig,
                  outputDir
                );
                const genTime = Date.now() - genStartTime;
                log(`  ${result.fileName} 生成完成 (耗时 ${genTime}ms)`);
                state.projects[result.alias] = { 
                  ...state.projects[result.alias], 
                  [`${result.docType}Doc`]: 'completed' 
                };
                saveInitState(outputDir, state);
              } catch (err) {
                console.error(`  ${project.alias}-${options.docType}.md 生成失败:`, err.message);
                if (verboseMode) {
                  console.error('  错误详情:', err.stack);
                }
                failedDocs.push({ error: err.message });
              }
            }
          }
        } else {
          // 原有的完整文档生成逻辑
          const projectExpectedSections = getExpectedSectionsFromTemplate('scan-prompt.md');
          const overviewExpectedSections = getExpectedSectionsFromTemplate('scan-prompt-overview.md');
          logVerbose('预期章节:', projectExpectedSections.length, '个');

          if (strategy === 'ONE_SHOT') {
            // ONE_SHOT: 所有子项目拼一个 prompt
            log('\nONE_SHOT 模式：所有子项目合并生成...');
            logVerbose('构建 prompt...');
            const allPrompt = buildInitPrompt({
              projects,
              scanResults,
              type: 'one-shot'
            });
            logVerbose('Prompt 长度:', allPrompt.length, '字符');
            logVerbose('开始调用 AI...');
            const aiStartTime = Date.now();
            const allDocs = await generateDocument(allPrompt, aiConfig, 'one-shot');
            const aiTime = Date.now() - aiStartTime;
            logVerbose('AI 调用完成 (耗时', aiTime, 'ms)');
            const safeDocs = filterSensitive(allDocs).content;

            // 拆分各子项目文档
            for (const project of projects) {
              if (state.projects[project.alias]?.status === 'completed' && !options.force) continue;
              const strictRegex = new RegExp(`(?:^|\\n)## ${project.alias}[\\s\\S]*?(?=\\n## |$)`, 'i');
              const fuzzyRegex = new RegExp(`(?:^|\\n)##[^\\n]*${project.alias}[\\s\\S]*?(?=\\n## |$)`, 'i');
              const match = safeDocs.match(strictRegex) || safeDocs.match(fuzzyRegex);
              if (!match) {
                console.warn(`  ${project.alias}: 文档拆分失败，标记为待重新生成`);
              }
              let doc = match ? match[0].trim() : `# ${project.alias}\n\n文档生成中，请稍后重试。`;
              if (match) {
                doc = await completeMissingSections(doc, projectExpectedSections, aiConfig, project.alias);
              }
              fs.writeFileSync(path.join(outputDir, `${project.alias}.md`), doc);
              generatedDocs[project.alias] = doc;
              state.projects[project.alias] = { status: match ? 'completed' : 'needs-regen' };
            }
            saveInitState(outputDir, state);
          } else {
            // BATCH: 逐个生成
            if (strategy === 'BATCH_MINIMAL') {
              // BATCH_MINIMAL: 串行生成（不需要其他子项目文档作为上下文）
              const pendingProjects = projects.filter(p =>
                !(state.projects[p.alias]?.status === 'completed' && !options.force)
              );

              log(`\n串行生成 ${pendingProjects.length} 个子项目文档...`);
              for (const project of pendingProjects) {
                try {
                  logVerbose(`\n生成 ${project.alias}.md...`);
                  const projectPrompt = buildInitPrompt({
                    project,
                    scanResult: scanResults[project.alias]
                  });
                  logVerbose('Prompt 长度:', projectPrompt.length, '字符');
                  logVerbose('开始调用 AI...');
                  const aiStartTime = Date.now();
                  const doc = await generateDocument(projectPrompt, aiConfig, project.alias);
                  const aiTime = Date.now() - aiStartTime;
                  logVerbose('AI 调用完成 (耗时', aiTime, 'ms)');
                  const safeDoc = await completeMissingSections(
                    filterSensitive(doc).content,
                    projectExpectedSections,
                    aiConfig,
                    project.alias
                  );
                  fs.writeFileSync(path.join(outputDir, `${project.alias}.md`), safeDoc);
                  generatedDocs[project.alias] = safeDoc;
                  state.projects[project.alias] = { status: 'completed' };
                  log(`  ${project.alias}.md 生成完成`);
                  saveInitState(outputDir, state);
                } catch (err) {
                  console.error(`  ${project.alias}.md 生成失败:`, err.message);
                  if (verboseMode) {
                    console.error('  错误详情:', err.stack);
                  }
                  failedDocs.push({ alias: project.alias, error: err.message });
                  state.projects[project.alias] = { status: 'failed', error: err.message };
                  saveInitState(outputDir, state);
                }
              }
            } else {
              // BATCH_WITH_CONTEXT: 串行生成（需要其他子项目文档作为上下文）
              for (const project of projects) {
                if (state.projects[project.alias]?.status === 'completed' && !options.force) continue;

                logVerbose(`\n生成 ${project.alias}.md...`);
                try {
                  const otherDocs = Object.fromEntries(
                    Object.entries(generatedDocs).filter(([k]) => k !== project.alias)
                  );
                  const projectPrompt = buildInitPrompt({
                    project,
                    scanResult: scanResults[project.alias],
                    otherDocs
                  });
                  logVerbose('Prompt 长度:', projectPrompt.length, '字符');
                  logVerbose('开始调用 AI...');
                  const aiStartTime = Date.now();
                  const doc = await generateDocument(projectPrompt, aiConfig, project.alias);
                  const aiTime = Date.now() - aiStartTime;
                  logVerbose('AI 调用完成 (耗时', aiTime, 'ms)');
                  const safeDoc = await completeMissingSections(
                    filterSensitive(doc).content,
                    projectExpectedSections,
                    aiConfig,
                    project.alias
                  );
                  fs.writeFileSync(path.join(outputDir, `${project.alias}.md`), safeDoc);
                  generatedDocs[project.alias] = safeDoc;
                  state.projects[project.alias] = { status: 'completed' };
                  saveInitState(outputDir, state);
                } catch (err) {
                  console.error(`  ${project.alias}.md 生成失败:`, err.message);
                  if (verboseMode) {
                    console.error('  错误详情:', err.stack);
                  }
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
            log('\n生成 OVERVIEW.md...');
            const overviewPrompt = buildInitPrompt({
              type: 'overview',
              config,
              generatedDocs
            });
            logVerbose('Prompt 长度:', overviewPrompt.length, '字符');
            logVerbose('开始调用 AI...');
            const aiStartTime = Date.now();
            const overview = await generateDocument(overviewPrompt, aiConfig, 'OVERVIEW');
            const aiTime = Date.now() - aiStartTime;
            logVerbose('AI 调用完成 (耗时', aiTime, 'ms)');
            const safeOverview = await completeMissingSections(
              filterSensitive(overview).content,
              overviewExpectedSections,
              aiConfig,
              'OVERVIEW'
            );
            fs.writeFileSync(path.join(outputDir, 'OVERVIEW.md'), safeOverview);
            log(`成功生成 ${successCount} 个子项目文档 + OVERVIEW.md`);
          }
        }
      }
    } catch (err) {
      console.error('\n文档生成失败:', err.message);
      if (verboseMode) {
        console.error('错误详情:', err.stack);
      }
    }
  }

  // 敏感信息检查
  logStep('7/7', '敏感信息检查');
  logVerbose('扫描目录:', outputDir);
  const sensitiveWarnings = scanDirectory(outputDir);
  if (sensitiveWarnings.length > 0) {
    log('\n检测到 ai-docs/ 中可能包含敏感信息：');
    sensitiveWarnings.forEach(w => {
      console.log(`  - ${w.file}: ${w.field}`);
    });
    log('建议运行 code-ctx doctor 查看详细报告');
    warnings.push(...sensitiveWarnings);
  } else {
    logVerbose('未发现敏感信息');
  }

  // 保存最终状态
  logVerbose('保存最终状态...');
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
  logVerbose('状态文件已更新');

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
