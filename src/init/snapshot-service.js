const fs = require('fs');
const path = require('path');
const { scanProject } = require('../scanner/file-scanner');
const { getProjectLimits } = require('../utils/config');
const { STATE_FILES } = require('../utils/constants');

function createFileStateStore(fileSystem = fs, pathImpl = path) {
  return {
    load(outputDir) {
      const statePath = pathImpl.join(outputDir, STATE_FILES.INIT_STATE);
      if (!fileSystem.existsSync(statePath)) return { lastRun: null, projects: {} };
      try {
        return JSON.parse(fileSystem.readFileSync(statePath, 'utf8'));
      } catch {
        return { lastRun: null, projects: {} };
      }
    },
    save(outputDir, state) {
      fileSystem.writeFileSync(
        pathImpl.join(outputDir, STATE_FILES.INIT_STATE),
        JSON.stringify(state, null, 2)
      );
    }
  };
}

function createSnapshotService(dependencies = {}) {
  const fileSystem = dependencies.fs || fs;
  const pathImpl = dependencies.path || path;
  const scanner = dependencies.scanProject || scanProject;
  const getLimits = dependencies.getProjectLimits || getProjectLimits;
  const clock = dependencies.clock || { now: () => Date.now() };
  const stateStore = dependencies.stateStore || createFileStateStore(fileSystem, pathImpl);
  const logger = dependencies.logger;

  return {
    capture(rootDir, projects, options = {}) {
      logger.step('3/7', '创建输出目录');
      const outputDir = pathImpl.join(rootDir, 'ai-docs');
      if (!fileSystem.existsSync(outputDir)) {
        fileSystem.mkdirSync(outputDir, { recursive: true });
        logger.verbose('创建目录:', outputDir);
      } else {
        logger.verbose('目录已存在:', outputDir);
      }

      const limits = options.unlimited
        ? { maxFiles: Infinity, maxTokens: Infinity }
        : getLimits(rootDir);
      logger.verbose('项目限制:', limits);

      const state = stateStore.load(outputDir);
      const scanResults = {};
      logger.step('4/7', '扫描项目文件');
      for (const project of projects) {
        if (state.projects[project.alias]?.status === 'completed' && !options.force && !options.skipAi) {
          logger.log(`跳过 ${project.alias}（已完成）`);
          continue;
        }

        logger.verbose(`\n开始扫描: ${project.alias}`);
        const startedAt = clock.now();
        const result = scanner(project.path, project.type, {
          ...limits,
          scanPatterns: project.scanPatterns
        });
        scanResults[project.alias] = result;
        logger.log(`扫描 ${project.name} 完成 (耗时 ${clock.now() - startedAt}ms)`);
        logger.verbose(`  - 文件数: ${result.limitedTo}/${result.totalFiles}`);
        logger.verbose(`  - 预估 tokens: ${result.estimatedTokens}`);
        if (result.totalFiles > result.limitedTo) {
          logger.log(`  文件数量限制: ${result.totalFiles} → ${result.limitedTo}`);
        }
        logger.log(`  预估 tokens: ~${result.estimatedTokens}`);
        state.projects[project.alias] = { status: 'scanned' };
      }
      stateStore.save(outputDir, state);
      logger.verbose('状态已保存');
      return { outputDir, scanResults, state, stateStore };
    }
  };
}

module.exports = { createSnapshotService, createFileStateStore };
