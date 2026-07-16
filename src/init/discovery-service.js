const fs = require('fs');
const path = require('path');
const { detectProjects } = require('../scanner/project-detector');
const { loadProjectConfig } = require('../utils/config');
const { initPlugins } = require('../plugins/loader');
const { createIgnoreEngine } = require('../utils/ignore-engine');

function createDiscoveryService(dependencies = {}) {
  const fileSystem = dependencies.fs || fs;
  const pathImpl = dependencies.path || path;
  const detect = dependencies.detectProjects || detectProjects;
  const loadConfig = dependencies.loadProjectConfig || loadProjectConfig;
  const initializePlugins = dependencies.initPlugins || initPlugins;
  const buildIgnoreEngine = dependencies.createIgnoreEngine || createIgnoreEngine;
  const clock = dependencies.clock || { now: () => Date.now() };
  const logger = dependencies.logger;
  let runtimeContext = null;

  function applyConfiguredOverrides(rootDir, projects) {
    const config = loadConfig(rootDir);
    if (!Array.isArray(config.projects)) return projects;

    const configuredByPath = new Map(
      config.projects.filter(project => project.path).map(project => [pathImpl.resolve(rootDir, project.path), project])
    );

    return projects.map(project => {
      const configured = configuredByPath.get(pathImpl.resolve(project.path));
      if (!configured) return project;
      return {
        ...project,
        type: configured.type || project.type,
        scanPatterns: Array.isArray(configured.scanPatterns) ? configured.scanPatterns.slice() : undefined
      };
    });
  }

  return {
    discover(rootDir, options = {}) {
      logger.step('1/7', '检查项目目录');
      logger.verbose('根目录:', rootDir);
      if (!fileSystem.existsSync(rootDir)) throw new Error(`目录不存在: ${rootDir}`);
      logger.verbose('目录存在 ✓');

      runtimeContext = initializePlugins(rootDir);
      const ignoreEngine = buildIgnoreEngine(rootDir);
      logger.step('2/7', '检测子项目');
      const startTime = clock.now();
      let projects = detect(rootDir, { registry: runtimeContext.registry, ignoreEngine });
      logger.log(`检测到 ${projects.length} 个项目 (耗时 ${clock.now() - startTime}ms)`);

      if (logger.isVerbose()) {
        projects.forEach(project => {
          logger.verbose(`  - ${project.alias}: ${project.name} (${project.type}) → ${project.path}`);
        });
      }

      if (options.project) {
        const target = projects.find(project => project.alias === options.project);
        if (!target) {
          throw new Error(`未找到子项目: ${options.project}，可用的子项目: ${projects.map(p => p.alias).join(', ')}`);
        }
        projects = [target];
        logger.log(`仅处理子项目: ${options.project}`);
      }

      if (!options.skipPrompt && projects.length > 0) {
        logger.log('\n检测到以下子项目：');
        projects.forEach(project => {
          logger.log(`  [${project.alias}] ${project.name} → ${project.type}`);
        });
      }

      return applyConfiguredOverrides(rootDir, projects);
    },
    getRuntimeContext() {
      return runtimeContext;
    }
  };
}

module.exports = { createDiscoveryService };
