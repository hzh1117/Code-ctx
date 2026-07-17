const { bin, scripts } = require('../../package.json');

describe('package quality scripts', () => {
  test('published package exposes the code-ctx executable', () => {
    expect(bin).toEqual({ 'code-ctx': 'bin/cli.js' });
  });

  test('lint covers the CLI, backend, and Vue source files', () => {
    expect(scripts.lint).toBe('eslint src/ bin/ web/src/ --ext .js,.vue');
  });

  test('check runs every release quality gate', () => {
    expect(scripts.check.split(' && ')).toEqual([
      'npm run format:check',
      'npm run lint',
      'npm run typecheck',
      'npm test -- --runInBand',
      'npm run coverage',
      'npm run build:web',
      'npm run pack:smoke'
    ]);
  });
});
