const fs = require('fs');
const path = require('path');
const os = require('os');
const { matchScenario } = require('../../src/matcher/scenario-matcher');
const { getScenarios, clearCache } = require('../../src/template/engine');

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

  test('should throw TypeError for null input', () => {
    expect(() => matchScenario(null)).toThrow(TypeError);
  });

  test('should throw TypeError for undefined input', () => {
    expect(() => matchScenario(undefined)).toThrow(TypeError);
  });

  test('should return default result for empty string', () => {
    const result = matchScenario('');
    expect(result.scenarioId).toBe('A');
    expect(result.confidence).toBe(30);
    expect(result.matchedKeyword).toBeNull();
  });

  test('should match case-insensitively', () => {
    const result = matchScenario('MINIAPP');
    expect(result.scenarioId).toBe('A');
    expect(result.confidence).toBe(100);
  });

  test('should return object with correct structure', () => {
    const result = matchScenario('test');
    expect(result).toHaveProperty('scenarioId');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('matchedKeyword');
    expect(typeof result.scenarioId).toBe('string');
    expect(typeof result.confidence).toBe('number');
    expect(result.matchedKeyword === null || typeof result.matchedKeyword === 'string').toBe(true);
  });

  test('keywords come from scenarios.json (zh)', () => {
    // Sanity check: each scenario in scenarios.json carries a keywords array
    // so the matcher reads from JSON rather than the hardcoded fallback.
    const scenarios = getScenarios();
    for (const s of scenarios) {
      expect(Array.isArray(s.keywords)).toBe(true);
      expect(s.keywords.length).toBeGreaterThan(0);
    }
  });

  test('matches English keyword when language=en', () => {
    const result = matchScenario('add merchant admin page', 'en');
    expect(result.scenarioId).toBe('B');
    expect(result.confidence).toBe(100);
  });

  test('matches English bug keyword when language=en', () => {
    const result = matchScenario('investigate exception in checkout flow', 'en');
    // 'exception' (9), 'investigate' (11), 'flow' (4) — longest wins.
    expect(result.scenarioId).toBe('F');
  });

  test('falls back to hardcoded keywords when scenarios JSON is missing keywords field', () => {
    // Write a temp scenarios JSON without `keywords`, point getScenarios at it
    // via the custom-path branch, and verify matchScenario still works using
    // the FALLBACK_KEYWORDS per-id map.
    clearCache();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codectx-matcher-'));
    const tempPath = path.join(tempDir, 'scenarios.json');
    try {
      fs.writeFileSync(tempPath, JSON.stringify([
        { id: 'A', name: 'a', description: 'a', relatedProjects: [], template: '' },
        { id: 'F', name: 'f', description: 'f', relatedProjects: [], template: '' }
      ]));

      // getScenarios honors the custom-path branch only when called with a path.
      // matchScenario itself always reads the default path, so to assert
      // fallback we use a tiny shim: mock getScenarios to return the stripped data.
      jest.resetModules();
      jest.doMock('../../src/template/engine', () => {
        const actual = jest.requireActual('../../src/template/engine');
        return {
          ...actual,
          getScenarios: () => JSON.parse(fs.readFileSync(tempPath, 'utf8'))
        };
      });
      const { matchScenario: matchScenarioReloaded } = require('../../src/matcher/scenario-matcher');

      // Even though the scenarios JSON has no keywords, the hardcoded
      // FALLBACK_KEYWORDS still contains 'bug' under F.
      const result = matchScenarioReloaded('fix this bug now');
      expect(result.scenarioId).toBe('F');
      expect(result.confidence).toBe(100);
    } finally {
      jest.dontMock('../../src/template/engine');
      jest.resetModules();
      fs.rmSync(tempDir, { recursive: true, force: true });
      clearCache();
    }
  });
});
