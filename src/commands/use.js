const fs = require('fs');
const path = require('path');
const { getScenarios } = require('../template/engine');
const { matchScenario } = require('../matcher/scenario-matcher');
const { buildUsePrompt } = require('../generator/prompt-builder');

async function useCommand(options = {}) {
  const { taskDescription, scenario, rootDir } = options;

  if (!taskDescription && !scenario) {
    throw new Error('请提供任务描述或指定场景');
  }

  // 1. 确定场景
  let matchedScenario = scenario;
  let confidence = 100;

  if (!matchedScenario && taskDescription) {
    const match = matchScenario(taskDescription);
    matchedScenario = match.scenarioId;
    confidence = match.confidence;
  }

  // 2. 加载场景模板
  const scenarios = getScenarios();
  const selectedScenario = scenarios.find(s => s.id === matchedScenario);
  if (!selectedScenario) {
    throw new Error(`未找到场景: ${matchedScenario}`);
  }

  // 3. 加载项目文档上下文
  let overviewContent = '';
  let relatedDocs = {};

  if (rootDir) {
    const aiDocsDir = path.join(rootDir, 'ai-docs');

    // 加载 OVERVIEW
    const overviewPath = path.join(aiDocsDir, 'OVERVIEW.md');
    if (fs.existsSync(overviewPath)) {
      overviewContent = fs.readFileSync(overviewPath, 'utf8');
    }

    // 加载相关子项目文档
    if (selectedScenario.relatedProjects) {
      for (const alias of selectedScenario.relatedProjects) {
        const docPath = path.join(aiDocsDir, `${alias}.md`);
        if (fs.existsSync(docPath)) {
          relatedDocs[`${alias}.md`] = fs.readFileSync(docPath, 'utf8');
        }
      }
    }

    // 加载接口契约
    const contractsPath = path.join(aiDocsDir, 'api-contracts.md');
    if (fs.existsSync(contractsPath)) {
      relatedDocs['api-contracts.md'] = fs.readFileSync(contractsPath, 'utf8');
    }
  }

  // 4. 组装 prompt
  const prompt = buildUsePrompt({
    taskDescription: taskDescription || '',
    overviewContent,
    relatedDocs,
    template: selectedScenario.template
  });

  return {
    prompt,
    matchedScenario,
    confidence,
    scenarioName: selectedScenario.name
  };
}

module.exports = { useCommand };
