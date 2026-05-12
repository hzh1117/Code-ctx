const { detectProjects } = require('../../src/scanner/project-detector');
const fs = require('fs');
const path = require('path');

describe('detectProjects', () => {
  const testDir = path.join(__dirname, '../fixtures/projects');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should detect uni-app project', () => {
    const projectDir = path.join(testDir, 'my-app');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      dependencies: { 'uni-app': '^2.0.0' }
    }));
    fs.writeFileSync(path.join(projectDir, 'manifest.json'), JSON.stringify({
      'mp-weixin': {}
    }));

    const projects = detectProjects(testDir);
    expect(projects).toHaveLength(1);
    expect(projects[0].type).toBe('uniapp-miniprogram');
  });

  test('should detect Vue2 admin project', () => {
    const projectDir = path.join(testDir, 'admin');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      dependencies: { 'vue': '^2.0.0', 'element-ui': '^2.0.0' }
    }));

    const projects = detectProjects(testDir);
    expect(projects.some(p => p.type === 'vue2-admin')).toBe(true);
  });
});