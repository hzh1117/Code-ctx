const { detectProjects } = require('../../src/scanner/project-detector');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

describe('detectProjects — monorepo deep scan', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codectx-mono-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('detects projects in packages/ subdirectory (monorepo layout)', () => {
    // Simulate: packages/app-web/package.json with vue
    const pkgDir = path.join(testDir, 'packages', 'app-web');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
      dependencies: { 'vue': '^3.0.0', 'element-plus': '^2.0.0' }
    }));

    const projects = detectProjects(testDir);
    expect(projects.length).toBeGreaterThanOrEqual(1);
    expect(projects.some(p => p.type === 'vue3-admin')).toBe(true);
  });

  test('detects projects in apps/ subdirectory', () => {
    const appDir = path.join(testDir, 'apps', 'web');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({
      dependencies: { 'react': '^18.0.0' }
    }));

    const projects = detectProjects(testDir);
    expect(projects.some(p => p.type === 'react')).toBe(true);
  });

  test('generates hierarchical alias for nested projects', () => {
    const pkgDir = path.join(testDir, 'packages', 'my-app');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
      dependencies: { 'react': '^18.0.0' }
    }));

    const projects = detectProjects(testDir);
    const found = projects.find(p => p.type === 'react');
    expect(found).toBeDefined();
    // Alias should include the parent path segment
    expect(found.alias).toContain('my-app');
  });

  test('skips node_modules in nested directories', () => {
    const nmDir = path.join(testDir, 'packages', 'app', 'node_modules', 'fake-pkg');
    fs.mkdirSync(nmDir, { recursive: true });
    fs.writeFileSync(path.join(nmDir, 'package.json'), JSON.stringify({
      dependencies: { 'react': '^18.0.0' }
    }));

    const projects = detectProjects(testDir);
    // node_modules should be skipped
    expect(projects.every(p => !p.path.includes('node_modules'))).toBe(true);
  });

  test('respects maxDepth option', () => {
    // Create a deeply nested project: a/b/c/d/app
    const deepDir = path.join(testDir, 'a', 'b', 'c', 'd', 'app');
    fs.mkdirSync(deepDir, { recursive: true });
    fs.writeFileSync(path.join(deepDir, 'package.json'), JSON.stringify({
      dependencies: { 'react': '^18.0.0' }
    }));

    // With default depth (3), this should NOT be found (depth 4)
    const projectsDefault = detectProjects(testDir);
    expect(projectsDefault.some(p => p.path.includes(path.join('d', 'app')))).toBe(false);

    // With increased depth, it should be found
    const projectsDeep = detectProjects(testDir, { maxDepth: 5 });
    expect(projectsDeep.some(p => p.path.includes(path.join('d', 'app')))).toBe(true);
  });

  test('deduplicates aliases when names conflict', () => {
    // Two directories with the same leaf name
    const dir1 = path.join(testDir, 'packages', 'app');
    const dir2 = path.join(testDir, 'apps', 'app');
    fs.mkdirSync(dir1, { recursive: true });
    fs.mkdirSync(dir2, { recursive: true });
    fs.writeFileSync(path.join(dir1, 'package.json'), JSON.stringify({
      dependencies: { 'vue': '^3.0.0', 'element-plus': '^2.0.0' }
    }));
    fs.writeFileSync(path.join(dir2, 'package.json'), JSON.stringify({
      dependencies: { 'react': '^18.0.0' }
    }));

    const projects = detectProjects(testDir);
    const aliases = projects.map(p => p.alias);
    // All aliases should be unique
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  test('detects the repository root and monorepo children together', () => {
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
      dependencies: { express: '^5.0.0' }
    }));
    const childDir = path.join(testDir, 'packages', 'web');
    fs.mkdirSync(childDir, { recursive: true });
    fs.writeFileSync(path.join(childDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' }
    }));

    const projects = detectProjects(testDir);

    expect(projects).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: path.resolve(testDir), type: 'node-backend' }),
      expect.objectContaining({ path: path.resolve(childDir), type: 'react' })
    ]));
  });

  test('falls back to a scannable unknown root instead of returning no projects', () => {
    fs.writeFileSync(path.join(testDir, 'main.xyz'), 'custom source');

    const projects = detectProjects(testDir);

    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual(expect.objectContaining({
      alias: expect.any(String),
      path: path.resolve(testDir),
      type: 'unknown'
    }));
  });
});
