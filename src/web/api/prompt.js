const express = require('express');
const { getScenarios } = require('../../template/engine');
const { useCommand } = require('../../commands/use');

module.exports = function () {
  const router = express.Router();

  router.get('/scenarios', (req, res) => {
    try {
      res.json(getScenarios());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/generate-prompt', (req, res) => {
    try {
      const { scenario, task, projectName, featureName, apiPrefix } = req.body;
      const prompt = useCommand({
        scenario,
        projectName,
        featureName: featureName || task,
        apiPrefix
      });
      res.json({ success: true, prompt });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
};
