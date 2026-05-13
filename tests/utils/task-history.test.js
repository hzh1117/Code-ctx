const { addTask, getHistory } = require('../../src/utils/task-history');
const fs = require('fs');
const path = require('path');

describe('task-history', () => {
  const testDir = path.join(__dirname, '../fixtures/history-test');
  const historyPath = path.join(testDir, 'ai-docs', '.task-history.jsonl');
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should add task to history', () => {
    addTask(testDir, {
      task: '新增用户登录',
      scenario: 'A',
      projects: ['web', 'api']
    });
    
    expect(fs.existsSync(historyPath)).toBe(true);
    const content = fs.readFileSync(historyPath, 'utf8');
    expect(content).toContain('新增用户登录');
  });

  test('should read history', () => {
    addTask(testDir, { task: '任务1', scenario: 'A' });
    addTask(testDir, { task: '任务2', scenario: 'B' });
    
    const history = getHistory(testDir);
    expect(history.length).toBe(2);
  });
});
