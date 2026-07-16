const { scripts } = require('../../package.json');

describe('package quality scripts', () => {
  test('lint covers the CLI, backend, and Vue source files', () => {
    expect(scripts.lint).toBe('eslint src/ bin/ web/src/ --ext .js,.vue');
  });

  test('check runs lint before tests and the web build', () => {
    expect(scripts.check).toBe('npm run lint && npm test -- --runInBand && npm run build:web');
  });
});
