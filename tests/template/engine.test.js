const { renderTemplate, getScenarios } = require('../../src/template/engine');

describe('Template Engine', () => {
  test('should render template with variables', () => {
    const template = '项目：{{projectName}}，端口：{{port}}';
    const variables = { projectName: 'my-app', port: '8080' };
    expect(renderTemplate(template, variables)).toBe('项目：my-app，端口：8080');
  });

  test('should get default scenarios', () => {
    const scenarios = getScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios[0]).toHaveProperty('id');
    expect(scenarios[0]).toHaveProperty('name');
    expect(scenarios[0]).toHaveProperty('template');
  });
});
