const fs = require('fs');
const path = require('path');
const { getScenarios } = require('../template/engine');
const { matchScenarioWithAI } = require('../matcher/scenario-matcher');
const { buildUsePrompt } = require('../generator/prompt-builder');
const { filterSensitive } = require('../utils/sensitive-filter');
const { extractSection, listSections } = require('../core/section');
const { initPlugins } = require('../plugins/loader');
const { addTask } = require('../utils/task-history');
const { evaluateContextBudget, estimateTokensForContent } = require('../utils/token-estimator');

const COMPACT_THRESHOLD_TOKENS = 2000;
const LOW_CONFIDENCE_THRESHOLD = 50;
const SCENARIO_SECTION_PROFILES = {
  A: ['overview', 'modules', 'api', 'notes', 'dependencies'],
  B: ['overview', 'modules', 'api', 'notes', 'data', 'dependencies'],
  C: ['overview', 'api', 'modules', 'notes', 'data', 'dependencies'],
  D: ['overview', 'data', 'modules', 'notes', 'dependencies'],
  E: ['overview', 'api', 'modules', 'notes', 'dependencies'],
  F: ['overview', 'modules', 'notes', 'dependencies'],
  G: ['overview', 'api', 'modules', 'notes', 'data', 'dependencies'],
  H: ['overview', 'api', 'dependencies', 'modules', 'notes', 'data']
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
      if (typeof alias !== 'string' || !alias || alias.includes('/') || alias.includes('\\') || alias.includes('..')) continue;
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

function sectionsForScenario(scenarioId, taskDescription) {
  const sections = new Set(SCENARIO_SECTION_PROFILES[scenarioId] || [
    'overview', 'modules', 'notes'
  ]);
  const task = String(taskDescription || '').toLowerCase();
  if (/api|接口|路由|endpoint/.test(task)) sections.add('api');
  if (/数据|数据库|表|schema|model|store|状态/.test(task)) sections.add('data');
  if (/依赖|集成|调用|联调|dependency/.test(task)) sections.add('dependencies');
  return [...sections];
}

function summarizeRemoved(name, sectionName, content, reason) {
  const summary = String(content || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return `- ${name}#${sectionName}: ${reason}; summary=${summary || '(empty)'}`;
}

function compactDocument(name, content, preferredSections, budget, removals) {
  const availableSections = listSections(content);
  if (availableSections.length === 0 && String(content || '').trim()) {
    removals.push(summarizeRemoved(name, 'unstructured', content, 'missing section markers'));
  }
  const selected = [];
  let usedTokens = 0;
  for (const sectionName of preferredSections) {
    const section = extractSection(content, sectionName);
    if (!section) continue;
    const tokens = estimateTokensForContent(section);
    if (usedTokens + tokens <= budget) {
      selected.push(`<!-- section:${sectionName} -->\n${section}\n<!-- /section:${sectionName} -->`);
      usedTokens += tokens;
    } else {
      const remaining = Math.max(0, budget - usedTokens);
      if (remaining > 30) {
        const ratio = remaining / tokens;
        const truncated = section.slice(0, Math.max(80, Math.floor(section.length * ratio)));
        selected.push(`<!-- section:${sectionName} -->\n${truncated}\n[truncated: token budget]\n<!-- /section:${sectionName} -->`);
        usedTokens = budget;
      }
      removals.push(summarizeRemoved(name, sectionName, section, 'token budget'));
    }
  }
  for (const sectionName of availableSections) {
    if (!preferredSections.includes(sectionName)) {
      removals.push(summarizeRemoved(
        name,
        sectionName,
        extractSection(content, sectionName),
        'not selected for scenario'
      ));
    }
  }
  return selected.join('\n\n');
}

function compactPrompt(prompt, taskDescription, selectedScenario, overviewContent, relatedDocs) {
  const originalLength = prompt.length;
  const originalTokens = estimateTokensForContent(prompt);
  const preferredSections = sectionsForScenario(selectedScenario.id, taskDescription);
  const basePrompt = buildUsePrompt({
    taskDescription: taskDescription || '',
    overviewContent: '',
    relatedDocs: {},
    template: selectedScenario.template || ''
  });
  const contentBudget = Math.max(
    200,
    COMPACT_THRESHOLD_TOKENS - estimateTokensForContent(basePrompt) - 250
  );
  const documentCount = Object.keys(relatedDocs).length + (overviewContent ? 1 : 0);
  const perDocumentBudget = Math.max(100, Math.floor(contentBudget / Math.max(1, documentCount)));
  const removals = [];
  const compactOverview = overviewContent
    ? compactDocument('OVERVIEW.md', overviewContent, preferredSections, perDocumentBudget, removals)
    : '';

  const compactRelatedDocs = {};
  for (const [name, content] of Object.entries(relatedDocs)) {
    compactRelatedDocs[name] = compactDocument(
      name, content, preferredSections, perDocumentBudget, removals
    );
  }

  if (removals.length > 0) {
    compactRelatedDocs['CONTEXT_COMPRESSION.md'] = [
      'Context compression report (removed content and reason):',
      ...removals
    ].join('\n');
  }

  const compacted = buildUsePrompt({
    taskDescription: taskDescription || '',
    overviewContent: compactOverview,
    relatedDocs: compactRelatedDocs,
    template: selectedScenario.template || ''
  });

  return {
    prompt: compacted,
    originalLength,
    compactLength: compacted.length,
    originalTokens,
    compactTokens: estimateTokensForContent(compacted),
    removed: removals
  };
}

async function buildContext(task, scenario, options = {}) {
  const { rootDir, aiConfig, noAiMatch, language } = options;
  if (rootDir) initPlugins(rootDir);
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

  if (estimateTokensForContent(prompt) > COMPACT_THRESHOLD_TOKENS) {
    const result = compactPrompt(prompt, task, resolved.selectedScenario, overviewContent, relatedDocs);
    prompt = filterSensitive(result.prompt).content;
  }

  return prompt;
}

async function useCommand(options = {}) {
  const { taskDescription, scenario, rootDir, aiConfig, noAiMatch, language } = options;

  if (rootDir) initPlugins(rootDir);

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
  if (estimateTokensForContent(prompt) > COMPACT_THRESHOLD_TOKENS) {
    const result = compactPrompt(prompt, taskDescription, selectedScenario, overviewContent, relatedDocs);
    prompt = filterSensitive(result.prompt).content;
    compactInfo = {
      originalLength: result.originalLength,
      compactLength: result.compactLength,
      originalTokens: result.originalTokens,
      compactTokens: result.compactTokens,
      removed: result.removed
    };
  }

  if (rootDir) {
    try {
      addTask(rootDir, {
        source: 'use',
        task: taskDescription,
        scenario: matchedScenario,
        scenarioName: selectedScenario.name,
        relatedProjects: selectedScenario.relatedProjects || [],
        matchMethod,
        confidence,
        prompt
      });
    } catch (err) {
      // History writes are best-effort; never fail the user-facing prompt
      // build because of a disk hiccup.
      if (process.env.AI_DEBUG === 'true') {
        console.debug('[use] addTask failed:', err.message);
      }
    }
  }

  return {
    prompt,
    matchedScenario,
    confidence,
    scenarioName: selectedScenario.name,
    compactInfo,
    matchMethod,
    aiReason,
    loadedDocs,
    tokenBudget: evaluateContextBudget(prompt, {
      maxInputTokens: aiConfig?.maxInputTokens,
      maxOutputTokens: aiConfig?.maxTokens
    })
  };
}

module.exports = { useCommand, buildContext };
