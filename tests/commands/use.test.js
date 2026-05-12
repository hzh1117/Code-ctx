const { useCommand } = require('../../src/commands/use');

describe('useCommand', () => {
  test('should generate prompt for scenario', async () => {
    const prompt = await useCommand({
      scenario: 'A',
      projectName: 'test-app',
      featureName: '用户登录',
      apiPrefix: '/api/'
    });
    
    expect(prompt).toContain('test-app');
    expect(prompt).toContain('用户登录');
    expect(prompt).toContain('/api/');
  });

  test('should throw error for invalid scenario', async () => {
    await expect(useCommand({ scenario: 'X' })).rejects.toThrow('未找到场景');
  });
});