const fs = require('fs');
const path = require('path');

describe('CI workflow contract', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/ci.yml'), 'utf8');

  test('tests only supported Node.js release lines', () => {
    expect(workflow).toContain('node-version: [20.x, 22.x]');
    expect(workflow).not.toContain('node-version: [18.x');
  });

  test('runs release gates on Ubuntu and package smoke tests on Windows', () => {
    expect(workflow).toContain('run: npm run format:check');
    expect(workflow).toContain('run: npm run typecheck');
    expect(workflow).toContain('runs-on: windows-latest');
    expect(workflow.match(/run: npm run pack:smoke/g)).toHaveLength(2);
    expect(workflow).toContain('tests/utils/clipboard.test.js');
  });
});
