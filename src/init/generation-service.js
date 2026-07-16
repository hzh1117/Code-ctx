const fs = require('fs');
const path = require('path');
const { getAIConfig } = require('../utils/config');
const { generateWithContinuation } = require('../ai/client');
const { isAICancellationError } = require('../ai/errors');
const {
  buildInitPrompt,
  buildApiPrompt,
  buildDatabasePrompt
} = require('../generator/prompt-builder');
const {
  generateDeterministicDocs,
  writeProjectManifest
} = require('../generator/deterministic-docs');
const { parseOneShotDocuments } = require('../generator/one-shot-parser');

const CONCURRENCY = 2;

async function asyncPool(poolSize, items, fn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const promise = fn(item).then(value => {
      executing.delete(promise);
      return value;
    }, error => {
      executing.delete(promise);
      throw error;
    });
    promise.catch(() => {});
    executing.add(promise);
    results.push(promise);
    if (executing.size >= poolSize) await Promise.race(executing).catch(() => {});
  }
  return Promise.allSettled(results);
}

function createGenerationService(dependencies = {}) {
  const fileSystem = dependencies.fs || fs;
  const pathImpl = dependencies.path || path;
  const loadAIConfig = dependencies.getAIConfig || getAIConfig;
  const generateAI = dependencies.generateAI || generateWithContinuation;
  const buildPrompt = dependencies.buildInitPrompt || buildInitPrompt;
  const buildApi = dependencies.buildApiPrompt || buildApiPrompt;
  const buildDatabase = dependencies.buildDatabasePrompt || buildDatabasePrompt;
  const deterministicDocs = dependencies.generateDeterministicDocs || generateDeterministicDocs;
  const writeManifest = dependencies.writeProjectManifest || writeProjectManifest;
  const parseDocuments = dependencies.parseOneShotDocuments || parseOneShotDocuments;
  const clock = dependencies.clock || { now: () => Date.now() };
  const logger = dependencies.logger;
  const validator = dependencies.validator;

  async function generateDocument(prompt, aiConfig, alias) {
    return generateAI(prompt, {
      ...aiConfig,
      onProgress: ({ attempt, maxAttempts }) => {
        logger.log(`[续写 ${attempt}/${maxAttempts}] ${alias}...`);
      }
    });
  }

  async function completeMissingSections(doc, expected, aiConfig, alias) {
    const missing = expected.filter(section => !validator.listSections(doc).includes(section));
    if (missing.length === 0) return doc;
    const completion = await generateDocument([
      `以上文档缺少以下章节，请补充完整：${missing.join(', ')}`,
      '',
      '要求：',
      '- 只输出缺失章节内容',
      '- 每个章节必须使用对应的 HTML section 标记包裹',
      '- 不要重复已经存在的章节',
      '',
      '原文档：',
      doc
    ].join('\n'), aiConfig, alias);
    return `${doc.trim()}\n\n${validator.sanitize(completion).trim()}\n`;
  }

  function pendingProjects(ctx) {
    return ctx.projects.filter(project =>
      !(ctx.state.projects[project.alias]?.status === 'completed' && !ctx.options.force)
    );
  }

  function recordSettled(ctx, settled, projects) {
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        ctx.generatedDocs[result.value.alias] = result.value.doc;
        ctx.state.projects[result.value.alias] = { status: 'completed' };
        logger.log(`  ${result.value.alias}.md 生成完成`);
      } else {
        const alias = projects[index]?.alias || 'unknown';
        logger.error(`  ${alias}.md 生成失败:`, result.reason?.message);
        if (logger.isVerbose()) logger.error('  错误详情:', result.reason?.stack);
        ctx.failedDocs.push({ alias, error: result.reason?.message });
        ctx.state.projects[alias] = { status: 'failed', error: result.reason?.message };
      }
      ctx.stateStore.save(ctx.outputDir, ctx.state);
    });
  }

  function throwIfCancelled(settled) {
    const cancellation = settled.find(result =>
      result.status === 'rejected' && isAICancellationError(result.reason)
    );
    if (cancellation) throw cancellation.reason;
  }

  async function generateTypeSpecific(ctx) {
    logger.log(`生成 ${ctx.options.docType.toUpperCase()} 文档...`);
    const projects = pendingProjects(ctx).filter(project =>
      project.type.includes('backend') || project.type.includes('java')
    );
    if (projects.length === 0) {
      logger.log(`没有适合生成 ${ctx.options.docType} 文档的项目`);
      return;
    }

    logger.log(`串行生成 ${projects.length} 个子项目 ${ctx.options.docType.toUpperCase()} 文档...`);
    for (const project of projects) {
      try {
        const docType = ctx.options.docType;
        const template = docType === 'api' ? 'java-api-prompt.md' : 'java-database-prompt.md';
        const prompt = docType === 'api'
          ? buildApi({ project, scanResult: ctx.scanResults[project.alias] })
          : buildDatabase({ project, scanResult: ctx.scanResults[project.alias] });
        const startedAt = clock.now();
        const raw = await generateDocument(prompt, ctx.aiConfig, `${project.alias}-${docType}`);
        const doc = await completeMissingSections(
          validator.sanitize(raw),
          validator.expectedSections(template),
          ctx.aiConfig,
          `${project.alias}-${docType}`
        );
        const fileName = `${project.alias}-${docType}.md`;
        fileSystem.writeFileSync(pathImpl.join(ctx.outputDir, fileName), doc);
        ctx.generatedDocs[`${project.alias}-${docType}`] = doc;
        ctx.state.projects[project.alias] = {
          ...ctx.state.projects[project.alias],
          [`${docType}Doc`]: 'completed'
        };
        ctx.stateStore.save(ctx.outputDir, ctx.state);
        logger.log(`  ${fileName} 生成完成 (耗时 ${clock.now() - startedAt}ms)`);
      } catch (error) {
        if (isAICancellationError(error)) throw error;
        logger.error(`  ${project.alias}-${ctx.options.docType}.md 生成失败:`, error.message);
        ctx.failedDocs.push({
          alias: project.alias,
          docType: ctx.options.docType,
          error: error.message
        });
      }
    }
  }

  async function generateOneShot(ctx) {
    logger.log('\nONE_SHOT 模式：所有子项目合并生成...');
    const prompt = buildPrompt({
      projects: ctx.projects,
      scanResults: ctx.scanResults,
      type: 'one-shot'
    });
    logger.verbose('Prompt 长度:', prompt.length, '字符');
    const raw = await generateDocument(prompt, ctx.aiConfig, 'one-shot');
    const projects = pendingProjects(ctx);
    const parsed = parseDocuments(
      validator.sanitize(raw),
      projects.map(project => project.alias)
    );

    for (const project of projects) {
      const parseError = parsed.errors.get(project.alias);
      if (parseError) {
        logger.warn(`  ${project.alias}: ${parseError}`);
        ctx.failedDocs.push({ alias: project.alias, error: parseError });
        ctx.state.projects[project.alias] = { status: 'failed', error: parseError };
        continue;
      }
      try {
        let doc = parsed.documents.get(project.alias);
        doc = await completeMissingSections(
          doc,
          ctx.projectExpectedSections,
          ctx.aiConfig,
          project.alias
        );
        const missing = ctx.projectExpectedSections.filter(section =>
          !validator.listSections(doc).includes(section)
        );
        if (missing.length > 0) throw new Error(`文档缺少 section: ${missing.join(', ')}`);
        fileSystem.writeFileSync(pathImpl.join(ctx.outputDir, `${project.alias}.md`), doc);
        ctx.generatedDocs[project.alias] = doc;
        ctx.state.projects[project.alias] = { status: 'completed' };
      } catch (error) {
        ctx.failedDocs.push({ alias: project.alias, error: error.message });
        ctx.state.projects[project.alias] = { status: 'failed', error: error.message };
        logger.error(`  ${project.alias}.md 校验失败: ${error.message}`);
      }
    }
    ctx.stateStore.save(ctx.outputDir, ctx.state);
  }

  async function generateMinimal(ctx) {
    const projects = pendingProjects(ctx);
    logger.log(`\n并发生成 ${projects.length} 个子项目文档 (并发度 ${CONCURRENCY})...`);
    const settled = await asyncPool(CONCURRENCY, projects, async project => {
      const prompt = buildPrompt({
        project,
        scanResult: ctx.scanResults[project.alias]
      });
      const raw = await generateDocument(prompt, ctx.aiConfig, project.alias);
      const doc = await completeMissingSections(
        validator.sanitize(raw),
        ctx.projectExpectedSections,
        ctx.aiConfig,
        project.alias
      );
      fileSystem.writeFileSync(pathImpl.join(ctx.outputDir, `${project.alias}.md`), doc);
      return { alias: project.alias, doc };
    });
    throwIfCancelled(settled);
    recordSettled(ctx, settled, projects);
  }

  async function generateWithContext(ctx) {
    const projects = pendingProjects(ctx);
    if (projects.length === 0) return;
    logger.log(`\n分批生成 ${projects.length} 个子项目文档 (并发度 ${CONCURRENCY}, 含上下文)...`);
    for (let i = 0; i < projects.length; i += CONCURRENCY) {
      const wave = projects.slice(i, i + CONCURRENCY);
      const settled = await asyncPool(CONCURRENCY, wave, async project => {
        const otherDocs = Object.fromEntries(
          Object.entries(ctx.generatedDocs).filter(([alias]) => alias !== project.alias)
        );
        const prompt = buildPrompt({
          project,
          scanResult: ctx.scanResults[project.alias],
          otherDocs
        });
        const raw = await generateDocument(prompt, ctx.aiConfig, project.alias);
        const doc = await completeMissingSections(
          validator.sanitize(raw),
          ctx.projectExpectedSections,
          ctx.aiConfig,
          project.alias
        );
        fileSystem.writeFileSync(pathImpl.join(ctx.outputDir, `${project.alias}.md`), doc);
        return { alias: project.alias, doc };
      });
      throwIfCancelled(settled);
      recordSettled(ctx, settled, wave);
    }
  }

  async function generateOverview(ctx) {
    const successCount = Object.keys(ctx.generatedDocs).length;
    if (successCount === 0) return;
    logger.log('\n生成 OVERVIEW.md...');
    const raw = await generateDocument(buildPrompt({
      type: 'overview',
      config: ctx.config,
      generatedDocs: ctx.generatedDocs
    }), ctx.aiConfig, 'OVERVIEW');
    const overview = await completeMissingSections(
      validator.sanitize(raw),
      validator.expectedSections('scan-prompt-overview.md'),
      ctx.aiConfig,
      'OVERVIEW'
    );
    fileSystem.writeFileSync(pathImpl.join(ctx.outputDir, 'OVERVIEW.md'), overview);
    ctx.generatedDocs.OVERVIEW = overview;
    logger.log(`成功生成 ${successCount} 个子项目文档 + OVERVIEW.md`);
  }

  return {
    async generate(context) {
      const ctx = {
        ...context,
        generatedDocs: {},
        failedDocs: []
      };
      const pending = pendingProjects(ctx);
      if (ctx.options.generateDocs === false) {
        return { generatedDocs: {}, failedDocs: [], status: 'scanned', success: true };
      }
      if (ctx.options.skipAi) {
        const deterministic = deterministicDocs(
          ctx.rootDir,
          ctx.projects,
          ctx.scanResults,
          ctx.outputDir
        );
        ctx.projects.forEach(project => {
          ctx.state.projects[project.alias] = { status: 'completed', mode: 'deterministic' };
        });
        ctx.stateStore.save(ctx.outputDir, ctx.state);
        return {
          generatedDocs: deterministic.generatedDocs,
          failedDocs: [],
          manifest: deterministic.manifest,
          status: 'offline-completed',
          success: true
        };
      }
      if (pending.length === 0) {
        logger.step('6/7', '生成项目文档');
        logger.log('所有子项目都已生成过文档（记录在 ai-docs/.init-state.json）');
        logger.log('如需重新生成，请使用：code-ctx init --force');
        logger.log('或删除 ai-docs/.init-state.json 后重新运行');
        return { generatedDocs: {}, failedDocs: [], status: 'unchanged', success: true };
      }

      logger.step('6/7', '生成项目文档');
      try {
        ctx.aiConfig = { ...loadAIConfig(ctx.rootDir), signal: ctx.options.signal };
        if (!ctx.aiConfig.apiKey) {
          logger.log('\n未配置 API Key，请先在 .env 文件中配置');
          pending.forEach(project => {
            ctx.failedDocs.push({ alias: project.alias, error: '未配置 API Key' });
            ctx.state.projects[project.alias] = { status: 'failed', error: '未配置 API Key' };
          });
          ctx.stateStore.save(ctx.outputDir, ctx.state);
          return { generatedDocs: {}, failedDocs: ctx.failedDocs, status: 'failed', success: false };
        }

        if (ctx.options.docType && ['api', 'database'].includes(ctx.options.docType)) {
          await generateTypeSpecific(ctx);
        } else {
          ctx.projectExpectedSections = validator.expectedSections('scan-prompt.md');
          const strategy = ctx.plan.selectStrategy(ctx.aiConfig);
          if (strategy === 'ONE_SHOT') await generateOneShot(ctx);
          else if (strategy === 'BATCH_MINIMAL') await generateMinimal(ctx);
          else await generateWithContext(ctx);

          try {
            await generateOverview(ctx);
          } catch (error) {
            if (isAICancellationError(error)) throw error;
            ctx.failedDocs.push({ alias: 'OVERVIEW', error: error.message });
            logger.error('  OVERVIEW.md 生成失败:', error.message);
          }
          if (Object.keys(ctx.generatedDocs).length > 0) {
            writeManifest(ctx.rootDir, ctx.projects, ctx.scanResults, ctx.outputDir, 'ai');
          }
        }
      } catch (error) {
        if (isAICancellationError(error)) throw error;
        logger.error('\n文档生成失败:', error.message);
        if (logger.isVerbose()) logger.error('错误详情:', error.stack);
        if (ctx.failedDocs.length === 0) {
          ctx.failedDocs.push({ alias: 'generation', error: error.message });
        }
      }

      const generatedCount = Object.keys(ctx.generatedDocs).length;
      if (ctx.failedDocs.length === 0 && generatedCount === 0) {
        ctx.failedDocs.push({ alias: 'generation', error: '未生成任何文档' });
      }
      const success = ctx.failedDocs.length === 0;
      return {
        generatedDocs: ctx.generatedDocs,
        failedDocs: ctx.failedDocs,
        status: success ? 'completed' : (generatedCount > 0 ? 'partial' : 'failed'),
        success
      };
    }
  };
}

module.exports = { createGenerationService, asyncPool };
