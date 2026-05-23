const fs = require('fs');
const path = require('path');
const { getScenarios, clearCache } = require('../../../template/engine');
const { MAX_TEMPLATE_LENGTH, VALID_SCENARIO_ID_PATTERN } = require('../helpers');

module.exports = function register(router) {
  router.get('/scenarios', (req, res) => {
    try {
      const scenarios = getScenarios();
      const scenarioList = scenarios.map(s => ({
        id: s.id,
        key: s.id,
        name: s.name,
        description: s.description || '',
        relatedProjects: s.relatedProjects || [],
        template: s.template || ''
      }));
      res.json(scenarioList);
    } catch (err) {
      console.error('Scenarios load error:', err.message);
      res.status(500).json({ error: '场景加载失败' });
    }
  });

  router.put('/scenarios/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { template } = req.body || {};

      if (typeof template !== 'string') {
        return res.status(400).json({ error: 'template 必须是字符串' });
      }
      if (template.length > MAX_TEMPLATE_LENGTH) {
        return res.status(400).json({ error: `template 长度不能超过 ${MAX_TEMPLATE_LENGTH} 字符` });
      }

      const scenariosPath = path.join(__dirname, '../../../../templates/scenarios.json');
      const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));

      const isValidId = VALID_SCENARIO_ID_PATTERN.test(id) || scenarios.some(s => s.id === id);
      if (!isValidId) {
        return res.status(400).json({ error: `无效的场景 ID: ${id}` });
      }

      const scenario = scenarios.find(s => s.id === id);
      if (!scenario) {
        return res.status(404).json({ error: `未找到场景: ${id}` });
      }

      scenario.template = template;
      fs.writeFileSync(scenariosPath, JSON.stringify(scenarios, null, 2) + '\n');
      clearCache();
      res.json({ success: true });
    } catch (err) {
      console.error('Scenario update error:', err.message);
      res.status(500).json({ error: '场景更新失败' });
    }
  });
};
