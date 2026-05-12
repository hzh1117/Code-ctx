const { matchScenario } = require('../../src/matcher/scenario-matcher');

describe('matchScenario', () => {
  test('should match miniapp keyword to scenario A', () => {
    const result = matchScenario('新增小程序用户登录功能');
    expect(result.scenarioId).toBe('A');
    expect(result.confidence).toBe(100);
  });

  test('should match admin keyword to scenario B', () => {
    const result = matchScenario('商户后台新增优惠券管理');
    expect(result.scenarioId).toBe('B');
  });

  test('should match bug keyword to scenario F', () => {
    const result = matchScenario('修复登录页面无法显示的bug');
    expect(result.scenarioId).toBe('F');
  });

  test('should return low confidence for ambiguous task', () => {
    const result = matchScenario('优化性能');
    expect(result.confidence).toBeLessThan(100);
  });
});
