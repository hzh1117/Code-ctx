const {
  VALID_SCENARIO_ID_PATTERN,
  deriveOverall,
  buildDocumentsList,
  getLatestMtime
} = require('../../src/web/api/helpers');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('VALID_SCENARIO_ID_PATTERN', () => {
  test('accepts single uppercase letters A-Z', () => {
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      expect(VALID_SCENARIO_ID_PATTERN.test(letter)).toBe(true);
    }
  });

  test('rejects lowercase letters', () => {
    expect(VALID_SCENARIO_ID_PATTERN.test('a')).toBe(false);
    expect(VALID_SCENARIO_ID_PATTERN.test('z')).toBe(false);
  });

  test('rejects multi-character strings', () => {
    expect(VALID_SCENARIO_ID_PATTERN.test('AB')).toBe(false);
    expect(VALID_SCENARIO_ID_PATTERN.test('I1')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(VALID_SCENARIO_ID_PATTERN.test('')).toBe(false);
  });

  test('rejects numbers and special chars', () => {
    expect(VALID_SCENARIO_ID_PATTERN.test('1')).toBe(false);
    expect(VALID_SCENARIO_ID_PATTERN.test('@')).toBe(false);
    expect(VALID_SCENARIO_ID_PATTERN.test(' ')).toBe(false);
  });

  test('accepts plugin scenarios beyond H (e.g. I, J, Z)', () => {
    // This was the original bug — [A-H] rejected plugin scenarios
    expect(VALID_SCENARIO_ID_PATTERN.test('I')).toBe(true);
    expect(VALID_SCENARIO_ID_PATTERN.test('J')).toBe(true);
    expect(VALID_SCENARIO_ID_PATTERN.test('Z')).toBe(true);
  });
});

describe('deriveOverall', () => {
  test('returns HIGH_RISK when report has issues', () => {
    expect(deriveOverall({ issues: ['x'] }, [], [])).toBe('HIGH_RISK');
  });

  test('returns HIGH_RISK when sensitive findings exist', () => {
    expect(deriveOverall({}, [], ['password'])).toBe('HIGH_RISK');
  });

  test('returns WARN when report has warnings', () => {
    expect(deriveOverall({ warnings: ['x'] }, [], [])).toBe('WARN');
  });

  test('returns WARN when schema errors exist', () => {
    expect(deriveOverall({}, ['schema-error'], [])).toBe('WARN');
  });

  test('returns OK when everything is clean', () => {
    expect(deriveOverall({}, [], [])).toBe('OK');
  });
});

describe('getLatestMtime', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codectx-helpers-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('returns 0 for empty directory', () => {
    expect(getLatestMtime(testDir)).toBe(0);
  });

  test('returns positive mtime for directory with files', () => {
    fs.writeFileSync(path.join(testDir, 'test.txt'), 'content');
    expect(getLatestMtime(testDir)).toBeGreaterThan(0);
  });

  test('returns 0 for non-existent directory', () => {
    expect(getLatestMtime('/nonexistent/path')).toBe(0);
  });
});
