const fs = require('fs');
const path = require('path');
const os = require('os');
const { renderTemplate, getScenarios } = require('../../src/template/engine');

describe('Template Engine', () => {
  describe('renderTemplate', () => {
    test('should render template with variables', () => {
      const template = '项目：{{projectName}}，端口：{{port}}';
      const variables = { projectName: 'my-app', port: '8080' };
      expect(renderTemplate(template, variables)).toBe('项目：my-app，端口：8080');
    });

    test('should keep placeholder when variable is missing', () => {
      const template = 'Hello {{name}}, age {{age}}';
      const variables = { name: 'World' };
      expect(renderTemplate(template, variables)).toBe('Hello World, age {{age}}');
    });

    test('should handle empty template', () => {
      expect(renderTemplate('', {})).toBe('');
    });

    test('should handle template without placeholders', () => {
      expect(renderTemplate('no placeholders', {})).toBe('no placeholders');
    });

    test('should replace with empty string when variable is empty string', () => {
      expect(renderTemplate('{{x}}', { x: '' })).toBe('');
    });

    test('should replace with 0 when variable is 0', () => {
      expect(renderTemplate('{{x}}', { x: 0 })).toBe('0');
    });

    test('should throw TypeError for non-string template', () => {
      expect(() => renderTemplate(123, {})).toThrow(TypeError);
      expect(() => renderTemplate(null, {})).toThrow(TypeError);
    });

    test('should throw TypeError for invalid variables', () => {
      expect(() => renderTemplate('test', null)).toThrow(TypeError);
      expect(() => renderTemplate('test', 'string')).toThrow(TypeError);
    });
  });

  describe('getScenarios', () => {
    test('should get default scenarios', () => {
      const scenarios = getScenarios();
      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios[0]).toHaveProperty('id');
      expect(scenarios[0]).toHaveProperty('name');
      expect(scenarios[0]).toHaveProperty('template');
    });

    test('should throw for non-existent file', () => {
      expect(() => getScenarios('/non/existent/path.json')).toThrow('Scenarios file not found');
    });

    test('should throw for invalid JSON', () => {
      const tmpFile = path.join(os.tmpdir(), `invalid-${Date.now()}.json`);
      fs.writeFileSync(tmpFile, '{bad json');
      try {
        expect(() => getScenarios(tmpFile)).toThrow('Invalid JSON in scenarios file');
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    test('should load all 8 scenarios (A-H)', () => {
      const scenarios = getScenarios();
      const ids = scenarios.map(s => s.id);
      expect(ids).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']));
      expect(scenarios.length).toBe(8);
    });

    test('each scenario should have required fields', () => {
      const scenarios = getScenarios();
      for (const s of scenarios) {
        expect(s).toHaveProperty('id');
        expect(s).toHaveProperty('name');
        expect(s).toHaveProperty('description');
        expect(s).toHaveProperty('relatedProjects');
        expect(s).toHaveProperty('template');
        expect(Array.isArray(s.relatedProjects)).toBe(true);
        expect(typeof s.template).toBe('string');
        expect(s.template.length).toBeGreaterThan(0);
      }
    });
  });
});
