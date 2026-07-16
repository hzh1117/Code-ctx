const path = require('path');
const {
  getConfigFile,
  loadProjectConfig,
  saveProjectConfig
} = require('../utils/config');
const { buildInitPrompt } = require('../generator/prompt-builder');
const { evaluateContextBudget } = require('../utils/token-estimator');
const { TOKEN_THRESHOLDS } = require('../utils/constants');

function createPlanningService(dependencies = {}) {
  const pathImpl = dependencies.path || path;
  const inspectConfig = dependencies.getConfigFile || getConfigFile;
  const loadConfig = dependencies.loadProjectConfig || loadProjectConfig;
  const saveConfig = dependencies.saveProjectConfig || saveProjectConfig;
  const buildPrompt = dependencies.buildInitPrompt || buildInitPrompt;
  const evaluateBudget = dependencies.evaluateContextBudget || evaluateContextBudget;
  const logger = dependencies.logger;

  function buildConfig(rootDir, projects) {
    return {
      projectName: pathImpl.basename(rootDir),
      outputDir: './ai-docs',
      aiMode: 'clipboard',
      projects: projects.map(project => {
        const relativePath = pathImpl.relative(rootDir, project.path);
        return {
          alias: project.alias,
          path: relativePath ? `./${relativePath.split(pathImpl.sep).join('/')}` : '.',
          type: project.type,
          label: project.name
        };
      }),
      excludeDirs: ['node_modules', '.git', 'dist', 'build', 'ai-docs'],
      gitTrack: true
    };
  }

  function projectArray(projects) {
    if (Array.isArray(projects)) return projects;
    if (projects && typeof projects === 'object') {
      return Object.entries(projects).map(([alias, project]) => ({ alias, ...project }));
    }
    return [];
  }

  function mergeConfig(rootDir, detected, existing) {
    const detectedByPath = new Map(detected.projects.map(project => [
      pathImpl.resolve(rootDir, project.path),
      project
    ]));
    const existingProjects = projectArray(existing.projects);
    const existingByPath = new Map(existingProjects
      .filter(project => typeof project.path === 'string')
      .map(project => [pathImpl.resolve(rootDir, project.path), project]));
    const conflicts = [];

    const projects = detected.projects.map(project => {
      const absolutePath = pathImpl.resolve(rootDir, project.path);
      const configured = existingByPath.get(absolutePath);
      if (!configured) return project;
      for (const field of ['alias', 'type', 'label']) {
        if (configured[field] !== undefined && configured[field] !== project[field]) {
          conflicts.push({ path: project.path, field, detected: project[field], kept: configured[field] });
        }
      }
      return { ...project, ...configured, path: project.path };
    });
    const retained = existingProjects.filter(project => {
      if (typeof project.path !== 'string') return true;
      return !detectedByPath.has(pathImpl.resolve(rootDir, project.path));
    });

    return {
      config: { ...detected, ...existing, projects: [...projects, ...retained] },
      report: {
        source: 'merged',
        detected: detected.projects.length,
        matched: detected.projects.length - projects.filter(project =>
          !existingByPath.has(pathImpl.resolve(rootDir, project.path))
        ).length,
        retained: retained.map(project => project.alias),
        conflicts
      }
    };
  }

  return {
    plan(rootDir, projects, scanResults, options = {}) {
      logger.step('5/7', '生成配置文件');
      const detectedConfig = buildConfig(rootDir, projects);
      const info = inspectConfig(rootDir);
      const merged = info.exists
        ? mergeConfig(rootDir, detectedConfig, loadConfig(rootDir))
        : { config: detectedConfig, report: { source: 'detected', detected: projects.length, matched: 0, retained: [], conflicts: [] } };
      const config = merged.config;

      if (info.exists && !options.force) {
        logger.verbose('配置文件已存在，跳过');
        if (info.format === 'js') {
          logger.log('提示：检测到 code-ctx.config.js（旧格式）。新格式 code-ctx.config.json 更安全，可手动迁移：');
          logger.log('  cp code-ctx.config.js code-ctx.config.json # 然后改为纯 JSON');
        }
      } else {
        const written = saveConfig(rootDir, config, { format: 'json' });
        logger.verbose('配置文件已写入:', written.path);
      }

      return {
        config,
        mergeReport: merged.report,
        selectStrategy(aiConfig) {
          const budgetOptions = {
            maxInputTokens: aiConfig.maxInputTokens,
            maxOutputTokens: aiConfig.maxTokens
          };
          const oneShot = evaluateBudget(buildPrompt({
            projects,
            scanResults,
            type: 'one-shot'
          }), budgetOptions);
          const batches = projects.map(project => evaluateBudget(buildPrompt({
            project,
            scanResult: scanResults[project.alias]
          }), budgetOptions));
          const largestBatchInput = Math.max(0, ...batches.map(budget => budget.input.estimate));
          logger.log(
            `Prompt 预算: one-shot ~${oneShot.input.estimate} input tokens；` +
            `batch 最大 ~${largestBatchInput}；output 上限 ${aiConfig.maxTokens}`
          );

          let strategy = 'BATCH_MINIMAL';
          if (oneShot.status !== 'over' && oneShot.input.estimate < TOKEN_THRESHOLDS.ONE_SHOT) {
            strategy = 'ONE_SHOT';
          } else if (
            batches.every(budget => budget.status !== 'over') &&
            largestBatchInput <= TOKEN_THRESHOLDS.BATCH
          ) {
            strategy = 'BATCH_WITH_CONTEXT';
          }
          logger.log(`策略: ${strategy}`);
          return strategy;
        }
      };
    }
  };
}

module.exports = { createPlanningService };
