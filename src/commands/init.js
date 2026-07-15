const fs = require('fs');
const path = require('path');
const { detectProjects } = require('../scanner/project-detector');
const { scanProject, estimateTokens } = require('../scanner/file-scanner');
const { getAIConfig, getProjectLimits, getConfigFile, saveProjectConfig } = require('../utils/config');
const { initPlugins } = require('../plugins/loader');
const { generateWithContinuation } = require('../ai/client');
const { filterSensitive, scanDirectory } = require('../utils/sensitive-filter');
const { buildInitPrompt, buildApiPrompt, buildDatabasePrompt } = require('../generator/prompt-builder');
const { TOKEN_THRESHOLDS, STATE_FILES } = require('../utils/constants');
const { hasGitRepo, getCurrentCommitHash } = require('../utils/git-utils');
const { listSections } = require('../core/section');

const CONCURRENCY = 2;

async function asyncPool(poolSize, items, fn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = fn(item).then(result => {
      executing.delete(p);
      return result;
    }, err => {
      executing.delete(p);
      throw err;
    });
    // Prevent unhandled rejection warnings — Promise.allSettled below
    // will capture the actual rejection status.
    p.catch(() => {});
    executing.add(p);
    results.push(p);
    if (executing.size >= poolSize) {
      // Wait for any item to settle (resolve OR reject) so we can start
      // the next one. Rejections are captured by allSettled, not here.
      await Promise.race(executing).catch(() => {});
    }
  }
  return Promise.allSettled(results);
}

let _verboseMode = false;

function log(...args) {
  console.log(...args);
}

function logVerbose(...args) {
  if (_verboseMode) {
    console.log('[详细]', ...args);
  }
}

function logStep(step, ...args) {
  console.log(`\n[${step}]`, ...args);
}

/** @param {boolean} verbose */
function setVerbose(verbose) {
  _verboseMode = !!verbose;
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

function validateRootDir(rootDir) {
  logStep('1/7', '检查项目目录');
  logVerbose('根目录:', rootDir);
  if (!fs.existsSync(rootDir)) {
    throw new Error(`目录不存在: ${rootDir}`);
  }
  logVerbose('目录存在 ✓');
}

function detectSubProjects(rootDir, options) {
  logStep('2/7', '检测子项目');
  const startTime = Date.now();
  let projects = detectProjects(rootDir);
  const detectTime = Date.now() - startTime;
  log(`检测到 ${projects.length} 个项目 (耗时 ${detectTime}ms)`);

  if (_verboseMode) {
    projects.forEach(p => {
      logVerbose(`  - ${p.alias}: ${p.name} (${p.type}) → ${p.path}`);
    });
  }

  if (options.project) {
    const targetAlias = options.project;
    const targetProject = projects.find(p => p.alias === targetAlias);
    if (!targetProject) {
      throw new Error(`未找到子项目: ${targetAlias}，可用的子项目: ${projects.map(p => p.alias).join(', ')}`);
    }
    projects = [targetProject];
    log(`仅处理子项目: ${targetAlias}`);
  }

  if (!options.skipPrompt && projects.length > 0) {
    log('\n检测到以下子项目：');
    projects.forEach(p => {
      console.log(`  [${p.alias}] ${p.name} → ${p.type}`);
    });
  }

  return projects;
}

function prepareOutputDir(rootDir) {
  logStep('3/7', '创建输出目录');
  const outputDir = path.join(rootDir, 'ai-docs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    logVerbose('创建目录:', outputDir);
  } else {
    logVerbose('目录已存在:', outputDir);
  }
  return outputDir;
}

function scanAllProjects(projects, projectLimits, state, options) {
  logStep('4/7', '扫描项目文件');
  const scanResults = {};
  for (const project of projects) {
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
    logVerbose(`  - 文件数: ${scanResult.limitedTo}/${scanResult.totalFiles}`);
    logVerbose(`  - 预估 tokens: ${scanResult.estimatedTokens}`);

    if (scanResult.totalFiles > scanResult.limitedTo) {
      log(`  文件数量限制: ${scanResult.totalFiles} → ${scanResult.limitedTo}`);
    }
    console.log(`  预估 tokens: ~${scanResult.estimatedTokens}`);

    state.projects[project.alias] = { status: 'scanned' };
  }
  return scanResults;
}

function generateProjectConfig(rootDir, projects, options) {
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

  const info = getConfigFile(rootDir);
  if (info.exists && !options.force) {
    logVerbose('配置文件已存在，跳过');
    if (info.format === 'js') {
      log('提示：检测到 code-ctx.config.js（旧格式）。新格式 code-ctx.config.json 更安全，可手动迁移：');
      log('  cp code-ctx.config.js code-ctx.config.json # 然后改为纯 JSON');
    }
    return config;
  }

  // Force or fresh init: respect explicit --config-format, else keep existing
  // format on --force, else default to JSON.
  const desiredFormat = options.configFormat === 'js' ? 'js'
    : options.configFormat === 'json' ? 'json'
    : info.exists ? info.format
    : 'json';

  const written = saveProjectConfig(rootDir, config, { format: desiredFormat });
  logVerbose('配置文件已写入:', written.path);
  return config;
}

function pickStrategy(projects, scanResults) {
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

  let strategy;
  if (totalTokens < TOKEN_THRESHOLDS.ONE_SHOT) {
    strategy = 'ONE_SHOT';
  } else if (totalTokens <= TOKEN_THRESHOLDS.BATCH) {
    strategy = 'BATCH_WITH_CONTEXT';
  } else {
    strategy = 'BATCH_MINIMAL';
  }
  console.log(`策略: ${strategy}`);
  return strategy;
}

async function generateTypeSpecificDocs(ctx) {
  const { projects, scanResults, aiConfig, outputDir, options, state, generatedDocs, failedDocs } = ctx;
  log(`生成 ${options.docType.toUpperCase()} 文档...`);

  const pendingProjects = projects.filter(p => {
    const projectType = p.type;
    if (options.docType === 'api') {
      return projectType.includes('backend') || projectType.includes('java');
    }
    return projectType.includes('backend') || projectType.includes('java');
  });

  if (pendingProjects.length === 0) {
    log(`没有适合生成 ${options.docType} 文档的项目`);
    return;
  }

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
      generatedDocs[`${result.alias}-${result.docType}`] = result.fileName;
      saveInitState(outputDir, state);
    } catch (err) {
      console.error(`  ${project.alias}-${options.docType}.md 生成失败:`, err.message);
      if (_verboseMode) {
        console.error('  错误详情:', err.stack);
      }
      failedDocs.push({ alias: project.alias, docType: options.docType, error: err.message });
    }
  }
}

async function generateOneShotDocs(ctx) {
  const {
    projects, scanResults, aiConfig, outputDir, options, state,
    generatedDocs, failedDocs, projectExpectedSections
  } = ctx;
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

  for (const project of projects) {
    if (state.projects[project.alias]?.status === 'completed' && !options.force) continue;
    const strictRegex = new RegExp(`(?:^|\\n)## ${project.alias}[\\s\\S]*?(?=\\n## |$)`, 'i');
    const fuzzyRegex = new RegExp(`(?:^|\\n)##[^\\n]*${project.alias}[\\s\\S]*?(?=\\n## |$)`, 'i');
    const match = safeDocs.match(strictRegex) || safeDocs.match(fuzzyRegex);
    if (!match) {
      console.warn(`  ${project.alias}: 文档拆分失败，标记为待重新生成`);
      failedDocs.push({ alias: project.alias, error: 'AI 响应中未找到项目文档' });
    }
    let doc = match ? match[0].trim() : `# ${project.alias}\n\n文档生成中，请稍后重试。`;
    if (match) {
      doc = await completeMissingSections(doc, projectExpectedSections, aiConfig, project.alias);
    }
    fs.writeFileSync(path.join(outputDir, `${project.alias}.md`), doc);
    if (match) generatedDocs[project.alias] = doc;
    state.projects[project.alias] = { status: match ? 'completed' : 'needs-regen' };
  }
  saveInitState(outputDir, state);
}

async function generateBatchMinimalDocs(ctx) {
  const { projects, scanResults, aiConfig, outputDir, options, state, generatedDocs, failedDocs, projectExpectedSections } = ctx;
  const pendingProjects = projects.filter(p =>
    !(state.projects[p.alias]?.status === 'completed' && !options.force)
  );

  log(`\n并发生成 ${pendingProjects.length} 个子项目文档 (并发度 ${CONCURRENCY})...`);
  const settled = await asyncPool(CONCURRENCY, pendingProjects, async (project) => {
    const alias = project.alias;
    logVerbose(`\n生成 ${alias}.md...`);
    const projectPrompt = buildInitPrompt({
      project,
      scanResult: scanResults[alias]
    });
    logVerbose('Prompt 长度:', projectPrompt.length, '字符');
    const aiStartTime = Date.now();
    const doc = await generateDocument(projectPrompt, aiConfig, alias);
    const aiTime = Date.now() - aiStartTime;
    logVerbose(`${alias} AI 调用完成 (耗时 ${aiTime}ms)`);
    const safeDoc = await completeMissingSections(
      filterSensitive(doc).content,
      projectExpectedSections,
      aiConfig,
      alias
    );
    fs.writeFileSync(path.join(outputDir, `${alias}.md`), safeDoc);
    return { alias, doc: safeDoc };
  });
  for (let j = 0; j < settled.length; j++) {
    const result = settled[j];
    if (result.status === 'fulfilled') {
      generatedDocs[result.value.alias] = result.value.doc;
      state.projects[result.value.alias] = { status: 'completed' };
      log(`  ${result.value.alias}.md 生成完成`);
    } else {
      const alias = pendingProjects[j]?.alias || 'unknown';
      console.error(`  ${alias}.md 生成失败:`, result.reason?.message);
      failedDocs.push({ alias, error: result.reason?.message });
      state.projects[alias] = { status: 'failed', error: result.reason?.message };
    }
    saveInitState(outputDir, state);
  }
}

async function generateBatchWithContextDocs(ctx) {
  const { projects, scanResults, aiConfig, outputDir, options, state, generatedDocs, failedDocs, projectExpectedSections } = ctx;
  const pendingProjects = projects.filter(p =>
    !(state.projects[p.alias]?.status === 'completed' && !options.force)
  );

  if (pendingProjects.length === 0) return;

  // BATCH_WITH_CONTEXT uses otherDocs as context. We process in waves of
  // CONCURRENCY so each wave's results are available as context for the next.
  log(`\n分批生成 ${pendingProjects.length} 个子项目文档 (并发度 ${CONCURRENCY}, 含上下文)...`);

  for (let i = 0; i < pendingProjects.length; i += CONCURRENCY) {
    const wave = pendingProjects.slice(i, i + CONCURRENCY);
    const settled = await asyncPool(CONCURRENCY, wave, async (project) => {
      logVerbose(`\n生成 ${project.alias}.md...`);
      const otherDocs = Object.fromEntries(
        Object.entries(generatedDocs).filter(([k]) => k !== project.alias)
      );
      const projectPrompt = buildInitPrompt({
        project,
        scanResult: scanResults[project.alias],
        otherDocs
      });
      logVerbose('Prompt 长度:', projectPrompt.length, '字符');
      const aiStartTime = Date.now();
      const doc = await generateDocument(projectPrompt, aiConfig, project.alias);
      const aiTime = Date.now() - aiStartTime;
      logVerbose(`${project.alias} AI 调用完成 (耗时 ${aiTime}ms)`);
      const safeDoc = await completeMissingSections(
        filterSensitive(doc).content,
        projectExpectedSections,
        aiConfig,
        project.alias
      );
      fs.writeFileSync(path.join(outputDir, `${project.alias}.md`), safeDoc);
      return { alias: project.alias, doc: safeDoc };
    });

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      if (result.status === 'fulfilled') {
        generatedDocs[result.value.alias] = result.value.doc;
        state.projects[result.value.alias] = { status: 'completed' };
        log(`  ${result.value.alias}.md 生成完成`);
      } else {
        const alias = wave[j]?.alias || 'unknown';
        console.error(`  ${alias}.md 生成失败:`, result.reason?.message);
        if (_verboseMode) {
          console.error('  错误详情:', result.reason?.stack);
        }
        failedDocs.push({ alias, error: result.reason?.message });
        state.projects[alias] = { status: 'failed', error: result.reason?.message };
      }
      saveInitState(outputDir, state);
    }
  }
}

async function generateOverviewDoc(ctx) {
  const { aiConfig, outputDir, config, generatedDocs, overviewExpectedSections } = ctx;
  const successCount = Object.keys(generatedDocs).length;
  if (successCount === 0) return;

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
  generatedDocs.OVERVIEW = safeOverview;
  log(`成功生成 ${successCount} 个子项目文档 + OVERVIEW.md`);
}

async function generateDocuments(rootDir, projects, scanResults, config, outputDir, state, options) {
  const generatedDocs = {};
  const failedDocs = [];

  const hasPendingProjects = projects.some(p =>
    !(state.projects[p.alias]?.status === 'completed' && !options.force)
  );

  if (options.generateDocs === false || options.skipAi) {
    return { generatedDocs, failedDocs, status: 'scanned', success: true };
  }

  if (!hasPendingProjects) {
    logStep('6/7', '生成项目文档');
    log('所有子项目都已生成过文档（记录在 ai-docs/.init-state.json）');
    log('如需重新生成，请使用：code-ctx init --force');
    log('或删除 ai-docs/.init-state.json 后重新运行');
    return { generatedDocs, failedDocs, status: 'unchanged', success: true };
  }

  logStep('6/7', '生成项目文档');
  const strategy = pickStrategy(projects, scanResults);

  try {
    logVerbose('加载 AI 配置...');
    const aiConfig = getAIConfig(rootDir);
    logVerbose('协议:', aiConfig.protocol);
    logVerbose('Base URL:', aiConfig.baseUrl);
    logVerbose('模型:', aiConfig.model);
    logVerbose('超时时间:', aiConfig.timeout, 'ms');

    if (!aiConfig.apiKey) {
      console.log('\n未配置 API Key，请先在 .env 文件中配置');
      for (const project of projects.filter(p =>
        !(state.projects[p.alias]?.status === 'completed' && !options.force)
      )) {
        failedDocs.push({ alias: project.alias, error: '未配置 API Key' });
        state.projects[project.alias] = { status: 'failed', error: '未配置 API Key' };
      }
      saveInitState(outputDir, state);
      return { generatedDocs, failedDocs, status: 'failed', success: false };
    }

    if (options.docType && ['api', 'database'].includes(options.docType)) {
      await generateTypeSpecificDocs({
        projects, scanResults, aiConfig, outputDir, options, state, failedDocs
      });
      const success = failedDocs.length === 0 && Object.keys(generatedDocs).length > 0;
      return {
        generatedDocs,
        failedDocs,
        status: success ? 'completed' : (Object.keys(generatedDocs).length > 0 ? 'partial' : 'failed'),
        success
      };
    }

    const projectExpectedSections = getExpectedSectionsFromTemplate('scan-prompt.md');
    const overviewExpectedSections = getExpectedSectionsFromTemplate('scan-prompt-overview.md');
    logVerbose('预期章节:', projectExpectedSections.length, '个');

    const ctx = {
      projects, scanResults, aiConfig, outputDir, options, state,
      generatedDocs, failedDocs, projectExpectedSections, config
    };

    if (strategy === 'ONE_SHOT') {
      await generateOneShotDocs(ctx);
    } else if (strategy === 'BATCH_MINIMAL') {
      await generateBatchMinimalDocs(ctx);
    } else {
      await generateBatchWithContextDocs(ctx);
    }

    try {
      await generateOverviewDoc({ ...ctx, overviewExpectedSections });
    } catch (err) {
      failedDocs.push({ alias: 'OVERVIEW', error: err.message });
      console.error('  OVERVIEW.md 生成失败:', err.message);
    }
  } catch (err) {
    console.error('\n文档生成失败:', err.message);
    if (_verboseMode) {
      console.error('错误详情:', err.stack);
    }
    if (failedDocs.length === 0) {
      failedDocs.push({ alias: 'generation', error: err.message });
    }
  }

  const generatedCount = Object.keys(generatedDocs).length;
  if (failedDocs.length === 0 && generatedCount === 0) {
    failedDocs.push({ alias: 'generation', error: '未生成任何文档' });
  }
  const success = failedDocs.length === 0;
  return {
    generatedDocs,
    failedDocs,
    status: success ? 'completed' : (generatedCount > 0 ? 'partial' : 'failed'),
    success
  };
}

function runSensitiveInfoCheck(outputDir) {
  logStep('7/7', '敏感信息检查');
  logVerbose('扫描目录:', outputDir);
  const sensitiveWarnings = scanDirectory(outputDir);
  if (sensitiveWarnings.length > 0) {
    log('\n检测到 ai-docs/ 中可能包含敏感信息：');
    sensitiveWarnings.forEach(w => {
      console.log(`  - ${w.file}: ${w.field}`);
    });
    log('建议运行 code-ctx doctor 查看详细报告');
  } else {
    logVerbose('未发现敏感信息');
  }
  return sensitiveWarnings;
}

function finalizeInit(rootDir, outputDir, projects, state, generation) {
  logVerbose('保存最终状态...');
  state.lastRun = new Date().toISOString();
  saveInitState(outputDir, state);

  if (generation.success) {
    const lastScanPath = path.join(outputDir, STATE_FILES.LAST_SCAN);
    const commitHash = hasGitRepo(rootDir) ? getCurrentCommitHash(rootDir) : null;
    fs.writeFileSync(lastScanPath, JSON.stringify({
      timestamp: Date.now(),
      lastCommitHash: commitHash,
      projects: projects.map(p => p.alias)
    }, null, 2));
  }
  logVerbose('状态文件已更新');

  if (!generation.success) {
    const generatedCount = Object.keys(generation.generatedDocs).length;
    const label = generation.status === 'partial' ? '初始化部分完成' : '初始化失败';
    console.error(`\n${label}：生成 ${generatedCount} 个，失败 ${generation.failedDocs.length} 个`);
    for (const failure of generation.failedDocs) {
      console.error(`  - ${failure.alias || 'unknown'}: ${failure.error}`);
    }
    console.error('请修复配置或网络问题后重新运行 code-ctx init');
    return;
  }

  if (generation.status === 'scanned') {
    console.log('\n✓ 项目扫描完成（已跳过 AI 文档生成）');
  } else if (generation.status === 'unchanged') {
    console.log('\n✓ 初始化检查完成（文档无需重新生成）');
  } else {
    console.log('\n✓ 初始化完成！');
  }
  console.log('ai-docs/ 已创建');
  console.log('\n下一步：');
  console.log('  开始开发前：  code-ctx use "你的任务描述"');
  console.log('  代码有大改动：code-ctx update');
  console.log('  检查文档健康：code-ctx doctor');
  console.log('  重新生成文档：code-ctx fix <子项目别名>');
}

async function initCommand(rootDir, options = {}) {
  setVerbose(options.verbose);

  validateRootDir(rootDir);
  initPlugins(rootDir);
  const projects = detectSubProjects(rootDir, options);
  const outputDir = prepareOutputDir(rootDir);

  const projectLimits = options.unlimited
    ? { maxFiles: Infinity, maxTokens: Infinity }
    : getProjectLimits(rootDir);
  logVerbose('项目限制:', projectLimits);

  const state = loadInitState(outputDir);
  const scanResults = scanAllProjects(projects, projectLimits, state, options);
  saveInitState(outputDir, state);
  logVerbose('状态已保存');

  const config = generateProjectConfig(rootDir, projects, options);

  const generation = await generateDocuments(
    rootDir, projects, scanResults, config, outputDir, state, options
  );

  const warnings = runSensitiveInfoCheck(outputDir);
  finalizeInit(rootDir, outputDir, projects, state, generation);

  return {
    projects,
    config,
    warnings,
    generation,
    success: generation.success,
    status: generation.status
  };
}

module.exports = { initCommand, setVerbose };
