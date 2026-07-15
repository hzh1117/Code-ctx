const {
  updateCommand,
  executeUpdates,
  applySectionUpdates,
  buildEvidenceChunks
} = require('../../src/commands/update');
// Mock at file level — safe because updateCommand tests use dryRun (skips AI) or only check prompt structure
jest.mock('../../src/ai/client', () => ({ generateWithAI: jest.fn() }));
const { generateWithAI } = require('../../src/ai/client');
// Force hash mode for deterministic updateCommand tests (avoids git repo dependency)
jest.mock('../../src/utils/git-utils', () => {
  const actual = jest.requireActual('../../src/utils/git-utils');
  return { ...actual, hasGitRepo: () => false };
});
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
    expect(result.detectionMethod).toBe('hash');
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
    const relativePath = path.relative(testDir, path.join(testDir, 'src/index.js')).replace(/\\/g, '/');
    expect(result.changedFiles.map(f => f.replace(/\\/g, '/'))).toContain(relativePath);
  });

  test('should handle missing src directory', async () => {
    const result = await updateCommand(testDir, { dryRun: true });
    expect(result.detectionMethod).toBe('hash');
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

  test('hash mode includes redacted current source in section prompts', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'src/app.js'),
      'const apiKey = "secret-value";\nrouter.get("/health", health);'
    );
    fs.writeFileSync(path.join(testDir, 'ai-docs', 'src.md'), [
      '# src project',
      '<!-- section:api -->',
      'old api docs',
      '<!-- /section:api -->'
    ].join('\n'));

    const result = await updateCommand(testDir, { dryRun: true });

    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.stringMatching(/src[\\/]app\.js/), status: 'added', evidenceType: 'source' })
    ]));
    expect(result.sectionUpdates[0].prompt).toContain('router.get("/health", health);');
    expect(result.sectionUpdates[0].prompt).toContain('[FILTERED]');
    expect(result.sectionUpdates[0].prompt).not.toContain('secret-value');
  });

  test('hash mode emits explicit deletion evidence', async () => {
    const deletedPath = path.join('src', 'removed.js');
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      files: { [deletedPath]: { mtimeMs: 1, hash: 'old-hash' } }
    }));
    fs.writeFileSync(path.join(testDir, 'ai-docs', 'src.md'), [
      '# src project',
      '<!-- section:modules -->',
      'removed.js module',
      '<!-- /section:modules -->'
    ].join('\n'));

    const result = await updateCommand(testDir, { dryRun: true });

    expect(result.changedFiles).toContain(deletedPath);
    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: deletedPath,
        status: 'deleted',
        oldHash: 'old-hash',
        evidenceType: 'deletion'
      })
    ]));
    expect(result.sectionUpdates[0].prompt).toContain('status="deleted"');
    expect(result.sectionUpdates[0].prompt).toContain('File deleted from the current project.');
  });

  test('hash mode accepts legacy string-hash last-scan format', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    const filePath = path.join(testDir, 'src/index.js');
    fs.writeFileSync(filePath, 'content');
    const hash = require('crypto').createHash('md5').update('content').digest('hex');
    const relativePath = path.relative(testDir, filePath);

    // Legacy format: value is the raw hash string, not { mtimeMs, hash }
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      files: { [relativePath]: hash }
    }));

    const result = await updateCommand(testDir, { dryRun: true });
    expect(result.changedFiles.length).toBe(0);
  });

  test('hash mode persists new {mtimeMs, hash} format on write', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'content');

    await updateCommand(testDir, { dryRun: false });

    const lastScan = JSON.parse(
      fs.readFileSync(path.join(testDir, 'ai-docs/.last-scan.json'), 'utf8')
    );
    const entries = Object.values(lastScan.files);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(typeof entry).toBe('object');
      expect(typeof entry.hash).toBe('string');
      expect(typeof entry.mtimeMs).toBe('number');
    }
  });

  test('hash mode skips hash recomputation when mtime unchanged', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    const filePath = path.join(testDir, 'src/index.js');
    fs.writeFileSync(filePath, 'real-content');

    // Plant a last-scan whose mtimeMs matches the file's current mtime
    // but whose hash is deliberately stale. With mtime preselection
    // active, the cached (stale) hash is reused, so the entry equals
    // itself and no change is reported. Without the optimization, the
    // real hash would be computed and differ → file reported as changed.
    const stat = fs.statSync(filePath);
    const rel = path.relative(testDir, filePath);
    const staleHash = require('crypto').createHash('md5').update('different').digest('hex');
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      files: { [rel]: { mtimeMs: stat.mtimeMs, hash: staleHash } }
    }));

    const result = await updateCommand(testDir, { dryRun: true });
    expect(result.changedFiles.length).toBe(0);
  });
});

describe('buildEvidenceChunks', () => {
  test('chunks evidence deterministically within total and chunk budgets', () => {
    const changes = [{
      path: 'src/large.js',
      status: 'modified',
      evidenceType: 'source',
      evidence: 'x'.repeat(200),
      truncation: { truncated: false }
    }, {
      path: 'src/first.js',
      status: 'added',
      evidenceType: 'source',
      evidence: 'first',
      truncation: { truncated: false }
    }];

    const first = buildEvidenceChunks(changes, { maxTotalChars: 90, maxChunkChars: 32 });
    const second = buildEvidenceChunks(changes.slice().reverse(), { maxTotalChars: 90, maxChunkChars: 32 });

    expect(first).toEqual(second);
    expect(first.truncated).toBe(true);
    expect(first.includedChars).toBe(90);
    expect(first.chunks.length).toBe(3);
    expect(first.chunks.every(chunk => chunk.length <= 32)).toBe(true);
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
