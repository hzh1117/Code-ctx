const { filterSensitive } = require('../../../utils/sensitive-filter');
const { buildContext, useCommand } = require('../../../commands/use');
const { evaluateContextBudget } = require('../../../utils/token-estimator');
const { getAIConfig } = require('../../../utils/config');

module.exports = function register(router, rootDir) {
  router.post('/generate-prompt', async (req, res) => {
    try {
      const { task, scenario } = req.body;
      const safeTask = filterSensitive(task || '').content;

      const result = await useCommand({
        taskDescription: safeTask,
        scenario,
        rootDir,
        noAiMatch: true,
        language: 'zh'
      });

      if (result.lowConfidenceScenarios) {
        return res.json({ success: false, ...result });
      }

      const prompt = await buildContext(safeTask, result.matchedScenario, {
        rootDir,
        noAiMatch: true,
        language: 'zh'
      });

      let tokenBudget = null;
      try {
        const aiConfig = getAIConfig(rootDir);
        tokenBudget = evaluateContextBudget(prompt, {
          maxInputTokens: aiConfig?.maxInputTokens,
          maxOutputTokens: aiConfig?.maxTokens
        });
      } catch {
        // tokenBudget is optional — never block the prompt response on it
      }

      res.json({
        success: true,
        scenario: result.matchedScenario,
        scenarioName: result.scenarioName,
        prompt,
        tokenBudget
      });
    } catch (err) {
      console.error('Generate prompt error:', err.message);
      res.status(500).json({ error: 'Prompt 生成失败' });
    }
  });
};
