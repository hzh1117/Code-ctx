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

  test('should detect Vue3 admin project', () => {
    const projectDir = path.join(testDir, 'vue3-admin');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      dependencies: { 'vue': '^3.0.0', 'element-plus': '^2.0.0' }
    }));

    const projects = detectProjects(testDir);
    expect(projects.some(p => p.type === 'vue3-admin')).toBe(true);
  });

  test('should detect React project', () => {
    const projectDir = path.join(testDir, 'react-app');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      dependencies: { 'react': '^18.0.0', 'react-dom': '^18.0.0' }
    }));

    const projects = detectProjects(testDir);
    expect(projects.some(p => p.type === 'react')).toBe(true);
  });

  test('should detect Java backend (pom.xml)', () => {
    const projectDir = path.join(testDir, 'java-spring');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'pom.xml'), '<project></project>');

    const projects = detectProjects(testDir);
    expect(projects.some(p => p.type === 'java-backend')).toBe(true);
  });

  test('should detect Node backend (express)', () => {
    const projectDir = path.join(testDir, 'node-api');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      dependencies: { 'express': '^4.18.0' }
    }));

    const projects = detectProjects(testDir);
    expect(projects.some(p => p.type === 'node-backend')).toBe(true);
  });

  test('should detect Go backend', () => {
    const projectDir = path.join(testDir, 'go-service');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'go.mod'), 'module go-service');

    const projects = detectProjects(testDir);
    expect(projects.some(p => p.type === 'go-backend')).toBe(true);
  });

  test('should detect Python backend', () => {
    const projectDir = path.join(testDir, 'python-api');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'requirements.txt'), 'flask==2.0.0');

    const projects = detectProjects(testDir);
    expect(projects.some(p => p.type === 'python-backend')).toBe(true);
  });

  test('should not detect multiple types for same directory', () => {
    const projectDir = path.join(testDir, 'multi-check');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      dependencies: { 'vue': '^3.0.0', 'element-plus': '^2.0.0' }
    }));
    fs.writeFileSync(path.join(projectDir, 'manifest.json'), JSON.stringify({}));

    const projects = detectProjects(testDir);
    const matched = projects.filter(p => p.name === 'multi-check');
    expect(matched).toHaveLength(1);
  });
});
