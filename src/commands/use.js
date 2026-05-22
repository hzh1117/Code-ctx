const fs = require('fs');
const path = require('path');
const { getScenarios } = require('../template/engine');
const { matchScenarioWithAI } = require('../matcher/scenario-matcher');
const { buildUsePrompt } = require('../generator/prompt-builder');
const { filterSensitive } = require('../utils/sensitive-filter');
const { extractSection } = require('../core/section');
const { PROMPT_MAX_CHARS } = require('../utils/constants');

const COMPACT_THRESHOLD = PROMPT_MAX_CHARS;
const LOW_CONFIDENCE_THRESHOLD = 50;
const COMPACT_SECTION_IDS = {
  overview: ['overview'],
  relatedDocs: ['modules', 'notes']
};

async function resolveScenario(taskDescription, scenario, aiConfig, noAiMatch, language) {
  if (!taskDescription && !scenario) {
    throw new Error('请提供任务描述或指定场景');
  }

  let matchedScenario = scenario;
  let confidence = 100;
  let matchMethod = 'manual';
  let aiReason = null;
  let matchedKeyword = null;

  if (!matchedScenario && taskDescription) {
    const match = await matchScenarioWithAI(taskDescription, aiConfig, { noAiMatch, language });
    matchedScenario = match.scenarioId;
    confidence = match.confidence;
    matchMethod = match.method;
    aiReason = match.aiReason || null;
    matchedKeyword = match.matchedKeyword || null;
  }

  const scenarios = getScenarios(undefined, language);
  const selectedScenario = scenarios.find(s => s.id === matchedScenario);
  if (!selectedScenario) {
    throw new Error(language === 'en' ? `Scenario not found: ${matchedScenario}` : `未找到场景: ${matchedScenario}`);
  }

  return { matchedScenario, confidence, matchMethod, aiReason, matchedKeyword, selectedScenario };
}

function loadContextDocs(rootDir, selectedScenario) {
  let overviewContent = '';
  const relatedDocs = {};
  const loadedDocs = [];

  if (!rootDir) {
    return { overviewContent, relatedDocs, loadedDocs };
  }

  const aiDocsDir = path.join(rootDir, 'ai-docs');

  const overviewPath = path.join(aiDocsDir, 'OVERVIEW.md');
  if (fs.existsSync(overviewPath)) {
    overviewContent = fs.readFileSync(overviewPath, 'utf8');
    loadedDocs.push('OVERVIEW.md');
  }

  if (selectedScenario.relatedProjects) {
    for (const alias of selectedScenario.relatedProjects) {
      const docPath = path.join(aiDocsDir, `${alias}.md`);
      if (fs.existsSync(docPath)) {
        relatedDocs[`${alias}.md`] = fs.readFileSync(docPath, 'utf8');
        loadedDocs.push(`${alias}.md`);
      }
    }
  }

  const contractsPath = path.join(aiDocsDir, 'api-contracts.md');
  if (fs.existsSync(contractsPath)) {
    relatedDocs['api-contracts.md'] = fs.readFileSync(contractsPath, 'utf8');
    loadedDocs.push('api-contracts.md');
  }

  return { overviewContent, relatedDocs, loadedDocs };
}

function extractFirstSection(content, sectionNames) {
  for (const name of sectionNames) {
    const section = extractSection(content, name);
    if (section) return section;
  }
  return null;
}

function compactPrompt(prompt, taskDescription, template, overviewContent, relatedDocs) {
  const originalLength = prompt.length;

  let compactOverview = overviewContent;
  if (overviewContent) {
    compactOverview = extractFirstSection(overviewContent, COMPACT_SECTION_IDS.overview) || '';
  }

  const compactRelatedDocs = {};
  for (const [name, content] of Object.entries(relatedDocs)) {
    const parts = [];
    for (const sectionName of COMPACT_SECTION_IDS.relatedDocs) {
      const section = extractSection(content, sectionName);
      if (section) parts.push(section);
    }
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

async function buildContext(task, scenario, options = {}) {
  const { rootDir, aiConfig, noAiMatch, language } = options;
  const resolved = await resolveScenario(task, scenario, aiConfig, noAiMatch, language);
  const { overviewContent, relatedDocs } = loadContextDocs(rootDir, resolved.selectedScenario);

  let prompt = buildUsePrompt({
    taskDescription: task || '',
    overviewContent,
    relatedDocs,
    template: resolved.selectedScenario.template,
    language
  });

  prompt = filterSensitive(prompt).content;

  if (prompt.length > COMPACT_THRESHOLD) {
    const result = compactPrompt(prompt, task, resolved.selectedScenario.template, overviewContent, relatedDocs);
    prompt = filterSensitive(result.prompt).content;
  }

  return prompt;
}

async function useCommand(options = {}) {
  const { taskDescription, scenario, rootDir, aiConfig, noAiMatch, language } = options;

  // 1. 确定场景
  const resolved = await resolveScenario(taskDescription, scenario, aiConfig, noAiMatch, language);
  const { matchedScenario, confidence, matchMethod, aiReason, matchedKeyword, selectedScenario } = resolved;

  // 低置信度：返回所有场景供用户选择
  if (confidence < LOW_CONFIDENCE_THRESHOLD && matchMethod === 'keyword') {
    const allScenarios = getScenarios();
    return {
      lowConfidenceScenarios: allScenarios.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description
      })),
      matchedScenario,
      confidence,
      matchedKeyword,
      matchMethod
    };
  }

  // 3. 加载项目文档上下文
  const { overviewContent, relatedDocs, loadedDocs } = loadContextDocs(rootDir, selectedScenario);

  // 4. 组装 prompt
  let prompt = buildUsePrompt({
    taskDescription: taskDescription || '',
    overviewContent,
    relatedDocs,
    template: selectedScenario.template,
    language
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
    compactInfo,
    matchMethod,
    aiReason,
    loadedDocs
  };
}

module.exports = { useCommand, buildContext };
