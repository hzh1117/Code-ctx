const { getScenarios, renderTemplate } = require('../template/engine');

function useCommand(options = {}) {
  const { scenario, projectName, featureName, apiPrefix } = options;
  
  if (!scenario) {
    throw new Error('缺少必填参数: scenario');
  }
  
  // 获取场景模板
  const scenarios = getScenarios();
  const selectedScenario = scenarios.find(s => s.id === scenario);
  
  if (!selectedScenario) {
    throw new Error(`未找到场景: ${scenario}`);
  }
  
  // 渲染模板
  const prompt = renderTemplate(selectedScenario.template, {
    projectName: projectName || '项目',
    featureName: featureName || '新功能',
    apiPrefix: apiPrefix || '/api/'
  });
  
  return prompt;
}

module.exports = { useCommand };