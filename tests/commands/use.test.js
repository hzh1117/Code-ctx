const { useCommand } = require('../../src/commands/use');

describe('useCommand', () => {
  test('should generate prompt for scenario', () => {
    const prompt = useCommand({
      scenario: 'A',
      projectName: 'test-app',
      featureName: '用户登录',
      apiPrefix: '/api/'
    });
    
    expect(prompt).toContain('test-app');
    expect(prompt).toContain('用户登录');
    expect(prompt).toContain('/api/');
  });

  test('should throw error for invalid scenario', () => {
    expect(() => useCommand({ scenario: 'X' })).toThrow('未找到场景');
  });

  test('should throw error when scenario is missing', () => {
    expect(() => useCommand({})).toThrow('缺少必填参数: scenario');
  });

  test('should use default values when optional parameters are missing', () => {
    const prompt = useCommand({ scenario: 'A' });
    
    expect(prompt).toContain('项目');
    expect(prompt).toContain('新功能');
    expect(prompt).toContain('/api/');
  });
});