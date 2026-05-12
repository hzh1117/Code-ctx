const { scanProject } = require('../../src/scanner/file-scanner');
const fs = require('fs');
const path = require('path');

describe('scanProject', () => {
  const baseTestDir = path.join(__dirname, '../fixtures/scan-project');

  beforeEach(() => {
    fs.mkdirSync(path.join(baseTestDir, 'src/api'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'src/router/modules'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'src/store/modules'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'src/stores'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'src/components'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'src/pages'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'src/hooks'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'controller'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'routes'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'controllers'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'handler'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'service'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'model'), { recursive: true });
    fs.mkdirSync(path.join(baseTestDir, 'middleware'), { recursive: true });

    fs.writeFileSync(path.join(baseTestDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(baseTestDir, '.env.development'), 'API_URL=http://localhost');
    fs.writeFileSync(path.join(baseTestDir, 'src/api/user.js'), 'export default {}');
    fs.writeFileSync(path.join(baseTestDir, 'src/api/order.js'), 'export default {}');
    fs.writeFileSync(path.join(baseTestDir, 'src/router/index.js'), 'export default []');
    fs.writeFileSync(path.join(baseTestDir, 'src/router/modules/user.js'), 'export default {}');
    fs.writeFileSync(path.join(baseTestDir, 'src/store/modules/user.js'), 'export default {}');
    fs.writeFileSync(path.join(baseTestDir, 'src/stores/user.js'), 'export default {}');
    fs.writeFileSync(path.join(baseTestDir, 'src/components/Header.jsx'), 'export default () => {}');
    fs.writeFileSync(path.join(baseTestDir, 'src/components/Footer.tsx'), 'export default () => {}');
    fs.writeFileSync(path.join(baseTestDir, 'src/pages/Home.jsx'), 'export default () => {}');
    fs.writeFileSync(path.join(baseTestDir, 'src/hooks/useAuth.js'), 'export default () => {}');
    fs.writeFileSync(path.join(baseTestDir, 'src/App.jsx'), 'export default () => {}');
    fs.writeFileSync(path.join(baseTestDir, 'controller/UserController.java'), 'public class UserController {}');
    fs.writeFileSync(path.join(baseTestDir, 'routes/index.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(baseTestDir, 'controllers/auth.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(baseTestDir, 'app.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(baseTestDir, 'handler/user.go'), 'package handler');
    fs.writeFileSync(path.join(baseTestDir, 'service/user.go'), 'package service');
    fs.writeFileSync(path.join(baseTestDir, 'model/user.go'), 'package model');
    fs.writeFileSync(path.join(baseTestDir, 'middleware/auth.go'), 'package middleware');
    fs.writeFileSync(path.join(baseTestDir, 'main.go'), 'package main');
    fs.writeFileSync(path.join(baseTestDir, 'go.mod'), 'module example');
    fs.writeFileSync(path.join(baseTestDir, 'views.py'), 'def index(): pass');
    fs.writeFileSync(path.join(baseTestDir, 'models.py'), 'class User: pass');
    fs.writeFileSync(path.join(baseTestDir, 'requirements.txt'), 'flask==2.0.0');
  });

  afterEach(() => {
    fs.rmSync(baseTestDir, { recursive: true, force: true });
  });

  test('should scan Vue2 admin project files', () => {
    const result = scanProject(baseTestDir, 'vue2-admin');
    expect(result.tree).toBeDefined();
    expect(result.keyFiles).toBeDefined();
    expect(result.keyFiles.some(f => f.includes('api'))).toBe(true);
    expect(result.keyFiles.some(f => f.includes('.env.development'))).toBe(true);
  });

  test('should scan Vue3 admin project files', () => {
    const result = scanProject(baseTestDir, 'vue3-admin');
    expect(result.keyFiles.some(f => f.includes('api'))).toBe(true);
    expect(result.keyFiles.some(f => f.includes('.env.development'))).toBe(true);
    expect(result.keyFiles.some(f => f.includes('stores'))).toBe(true);
  });

  test('should scan React project files', () => {
    const result = scanProject(baseTestDir, 'react');
    expect(result.keyFiles.some(f => f.includes('Header.jsx'))).toBe(true);
    expect(result.keyFiles.some(f => f.includes('Footer.tsx'))).toBe(true);
    expect(result.keyFiles.some(f => f.includes('Home.jsx'))).toBe(true);
    expect(result.keyFiles.some(f => f.includes('App.jsx'))).toBe(true);
  });

  test('should scan Java backend project files', () => {
    const result = scanProject(baseTestDir, 'java-backend');
    expect(result.keyFiles.some(f => f.includes('UserController.java'))).toBe(true);
  });

  test('should scan Node backend project files', () => {
    const result = scanProject(baseTestDir, 'node-backend');
    expect(result.keyFiles.some(f => f.includes(path.join('routes', 'index.js')))).toBe(true);
    expect(result.keyFiles.some(f => f.includes(path.join('controllers', 'auth.js')))).toBe(true);
    expect(result.keyFiles.some(f => f.endsWith('app.js'))).toBe(true);
  });

  test('should scan Go backend project files', () => {
    const result = scanProject(baseTestDir, 'go-backend');
    expect(result.keyFiles.some(f => f.includes(path.join('handler', 'user.go')))).toBe(true);
    expect(result.keyFiles.some(f => f.includes(path.join('middleware', 'auth.go')))).toBe(true);
    expect(result.keyFiles.some(f => f.endsWith('main.go'))).toBe(true);
    expect(result.keyFiles.some(f => f.endsWith('go.mod'))).toBe(true);
  });

  test('should scan Python backend project files', () => {
    const result = scanProject(baseTestDir, 'python-backend');
    expect(result.keyFiles.some(f => f.endsWith('views.py'))).toBe(true);
    expect(result.keyFiles.some(f => f.endsWith('models.py'))).toBe(true);
    expect(result.keyFiles.some(f => f.endsWith('requirements.txt'))).toBe(true);
  });

  test('should return empty keyFiles for unknown project type', () => {
    const result = scanProject(baseTestDir, 'unknown-type');
    expect(result.keyFiles).toEqual([]);
    expect(result.tree).toBeDefined();
  });

  test('should not include duplicate files', () => {
    const result = scanProject(baseTestDir, 'vue2-admin');
    const uniqueFiles = [...new Set(result.keyFiles)];
    expect(result.keyFiles.length).toBe(uniqueFiles.length);
  });

  test('should return tree string', () => {
    const result = scanProject(baseTestDir, 'vue2-admin');
    expect(typeof result.tree).toBe('string');
    expect(result.tree.length).toBeGreaterThan(0);
  });
});
