const { createInitLogger } = require('../init/logger');
const { createDiscoveryService } = require('../init/discovery-service');
const { createSnapshotService } = require('../init/snapshot-service');
const { createPlanningService } = require('../init/planning-service');
const { createGenerationService } = require('../init/generation-service');
const { createValidationService } = require('../init/validation-service');
const { createCommitService } = require('../init/commit-service');

const defaultLogger = createInitLogger();

function createInitServices(dependencies = {}) {
  const logger = dependencies.logger || defaultLogger;
  const shared = { ...dependencies, logger };
  const validator = dependencies.validationService || createValidationService(shared);

  return {
    logger,
    discovery: dependencies.discoveryService || createDiscoveryService(shared),
    snapshot: dependencies.snapshotService || createSnapshotService(shared),
    planning: dependencies.planningService || createPlanningService(shared),
    generation: dependencies.generationService || createGenerationService({
      ...shared,
      validator
    }),
    validation: validator,
    commit: dependencies.commitService || createCommitService(shared)
  };
}

function createInitCommand(dependencies = {}) {
  const services = createInitServices(dependencies);

  return async function initCommand(rootDir, options = {}) {
    services.logger.setVerbose(options.verbose);

    const projects = services.discovery.discover(rootDir, options);
    const runtimeContext = services.discovery.getRuntimeContext
      ? services.discovery.getRuntimeContext()
      : null;
    const snapshot = await services.snapshot.capture(rootDir, projects, {
      ...options,
      registry: runtimeContext?.registry
    });
    const plan = services.planning.plan(rootDir, projects, snapshot.scanResults, options);
    const generation = await services.generation.generate({
      rootDir,
      projects,
      scanResults: snapshot.scanResults,
      outputDir: snapshot.outputDir,
      state: snapshot.state,
      stateStore: snapshot.stateStore,
      config: plan.config,
      plan,
      options
    });
    const warnings = services.validation.inspect(snapshot.outputDir);
    services.commit.commit({
      rootDir,
      outputDir: snapshot.outputDir,
      projects,
      state: snapshot.state,
      stateStore: snapshot.stateStore,
      generation
    });

    return {
      projects,
      config: plan.config,
      configMerge: plan.mergeReport,
      warnings,
      generation,
      success: generation.success,
      status: generation.status
    };
  };
}

const initCommand = createInitCommand();

function setVerbose(verbose) {
  defaultLogger.setVerbose(verbose);
}

module.exports = { initCommand, createInitCommand, createInitServices, setVerbose };
