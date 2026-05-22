const { scanProject } = require('../../src/scanner/file-scanner');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('scanProject', () => {
  function createTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'scan-test-'));
  }

  function setupBaseFixtures(dir) {
    fs.mkdirSync(path.join(dir, 'src/api'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src/router/modules'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src/store/modules'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src/stores'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src/components'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src/pages'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src/hooks'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'controller'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'routes'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'controllers'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'handler'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'service'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'model'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'middleware'), { recursive: true });

    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    fs.writeFileSync(path.join(dir, '.env.development'), 'API_URL=http://localhost');
    fs.writeFileSync(path.join(dir, 'src/api/user.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'src/api/order.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'src/router/index.js'), 'export default []');
    fs.writeFileSync(path.join(dir, 'src/router/modules/user.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'src/store/modules/user.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'src/stores/user.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'src/components/Header.jsx'), 'export default () => {}');
    fs.writeFileSync(path.join(dir, 'src/components/Footer.tsx'), 'export default () => {}');
    fs.writeFileSync(path.join(dir, 'src/pages/Home.jsx'), 'export default () => {}');
    fs.writeFileSync(path.join(dir, 'src/hooks/useAuth.js'), 'export default () => {}');
    fs.writeFileSync(path.join(dir, 'src/App.jsx'), 'export default () => {}');
    fs.writeFileSync(path.join(dir, 'controller/UserController.java'), 'public class UserController {}');
    fs.writeFileSync(path.join(dir, 'routes/index.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(dir, 'controllers/auth.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(dir, 'app.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(dir, 'handler/user.go'), 'package handler');
    fs.writeFileSync(path.join(dir, 'service/user.go'), 'package service');
    fs.writeFileSync(path.join(dir, 'model/user.go'), 'package model');
    fs.writeFileSync(path.join(dir, 'middleware/auth.go'), 'package middleware');
    fs.writeFileSync(path.join(dir, 'main.go'), 'package main');
    fs.writeFileSync(path.join(dir, 'go.mod'), 'module example');
    fs.writeFileSync(path.join(dir, 'views.py'), 'def index(): pass');
    fs.writeFileSync(path.join(dir, 'models.py'), 'class User: pass');
    fs.writeFileSync(path.join(dir, 'requirements.txt'), 'flask==2.0.0');
  }

  function setupUniappFixtures(dir) {
    fs.mkdirSync(path.join(dir, 'api'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'utils'), { recursive: true });

    fs.writeFileSync(path.join(dir, 'pages.json'), '{}');
    fs.writeFileSync(path.join(dir, 'api/user.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'api/order.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'config/app.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'utils/request.js'), 'export default {}');
  }

  test('should scan Vue2 admin project files', () => {
    const dir = createTmpDir();
    setupBaseFixtures(dir);
    try {
      const result = scanProject(dir, 'vue2-admin');
      expect(result.tree).toBeDefined();
      expect(result.keyFiles).toBeDefined();
      expect(result.keyFiles.some(f => f.includes('api'))).toBe(true);
      expect(result.keyFiles.some(f => f.includes('.env.development'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('should scan Vue3 admin project files', () => {
    const dir = createTmpDir();
    setupBaseFixtures(dir);
    try {
      const result = scanProject(dir, 'vue3-admin');
      expect(result.keyFiles.some(f => f.includes('api'))).toBe(true);
      expect(result.keyFiles.some(f => f.includes('.env.development'))).toBe(true);
      expect(result.keyFiles.some(f => f.includes('stores'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('should scan React project files', () => {
    const dir = createTmpDir();
    setupBaseFixtures(dir);
    try {
      const result = scanProject(dir, 'react');
      expect(result.keyFiles.some(f => f.includes('Header.jsx'))).toBe(true);
      expect(result.keyFiles.some(f => f.includes('Footer.tsx'))).toBe(true);
      expect(result.keyFiles.some(f => f.includes('Home.jsx'))).toBe(true);
      expect(result.keyFiles.some(f => f.includes('App.jsx'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('should scan uniapp-miniprogram project files', () => {
    const dir = createTmpDir();
    setupUniappFixtures(dir);
    try {
      const result = scanProject(dir, 'uniapp-miniprogram');
      expect(result.keyFiles.some(f => f.endsWith('pages.json'))).toBe(true);
      expect(result.keyFiles.some(f => f.includes(path.join('api', 'user.js')))).toBe(true);
      expect(result.keyFiles.some(f => f.includes(path.join('api', 'order.js')))).toBe(true);
      expect(result.keyFiles.some(f => f.endsWith(path.join('config', 'app.js')))).toBe(true);
      expect(result.keyFiles.some(f => f.endsWith(path.join('utils', 'request.js')))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('should scan Java backend project files', () => {
    const dir = createTmpDir();
    setupBaseFixtures(dir);
    try {
      const result = scanProject(dir, 'java-backend');
      expect(result.keyFiles.some(f => f.includes('UserController.java'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('should scan Node backend project files', () => {
    const dir = createTmpDir();
    setupBaseFixtures(dir);
    try {
      const result = scanProject(dir, 'node-backend');
      expect(result.keyFiles.some(f => f.includes(path.join('routes', 'index.js')))).toBe(true);
      expect(result.keyFiles.some(f => f.includes(path.join('controllers', 'auth.js')))).toBe(true);
      expect(result.keyFiles.some(f => f.endsWith('app.js'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('should scan Go backend project files', () => {
    const dir = createTmpDir();
    setupBaseFixtures(dir);
    try {
      const result = scanProject(dir, 'go-backend');
      expect(result.keyFiles.some(f => f.includes(path.join('handler', 'user.go')))).toBe(true);
      expect(result.keyFiles.some(f => f.includes(path.join('middleware', 'auth.go')))).toBe(true);
      expect(result.keyFiles.some(f => f.endsWith('main.go'))).toBe(true);
      expect(result.keyFiles.some(f => f.endsWith('go.mod'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('should scan Python backend project files', () => {
    const dir = createTmpDir();
    setupBaseFixtures(dir);
    try {
      const result = scanProject(dir, 'python-backend');
      expect(result.keyFiles.some(f => f.endsWith('views.py'))).toBe(true);
      expect(result.keyFiles.some(f => f.endsWith('models.py'))).toBe(true);
      expect(result.keyFiles.some(f => f.endsWith('requirements.txt'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('should return empty keyFiles for unknown project type', () => {
    const dir = createTmpDir();
    setupBaseFixtures(dir);
    try {
      const result = scanProject(dir, 'unknown-type');
      expect(result.keyFiles).toEqual([]);
      expect(result.tree).toBeDefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('should not include duplicate files', () => {
    const dir = createTmpDir();
    setupBaseFixtures(dir);
    try {
      const result = scanProject(dir, 'vue2-admin');
      const uniqueFiles = [...new Set(result.keyFiles)];
      expect(result.keyFiles.length).toBe(uniqueFiles.length);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('should return tree string', () => {
    const dir = createTmpDir();
    setupBaseFixtures(dir);
    try {
      const result = scanProject(dir, 'vue2-admin');
      expect(typeof result.tree).toBe('string');
      expect(result.tree.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('adapter priorityKeywords', () => {
  const { defaultRegistry } = require('../../src/adapters');

  test('Java adapter prioritizes controller > service > entity', () => {
    expect(defaultRegistry.getFilePriority('java-backend', '/proj/src/controller/UserController.java'))
      .toBeLessThan(defaultRegistry.getFilePriority('java-backend', '/proj/src/service/UserService.java'));
    expect(defaultRegistry.getFilePriority('java-backend', '/proj/src/service/UserService.java'))
      .toBeLessThan(defaultRegistry.getFilePriority('java-backend', '/proj/src/entity/User.java'));
  });

  test('Java adapter prioritizes application.yml above everything else', () => {
    const yml = defaultRegistry.getFilePriority('java-backend', '/proj/src/main/resources/application.yml');
    const ctrl = defaultRegistry.getFilePriority('java-backend', '/proj/src/controller/Foo.java');
    expect(yml).toBeLessThan(ctrl);
  });

  test('Java priority keywords do not bleed into Go projects', () => {
    // Path contains "controller" but project is Go — Java's "controller" rank
    // (priority 3) must not apply. Go has no "controller" keyword, so this
    // file ranks at the default 100.
    expect(defaultRegistry.getFilePriority('go-backend', '/proj/controller/foo.go')).toBe(100);
  });

  test('Go adapter prioritizes handler over service', () => {
    expect(defaultRegistry.getFilePriority('go-backend', '/proj/handler/user.go'))
      .toBeLessThan(defaultRegistry.getFilePriority('go-backend', '/proj/service/user.go'));
  });

  test('Python adapter prioritizes urls.py over views.py', () => {
    expect(defaultRegistry.getFilePriority('python-backend', '/proj/app/urls.py'))
      .toBeLessThan(defaultRegistry.getFilePriority('python-backend', '/proj/app/views.py'));
  });

  test('Node backend adapter prioritizes app.js over routes', () => {
    expect(defaultRegistry.getFilePriority('node-backend', '/proj/app.js'))
      .toBeLessThan(defaultRegistry.getFilePriority('node-backend', '/proj/routes/index.js'));
  });

  test('React adapter prioritizes App.jsx over components', () => {
    expect(defaultRegistry.getFilePriority('react', '/proj/src/app.jsx'))
      .toBeLessThan(defaultRegistry.getFilePriority('react', '/proj/src/components/Button.jsx'));
  });

  test('Vue3 admin adapter prioritizes main.js over api', () => {
    expect(defaultRegistry.getFilePriority('vue3-admin', '/proj/src/main.js'))
      .toBeLessThan(defaultRegistry.getFilePriority('vue3-admin', '/proj/src/api/user.js'));
  });

  test('Unknown project type returns default priority 100', () => {
    expect(defaultRegistry.getFilePriority('unknown-type', '/any/file/path.js')).toBe(100);
  });
});
