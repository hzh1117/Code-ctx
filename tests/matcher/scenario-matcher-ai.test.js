// matchScenarioWithAI 与 buildScenarioMatchPrompt 测试
// 现有 tests/matcher/scenario-matcher.test.js 覆盖了关键词匹配，本文件补 AI 分支
// 与 fallback 分支。

jest.mock('../../src/ai/client', () => ({
  generateWithAI: jest.fn()
}));

const { generateWithAI } = require('../../src/ai/client');
const { matchScenarioWithAI, buildScenarioMatchPrompt } = require('../../src/matcher/scenario-matcher');
const { getScenarios, clearCache } = require('../../src/template/engine');

describe('buildScenarioMatchPrompt', () => {
  test('包含场景列表与任务描述，返回纯字符串', () => {
    const scenarios = [
      { id: 'A', name: '前端', description: '小程序' },
      { id: 'F', name: 'Bug', description: '修复缺陷' }
    ];
    const prompt = buildScenarioMatchPrompt('修复登录失败', scenarios);
    expect(prompt).toContain('A: 前端');
    expect(prompt).toContain('F: Bug');
    expect(prompt).toContain('修复登录失败');
    expect(prompt).toContain('scenarioId');
  });

  test('空 scenarios 列表也能生成 prompt', () => {
    const prompt = buildScenarioMatchPrompt('任务', []);
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('任务');
  });
});

describe('matchScenarioWithAI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
  });

  test('关键词高置信度时不调用 AI', async () => {
    const result = await matchScenarioWithAI('修复登录 bug', { apiKey: 'k' });
    expect(result.method).toBe('keyword');
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  test('noAiMatch=true 时直接返回关键词结果', async () => {
    const result = await matchScenarioWithAI('不在任何关键词里的随机短语 xyzqqq', { apiKey: 'k' }, { noAiMatch: true });
    expect(result.method).toBe('keyword');
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  test('aiConfig 缺失时返回关键词结果', async () => {
    const result = await matchScenarioWithAI('不在任何关键词里的随机短语 xyzqqq');
    expect(result.method).toBe('keyword');
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  test('aiConfig 无 apiKey 时返回关键词结果', async () => {
    const result = await matchScenarioWithAI('不在任何关键词里的随机短语 xyzqqq', {});
    expect(result.method).toBe('keyword');
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  test('低置信度 + AI 返回有效 scenarioId 时采用 AI 结果', async () => {
    const scenarios = getScenarios();
    const validId = scenarios[0].id;
    generateWithAI.mockResolvedValue(
      JSON.stringify({
        scenarioId: validId,
        reason: 'AI 推断这是 ' + validId
      })
    );

    const result = await matchScenarioWithAI('一个没有关键词的模糊任务 zzzqqqxxx', { apiKey: 'k' });

    expect(generateWithAI).toHaveBeenCalled();
    expect(result.method).toBe('ai');
    expect(result.scenarioId).toBe(validId);
    expect(result.confidence).toBe(80);
    expect(result.aiReason).toContain('AI');
  });

  test('AI 返回非法 scenarioId 时降级到关键词', async () => {
    generateWithAI.mockResolvedValue(
      JSON.stringify({
        scenarioId: 'ZZZ', // 不在 valid ids 中
        reason: 'fake'
      })
    );

    const result = await matchScenarioWithAI('一个没有关键词的模糊任务 zzzqqqxxx', { apiKey: 'k' });

    expect(result.method).toBe('keyword');
  });

  test('AI 返回无 JSON 时降级到关键词', async () => {
    generateWithAI.mockResolvedValue('我不知道这是什么任务');

    const result = await matchScenarioWithAI('一个没有关键词的模糊任务 zzzqqqxxx', { apiKey: 'k' });

    expect(result.method).toBe('keyword');
  });

  test('AI 抛错时降级到关键词', async () => {
    generateWithAI.mockRejectedValue(new Error('API timeout'));

    const result = await matchScenarioWithAI('一个没有关键词的模糊任务 zzzqqqxxx', { apiKey: 'k' });

    expect(result.method).toBe('keyword');
  });

  test('用户取消时直接向上传播，不降级到关键词', async () => {
    const error = new Error('cancelled');
    error.code = 'AI_REQUEST_ABORTED';
    generateWithAI.mockRejectedValue(error);

    await expect(matchScenarioWithAI('一个没有关键词的模糊任务 zzzqqqxxx', { apiKey: 'k' })).rejects.toMatchObject({
      code: 'AI_REQUEST_ABORTED'
    });
  });

  test('AI 返回 JSON 含额外文本时仍能解析', async () => {
    const scenarios = getScenarios();
    const validId = scenarios[0].id;
    generateWithAI.mockResolvedValue(
      '我认为这是\n```json\n' + JSON.stringify({ scenarioId: validId, reason: 'r' }) + '\n```\n谢谢'
    );

    const result = await matchScenarioWithAI('一个没有关键词的模糊任务 zzzqqqxxx', { apiKey: 'k' });

    expect(result.method).toBe('ai');
    expect(result.scenarioId).toBe(validId);
  });

  test('AI 返回 JSON 但 scenarioId 字段缺失时降级', async () => {
    generateWithAI.mockResolvedValue(JSON.stringify({ reason: '没给 id' }));

    const result = await matchScenarioWithAI('一个没有关键词的模糊任务 zzzqqqxxx', { apiKey: 'k' });

    expect(result.method).toBe('keyword');
  });

  test('language=en 时传入英文场景列表', async () => {
    generateWithAI.mockResolvedValue(
      JSON.stringify({
        scenarioId: 'F',
        reason: 'bug-like'
      })
    );

    const result = await matchScenarioWithAI(
      'a totally unrelated description xyzabc',
      { apiKey: 'k' },
      { language: 'en' }
    );

    expect(generateWithAI).toHaveBeenCalled();
    expect(['ai', 'keyword']).toContain(result.method);
  });
});

describe('loadKeywordsMap 间接覆盖', () => {
  beforeEach(() => {
    jest.resetModules();
    clearCache();
  });

  afterEach(() => {
    jest.dontMock('../../src/template/engine');
    jest.resetModules();
    clearCache();
  });

  test('getScenarios 抛错时使用 FALLBACK_KEYWORDS', () => {
    jest.doMock('../../src/template/engine', () => ({
      getScenarios: () => {
        throw new Error('boom');
      }
    }));
    const { matchScenario } = require('../../src/matcher/scenario-matcher');
    const result = matchScenario('修复 bug');
    // FALLBACK_KEYWORDS 的 F 包含 'bug'
    expect(result.scenarioId).toBe('F');
  });

  test('scenarios 全部无 keywords 且 FALLBACK 也无对应 id 时退到 FALLBACK_KEYWORDS', () => {
    jest.doMock('../../src/template/engine', () => ({
      getScenarios: () => [{ id: 'Z1' }, { id: 'Z2' }]
    }));
    const { matchScenario } = require('../../src/matcher/scenario-matcher');
    // 既然 map 为空且无 anyFromJson，会落入 FALLBACK_KEYWORDS（含 bug）
    const result = matchScenario('修复 bug');
    expect(result.scenarioId).toBe('F');
  });
});
