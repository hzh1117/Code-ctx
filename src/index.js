// Public API for programmatic use. The CLI entry is bin/code-ctx, not this module.
// Exports are commands plus the matcher/template helpers that have legitimate
// programmatic callers (e.g. the Web Dashboard, downstream tools).

const { initCommand } = require('./commands/init');
const { updateCommand, executeUpdates, executeUpdateTransaction, applySectionUpdates } = require('./commands/update');
const { useCommand, buildContext } = require('./commands/use');
const { doctorCommand, doctorFix, runDoctor } = require('./commands/doctor');
const { fixCommand } = require('./commands/fix');
const { statusCommand } = require('./commands/status');
const { getScenarios, loadTemplate, renderTemplate } = require('./template/engine');
const { matchScenario, matchScenarioWithAI } = require('./matcher/scenario-matcher');
const { buildUsePrompt, buildInitPrompt } = require('./generator/prompt-builder');

module.exports = {
  initCommand,
  updateCommand,
  executeUpdates,
  executeUpdateTransaction,
  applySectionUpdates,
  useCommand,
  buildContext,
  doctorCommand,
  doctorFix,
  runDoctor,
  fixCommand,
  statusCommand,
  getScenarios,
  loadTemplate,
  renderTemplate,
  matchScenario,
  matchScenarioWithAI,
  buildUsePrompt,
  buildInitPrompt
};
