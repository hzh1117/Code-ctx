const fs = require('fs');
const path = require('path');
const { getScenarios } = require('../template/engine');
const { matchScenario } = require('../matcher/scenario-matcher');
const { buildUsePrompt } = require('../generator/prompt-builder');
const { filterSensitive } = require('../utils/sensitive-filter');
const { extractSection } = require('../core/section');
const { PROMPT_MAX_CHARS } = require('../utils/constants');

const COMPACT_THRESHOLD = PROMPT_MAX_CHARS;
const LOW_CONFIDENCE_THRESHOLD = 50;

function compactPrompt(prompt, taskDescription, template, overviewContent, relatedDocs) {
  const originalLength = prompt.length;

  let compactOverview = overviewContent;
  if (overviewContent) {
    const table = extractSection(overviewContent, '改动项目速查表');
    compactOverview = table || '';
  }

  const compactRelatedDocs = {};
  for (const [name, content] of Object.entries(relatedDocs)) {
    const core = extractSection(content, '核心功能模块');
    const notes = extractSection(content, '开发注意事项');
    const parts = [];
    if (core) parts.push(core);
    if (notes) parts.push(notes);
    if (parts.length > 0) {
      compactRelatedDocs[name] = parts.join('\n\n');
    }
  }

  const compacted = buildUsePrompt({
    taskDescription: taskDescription || '',
    overviewContent: compactOverview,
    relatedDocs: compactRelatedDocs,
    template: template || ''
  });

  return {
    prompt: compacted,
    originalLength,
    compactLength: compacted.length
  };
}

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

    // 低置信度：返回所有场景供用户选择
    if (confidence < LOW_CONFIDENCE_THRESHOLD) {
      const allScenarios = getScenarios();
      return {
        lowConfidenceScenarios: allScenarios.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description
        })),
        matchedScenario,
        confidence,
        matchedKeyword: match.matchedKeyword
      };
    }
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
  let prompt = buildUsePrompt({
    taskDescription: taskDescription || '',
    overviewContent,
    relatedDocs,
    template: selectedScenario.template
  });

  // 5. 敏感信息过滤
  prompt = filterSensitive(prompt).content;

  // 6. 精简模式：超过阈值时自动压缩
  let compactInfo = null;
  if (prompt.length > COMPACT_THRESHOLD) {
    const result = compactPrompt(prompt, taskDescription, selectedScenario.template, overviewContent, relatedDocs);
    prompt = filterSensitive(result.prompt).content;
    compactInfo = {
      originalLength: result.originalLength,
      compactLength: result.compactLength
    };
  }

  return {
    prompt,
    matchedScenario,
    confidence,
    scenarioName: selectedScenario.name,
    compactInfo
  };
}

module.exports = { useCommand };
