const { updateCommand } = require('../../src/commands/update');
const fs = require('fs');
const path = require('path');

describe('updateCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/update-test');
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should detect changed files', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan'), JSON.stringify({
      timestamp: new Date().toISOString(),
      files: { 'src\\index.js': 'abc123' }
    }));
    
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'new content');
    
    const result = await updateCommand(testDir, { dryRun: true });
    expect(result.changedFiles.length).toBeGreaterThan(0);
  });

  test('should return empty array when no changes', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'content');
    const hash = require('crypto').createHash('md5').update('content').digest('hex');
    
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan'), JSON.stringify({
      timestamp: new Date().toISOString(),
      files: { 'src\\index.js': hash }
    }));
    
    const result = await updateCommand(testDir, { dryRun: true });
    expect(result.changedFiles.length).toBe(0);
  });

  test('should update scan state when not dryRun', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'content');
    
    await updateCommand(testDir, { dryRun: false });
    
    const lastScanPath = path.join(testDir, 'ai-docs/.last-scan');
    expect(fs.existsSync(lastScanPath)).toBe(true);
  });
});
