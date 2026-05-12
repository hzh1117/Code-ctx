const { scanProject } = require('../../src/scanner/file-scanner');
const fs = require('fs');
const path = require('path');

describe('scanProject', () => {
  const testDir = path.join(__dirname, '../fixtures/scan-project');

  beforeAll(() => {
    fs.mkdirSync(path.join(testDir, 'src/api'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'src/router'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(testDir, 'src/api/user.js'), 'export default {}');
    fs.writeFileSync(path.join(testDir, 'src/router/index.js'), 'export default []');
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should scan Vue2 admin project files', () => {
    const result = scanProject(testDir, 'vue2-admin');
    expect(result.tree).toBeDefined();
    expect(result.keyFiles).toBeDefined();
    expect(result.keyFiles.some(f => f.includes('api'))).toBe(true);
  });
});
