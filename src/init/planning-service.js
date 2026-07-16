const path = require('path');
const {
  getConfigFile,
  saveProjectConfig
} = require('../utils/config');
const { buildInitPrompt } = require('../generator/prompt-builder');
const { evaluateContextBudget } = require('../utils/token-estimator');
const { TOKEN_THRESHOLDS } = require('../utils/constants');

function createPlanningService(dependencies = {}) {
  const pathImpl = dependencies.path || path;
  const inspectConfig = dependencies.getConfigFile || getConfigFile;
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

  return {
    plan(rootDir, projects, scanResults, options = {}) {
      logger.step('5/7', '生成配置文件');
      const config = buildConfig(rootDir, projects);
      const info = inspectConfig(rootDir);

      if (info.exists && !options.force) {
        logger.verbose('配置文件已存在，跳过');
        if (info.format === 'js') {
          logger.log('提示：检测到 code-ctx.config.js（旧格式）。新格式 code-ctx.config.json 更安全，可手动迁移：');
          logger.log('  cp code-ctx.config.js code-ctx.config.json # 然后改为纯 JSON');
        }
      } else {
        const format = options.configFormat === 'js' ? 'js'
          : options.configFormat === 'json' ? 'json'
          : info.exists ? info.format
          : 'json';
        const written = saveConfig(rootDir, config, { format });
        logger.verbose('配置文件已写入:', written.path);
      }

      return {
        config,
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
