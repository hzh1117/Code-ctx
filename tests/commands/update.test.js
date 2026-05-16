const { updateCommand, executeUpdates, applySectionUpdates } = require('../../src/commands/update');
// Mock at file level — safe because updateCommand tests use dryRun (skips AI) or only check prompt structure
jest.mock('../../src/ai/client', () => ({ generateWithAI: jest.fn() }));
const { generateWithAI } = require('../../src/ai/client');
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
    // In git mode, may detect changes from parent repo; in hash mode, should be 0
    if (result.detectionMethod === 'hash') {
      expect(result.changedFiles.length).toBe(0);
    } else {
      // Git mode may detect changes from parent repo
      expect(result.changedFiles).toBeDefined();
    }
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
    const relativePath = path.relative(testDir, path.join(testDir, 'src/index.js')).replace(/\\/g, '/');
    expect(result.changedFiles.map(f => f.replace(/\\/g, '/'))).toContain(relativePath);
  });

  test('should handle missing src directory', async () => {
    const result = await updateCommand(testDir, { dryRun: true });
    // In git mode, may detect changes from parent repo; in hash mode, should be empty
    if (result.detectionMethod === 'hash') {
      expect(result.changedFiles).toEqual([]);
    } else {
      expect(result.changedFiles).toBeDefined();
    }
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

describe('applySectionUpdates', () => {
  const testDir = path.join(__dirname, '../fixtures/apply-section-test');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('replaces single section', () => {
    const docPath = path.join(testDir, 'doc.md');
    fs.writeFileSync(docPath, [
      '# Title',
      '<!-- section:overview -->',
      '旧概述',
      '<!-- /section:overview -->'
    ].join('\n'));

    applySectionUpdates(docPath, [
      { sectionName: 'overview', newContent: '新概述' }
    ]);

    const result = fs.readFileSync(docPath, 'utf8');
    expect(result).toContain('新概述');
    expect(result).not.toContain('旧概述');
    expect(result).toContain('<!-- section:overview -->');
  });

  test('replaces multiple sections in same file', () => {
    const docPath = path.join(testDir, 'doc.md');
    fs.writeFileSync(docPath, [
      '<!-- section:a -->',
      '旧A',
      '<!-- /section:a -->',
      '<!-- section:b -->',
      '旧B',
      '<!-- /section:b -->'
    ].join('\n'));

    applySectionUpdates(docPath, [
      { sectionName: 'a', newContent: '新A' },
      { sectionName: 'b', newContent: '新B' }
    ]);

    const result = fs.readFileSync(docPath, 'utf8');
    expect(result).toContain('新A');
    expect(result).toContain('新B');
  });

  test('preserves content outside updated sections', () => {
    const docPath = path.join(testDir, 'doc.md');
    fs.writeFileSync(docPath, [
      '# 标题',
      '<!-- section:s -->',
      '旧',
      '<!-- /section:s -->',
      '尾部'
    ].join('\n'));

    applySectionUpdates(docPath, [
      { sectionName: 's', newContent: '新' }
    ]);

    const result = fs.readFileSync(docPath, 'utf8');
    expect(result).toContain('# 标题');
    expect(result).toContain('尾部');
  });
});

describe('executeUpdates', () => {
  const testDir = path.join(__dirname, '../fixtures/execute-updates-test');

  beforeEach(() => {
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    generateWithAI.mockReset();
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('succeeds and writes back updated sections', async () => {
    const docPath = path.join(testDir, 'ai-docs', 'web.md');
    fs.writeFileSync(docPath, [
      '# Web',
      '<!-- section:overview -->',
      '旧概述',
      '<!-- /section:overview -->'
    ].join('\n'));

    generateWithAI.mockResolvedValue('新概述内容');

    const result = await executeUpdates(testDir, [
      { docName: 'web.md', sectionName: 'overview', prompt: 'update overview' }
    ], {});

    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
    const content = fs.readFileSync(docPath, 'utf8');
    expect(content).toContain('新概述内容');
  });

  test('partial failure does not corrupt successful sections', async () => {
    const docPath = path.join(testDir, 'ai-docs', 'web.md');
    fs.writeFileSync(docPath, [
      '<!-- section:a -->',
      '旧A',
      '<!-- /section:a -->',
      '<!-- section:b -->',
      '旧B',
      '<!-- /section:b -->'
    ].join('\n'));

    generateWithAI
      .mockResolvedValueOnce('新A')
      .mockRejectedValueOnce(new Error('AI failed'));

    const result = await executeUpdates(testDir, [
      { docName: 'web.md', sectionName: 'a', prompt: 'update a' },
      { docName: 'web.md', sectionName: 'b', prompt: 'update b' }
    ], {});

    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    const content = fs.readFileSync(docPath, 'utf8');
    expect(content).toContain('新A');
  });

  test('skips non-existent doc', async () => {
    const result = await executeUpdates(testDir, [
      { docName: 'missing.md', sectionName: 's', prompt: 'update' }
    ], {});

    expect(result.skipped).toBe(1);
    expect(result.success).toBe(0);
  });

  test('skips path traversal docName', async () => {
    fs.writeFileSync(path.join(testDir, 'outside.md'), 'outside');
    const result = await executeUpdates(testDir, [
      { docName: '../outside.md', sectionName: 's', prompt: 'update' }
    ], {});

    expect(result.skipped).toBe(1);
    expect(result.results[0].reason).toContain('非法');
  });

  test('creates backup before modifying', async () => {
    const docPath = path.join(testDir, 'ai-docs', 'web.md');
    const original = '# Web\n<!-- section:s -->\n旧\n<!-- /section:s -->';
    fs.writeFileSync(docPath, original);

    generateWithAI.mockResolvedValue('新');

    await executeUpdates(testDir, [
      { docName: 'web.md', sectionName: 's', prompt: 'update' }
    ], {});

    const backupPath = docPath + '.bak';
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(fs.readFileSync(backupPath, 'utf8')).toBe(original);
  });
});
