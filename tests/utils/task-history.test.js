const fs = require('fs');
const path = require('path');
const {
  addTask,
  getHistory,
  getRecentHistory,
  diffPrompts,
  findEntryById,
  summarizeEntryDiff,
  _internals
} = require('../../src/utils/task-history');
const { _clearCache } = require('../../src/utils/config');

describe('task-history', () => {
  const testDir = path.join(__dirname, '../fixtures/history-test');
  const historyPath = path.join(testDir, 'ai-docs', '.task-history.jsonl');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    _clearCache();
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    _clearCache();
  });

  test('addTask writes a JSONL entry with id and timestamp', () => {
    addTask(testDir, {
      task: '新增用户登录',
      scenario: 'A',
      projects: ['web', 'api']
    });

    expect(fs.existsSync(historyPath)).toBe(true);
    const lines = fs.readFileSync(historyPath, 'utf8').trim().split('\n');
    const entry = JSON.parse(lines[0]);
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('timestamp');
    expect(entry.task).toBe('新增用户登录');
    expect(entry.scenario).toBe('A');
  });

  test('getHistory returns all entries', () => {
    addTask(testDir, { task: '任务1', scenario: 'A' });
    addTask(testDir, { task: '任务2', scenario: 'B' });
    const history = getHistory(testDir);
    expect(history.length).toBe(2);
  });

  test('addTask hashes prompt and stores only a length-capped preview', () => {
    const fullPrompt = '行A\n行B\n' + 'X'.repeat(1000);
    const entry = addTask(testDir, { task: 't', prompt: fullPrompt });
    expect(entry.promptHash).toHaveLength(16);
    expect(entry.promptLength).toBe(fullPrompt.length);
    expect(entry.promptPreview.length).toBeLessThanOrEqual(_internals.PREVIEW_CHARS + 3);
    // The tail of the prompt should not be present in the JSONL.
    const raw = fs.readFileSync(historyPath, 'utf8');
    expect(raw).not.toContain('X'.repeat(500));
  });

  test('addTask preview applies sensitive filter so detected fields do not land on disk', () => {
    const prompt = 'before\napi_key = "abcdef1234567890abcdef"\nafter';
    addTask(testDir, { task: 't', prompt });
    const raw = fs.readFileSync(historyPath, 'utf8');
    expect(raw).not.toContain('abcdef1234567890abcdef');
    expect(raw).toContain('[FILTERED]');
  });

  test('addTask drops unknown fields (whitelist)', () => {
    addTask(testDir, {
      task: 't',
      maliciousField: 'evil',
      __proto__: { polluted: true }
    });
    const [entry] = getHistory(testDir);
    expect(entry.maliciousField).toBeUndefined();
    expect(entry.polluted).toBeUndefined();
  });

  test('rotation caps history at MAX_ENTRIES', () => {
    const target = _internals.MAX_ENTRIES + 25;
    for (let i = 0; i < target; i++) {
      addTask(testDir, { task: `t${i}`, scenario: 'A' });
    }
    const history = getHistory(testDir);
    expect(history.length).toBeLessThanOrEqual(_internals.MAX_ENTRIES);
    // The latest entry must survive rotation.
    expect(history[history.length - 1].task).toBe(`t${target - 1}`);
  });

  test('rotation caps file size when prompts are large', () => {
    const big = 'L\n'.repeat(2000);
    for (let i = 0; i < 50; i++) {
      addTask(testDir, { task: `t${i}`, prompt: big });
    }
    const size = fs.statSync(historyPath).size;
    expect(size).toBeLessThanOrEqual(_internals.MAX_FILE_BYTES);
    const history = getHistory(testDir);
    expect(history.length).toBeGreaterThan(0);
  });

  test('getRecentHistory returns newest first', () => {
    addTask(testDir, { task: 'first' });
    addTask(testDir, { task: 'second' });
    addTask(testDir, { task: 'third' });
    const recent = getRecentHistory(testDir, 2);
    expect(recent.map(e => e.task)).toEqual(['third', 'second']);
  });

  test('findEntryById finds a recorded entry', () => {
    const entry = addTask(testDir, { task: 'lookup-me' });
    const found = findEntryById(testDir, entry.id);
    expect(found.task).toBe('lookup-me');
  });

  test('summarizeEntryDiff reports scenario and length deltas', () => {
    const a = addTask(testDir, { task: 'a', scenario: 'A', prompt: 'short' });
    const b = addTask(testDir, { task: 'b', scenario: 'B', prompt: 'longer prompt body' });
    const diff = summarizeEntryDiff(a, b);
    expect(diff.scenarioChanged).toBe(true);
    expect(diff.promptHashChanged).toBe(true);
    expect(diff.lengthDelta).toBe(b.promptLength - a.promptLength);
  });

  test('diffPrompts summarizes added and removed lines', () => {
    const a = 'L1\nL2\nL3';
    const b = 'L1\nL2x\nL3\nL4';
    const result = diffPrompts(a, b);
    expect(result.addedCount).toBeGreaterThanOrEqual(1);
    expect(result.removedCount).toBeGreaterThanOrEqual(1);
    expect(result.aLength).toBe(a.length);
    expect(result.bLength).toBe(b.length);
  });
});
