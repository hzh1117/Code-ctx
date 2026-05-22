const { generateWithAI } = require('../ai/client');
const { getScenarios } = require('../template/engine');

// Fallback used only when the scenarios JSON is unavailable or no scenario
// has a `keywords` field. New deployments should rely on the JSON (P19).
const FALLBACK_KEYWORDS = {
  'A': ['小程序', 'miniapp', 'uni-app', '前端', '页面', 'C端', '用户端'],
  'B': ['商户', '管理后台', 'admin', '后台', '管理端'],
  'C': ['平台', '管控', '运营'],
  'D': ['数据库', '表结构', 'schema', '迁移'],
  'E': ['优化', '重构', '修改', '调整', '改进'],
  'F': ['bug', '错误', '问题', '修复', '排查', '异常'],
  'G': ['后端', '接口', 'API', '服务端'],
  'H': ['跨端', '多端', '联动', '全栈']
};

const HIGH_CONFIDENCE = 100;
const MEDIUM_CONFIDENCE = 60;
const LOW_CONFIDENCE = 30;
const AI_CONFIDENCE_THRESHOLD = 50;
const MIN_KEYWORD_LENGTH_FOR_HIGH_CONFIDENCE = 3;

function loadKeywordsMap(language) {
  let scenarios;
  try {
    scenarios = getScenarios(undefined, language);
  } catch {
    return FALLBACK_KEYWORDS;
  }

  const map = {};
  let anyFromJson = false;
  for (const s of scenarios) {
    if (Array.isArray(s.keywords) && s.keywords.length > 0) {
      map[s.id] = s.keywords;
      anyFromJson = true;
    } else if (FALLBACK_KEYWORDS[s.id]) {
      // Per-scenario fallback for stale custom scenarios that lack the field.
      map[s.id] = FALLBACK_KEYWORDS[s.id];
    }
  }

  if (!anyFromJson && Object.keys(map).length === 0) {
    return FALLBACK_KEYWORDS;
  }
  return map;
}

function matchScenario(taskDescription, language) {
  if (typeof taskDescription !== 'string') {
    throw new TypeError('taskDescription must be a string');
  }

  const task = taskDescription.toLowerCase();
  const keywordsMap = loadKeywordsMap(language);

  let bestMatch = null;
  let bestLength = 0;

  for (const [scenarioId, keywords] of Object.entries(keywordsMap)) {
    for (const keyword of keywords) {
      const kw = keyword.toLowerCase();
      if (task.includes(kw) && kw.length > bestLength) {
        bestLength = kw.length;
        bestMatch = { scenarioId, keyword };
      }
    }
  }

  if (bestMatch) {
    const confidence = bestLength >= MIN_KEYWORD_LENGTH_FOR_HIGH_CONFIDENCE ? HIGH_CONFIDENCE : MEDIUM_CONFIDENCE;
    return {
      scenarioId: bestMatch.scenarioId,
      confidence,
      matchedKeyword: bestMatch.keyword
    };
  }

  return {
    scenarioId: 'A',
    confidence: LOW_CONFIDENCE,
    matchedKeyword: null
  };
}

function buildScenarioMatchPrompt(taskDescription, scenarios) {
  const scenarioList = scenarios.map(s =>
    `- ${s.id}: ${s.name} — ${s.description}`
  ).join('\n');

  return `你是一个开发任务分类器。根据用户的任务描述，从以下场景中选择最匹配的一个。

场景列表：
${scenarioList}

用户任务：${taskDescription}

请只返回一个 JSON 对象，格式如下，不要返回其他内容：
{"scenarioId": "X", "reason": "简短理由"}`;
}

async function matchScenarioWithAI(taskDescription, aiConfig, options = {}) {
  const { language, noAiMatch } = options;

  // First try keyword matching
  const keywordResult = matchScenario(taskDescription, language);

  // If confidence is high enough, return keyword result
  if (keywordResult.confidence >= AI_CONFIDENCE_THRESHOLD) {
    return { ...keywordResult, method: 'keyword' };
  }

  // If --no-ai-match is set or no AI config, return keyword result
  if (noAiMatch || !aiConfig || !aiConfig.apiKey) {
    return { ...keywordResult, method: 'keyword' };
  }

  // AI fallback
  try {
    const scenarios = getScenarios(undefined, language);
    const prompt = buildScenarioMatchPrompt(taskDescription, scenarios);
    const response = await generateWithAI(prompt, {
      ...aiConfig,
      maxTokens: 200
    });

    // Parse AI response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validIds = scenarios.map(s => s.id);
      if (parsed.scenarioId && validIds.includes(parsed.scenarioId)) {
        return {
          scenarioId: parsed.scenarioId,
          confidence: 80,
          matchedKeyword: keywordResult.matchedKeyword,
          method: 'ai',
          aiReason: parsed.reason
        };
      }
    }
  } catch (err) {
    // AI fallback failed, fall through to keyword result
  }

  return { ...keywordResult, method: 'keyword' };
}

module.exports = { matchScenario, matchScenarioWithAI, buildScenarioMatchPrompt };
