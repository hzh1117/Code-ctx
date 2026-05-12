const KEYWORDS = {
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
const MIN_KEYWORD_LENGTH_FOR_HIGH_CONFIDENCE = 3;

function matchScenario(taskDescription) {
  if (typeof taskDescription !== 'string') {
    throw new TypeError('taskDescription must be a string');
  }
  
  const task = taskDescription.toLowerCase();

  let bestMatch = null;
  let bestLength = 0;

  for (const [scenarioId, keywords] of Object.entries(KEYWORDS)) {
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

module.exports = { matchScenario };
