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
    const relativePath = path.relative(testDir, path.join(testDir, 'src/index.js'));
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      files: { [relativePath]: 'abc123' }
    }));
    
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'new content');
    
    const result = await updateCommand(testDir, { dryRun: true });
    expect(result.changedFiles.length).toBeGreaterThan(0);
  });

  test('should return empty array when no changes', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    const filePath = path.join(testDir, 'src/index.js');
    fs.writeFileSync(filePath, 'content');
    const hash = require('crypto').createHash('md5').update('content').digest('hex');
    const relativePath = path.relative(testDir, filePath);
    
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      files: { [relativePath]: hash }
    }));
    
    const result = await updateCommand(testDir, { dryRun: true });
    expect(result.changedFiles.length).toBe(0);
  });

  test('should update scan state when not dryRun', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'content');
    
    await updateCommand(testDir, { dryRun: false });
    
    const lastScanPath = path.join(testDir, 'ai-docs/.last-scan.json');
    expect(fs.existsSync(lastScanPath)).toBe(true);
  });

  test('should handle first run when .last-scan does not exist', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'content');
    
    const result = await updateCommand(testDir, { dryRun: true });
    const relativePath = path.relative(testDir, path.join(testDir, 'src/index.js'));
    expect(result.changedFiles).toContain(relativePath);
  });

  test('should handle missing src directory', async () => {
    const result = await updateCommand(testDir, { dryRun: true });
    expect(result.changedFiles).toEqual([]);
  });

  test('should generate incremental prompt for changed files', async () => {
    const testDir = path.join(__dirname, '../fixtures/update-test');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src', 'app.js'), 'console.log("hello")');

    const result = await updateCommand(testDir);

    expect(result).toHaveProperty('changedFiles');
    expect(result).toHaveProperty('prompt');
    expect(Array.isArray(result.changedFiles)).toBe(true);

    fs.rmSync(testDir, { recursive: true, force: true });
  });
});
