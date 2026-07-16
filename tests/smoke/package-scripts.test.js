const { scripts } = require('../../package.json');

describe('package quality scripts', () => {
  test('check runs lint before tests and the web build', () => {
    expect(scripts.check).toBe('npm run lint && npm test -- --runInBand && npm run build:web');
  });
});
