const { filterSensitive } = require('../../../utils/sensitive-filter');
const { useCommand } = require('../../../commands/use');
const { getAIConfig } = require('../../../utils/config');

module.exports = function register(router, rootDir) {
  router.post('/generate-prompt', async (req, res) => {
    try {
      const { task, scenario } = req.body;
      const safeTask = filterSensitive(task || '').content;
      let aiConfig = null;
      try {
        aiConfig = getAIConfig(rootDir);
      } catch {
        // Prompt generation can continue with default token limits.
      }

      const result = await useCommand({
        taskDescription: safeTask,
        scenario,
        rootDir,
        aiConfig,
        noAiMatch: true,
        language: 'zh'
      });

      if (result.lowConfidenceScenarios) {
        return res.json({ success: false, ...result });
      }

      res.json({
        success: true,
        scenario: result.matchedScenario,
        scenarioName: result.scenarioName,
        prompt: result.prompt,
        tokenBudget: result.tokenBudget,
        compactInfo: result.compactInfo,
        loadedDocs: result.loadedDocs
      });
    } catch (err) {
      console.error('Generate prompt error:', err.message);
      res.status(500).json({ error: 'Prompt 生成失败' });
    }
  });
};
