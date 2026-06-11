const { filterSensitive } = require('../../../utils/sensitive-filter');
const { useCommand } = require('../../../commands/use');
const { evaluatePromptBudget } = require('../../../utils/token-estimator');
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

      // useCommand 已返回完整 prompt，无需重复调用 buildContext
      const prompt = result.prompt;

      let tokenBudget = result.tokenBudget || null;
      if (!tokenBudget) {
        try {
          const aiConfig = getAIConfig(rootDir);
          tokenBudget = evaluatePromptBudget(prompt, aiConfig?.maxTokens);
        } catch {
          // tokenBudget is optional — never block the prompt response on it
        }
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
