const {
  updateCommand,
  executeUpdates,
  executeUpdateTransaction,
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
const { _clearCache } = require('../../src/utils/config');

describe('updateCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/update-test');
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'src', path: './src', type: 'generic-js-ts' }]
    }));
    fs.writeFileSync(path.join(testDir, 'ai-docs/project-manifest.json'), JSON.stringify({
      projects: [{ id: 'src', sourcePath: './src', document: 'src.md' }]
    }));
    _clearCache();
  });

  afterEach(() => {
    _clearCache();
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

  test('should record pending detection without advancing scan baseline', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'content');
    
    await updateCommand(testDir, { dryRun: false, prepareApply: true });
    
    const lastScanPath = path.join(testDir, 'ai-docs/.last-scan.json');
    const updateStatePath = path.join(testDir, 'ai-docs/.update-state.json');
    expect(fs.existsSync(lastScanPath)).toBe(false);
    expect(fs.existsSync(updateStatePath)).toBe(true);
  });

  test('dry-run does not create pending or committed scan state', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'content');

    await updateCommand(testDir, { dryRun: true });

    expect(fs.existsSync(path.join(testDir, 'ai-docs/.update-state.json'))).toBe(false);
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.last-scan.json'))).toBe(false);
  });

  test('business layer rejects dry-run combined with apply preparation', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'content');

    await expect(updateCommand(testDir, { dryRun: true, prepareApply: true }))
      .rejects.toThrow('dry-run 与 apply 不能同时使用');

    expect(generateWithAI).not.toHaveBeenCalled();
    expect(fs.readdirSync(path.join(testDir, 'ai-docs'))).toEqual(['project-manifest.json']);
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
    expect(Array.isArray(result.changedFiles)).toBe(true);
    expect(typeof result.prompt).toBe('string');
    expect(result.prompt.trim().length).toBeGreaterThan(0);
    expect(result.prompt).toContain('console.log("hello")');
    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: expect.stringMatching(/src[\\/]app\.js/),
        status: 'added',
        evidenceType: 'source'
      })
    ]));
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.last-scan.json'))).toBe(false);
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.update-state.json'))).toBe(false);

    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('hash mode respects configured excludeDirs and .gitignore', async () => {
    fs.writeFileSync(path.join(testDir, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'src', path: './src', type: 'generic-js-ts' }],
      excludeDirs: ['vendor-cache']
    }));
    fs.writeFileSync(path.join(testDir, '.gitignore'), 'src/generated/\n');
    fs.mkdirSync(path.join(testDir, 'src', 'generated'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'src', 'vendor-cache'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src', 'generated', 'ignored.js'), 'ignored');
    fs.writeFileSync(path.join(testDir, 'src', 'vendor-cache', 'ignored.js'), 'ignored');
    fs.writeFileSync(path.join(testDir, 'src', 'kept.js'), 'kept');
    _clearCache();

    const result = await updateCommand(testDir, { dryRun: true });
    const normalized = result.changedFiles.map(file => file.replace(/\\/g, '/'));

    expect(normalized).toContain('src/kept.js');
    expect(normalized).not.toContain('src/generated/ignored.js');
    expect(normalized).not.toContain('src/vendor-cache/ignored.js');
  });

  test('default mode returns one executable merged prompt without state commits', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/app.js'), 'export const feature = true;');
    fs.writeFileSync(path.join(testDir, 'ai-docs/src.md'), [
      '# src project',
      '<!-- section:overview -->',
      'old overview',
      '<!-- /section:overview -->',
      '<!-- section:modules -->',
      'old modules',
      '<!-- /section:modules -->'
    ].join('\n'));

    const result = await updateCommand(testDir);

    expect(typeof result.prompt).toBe('string');
    expect(result.prompt).toContain('## 文档: src.md');
    expect(result.prompt).not.toContain('<!-- section:overview -->');
    expect(result.prompt).toContain('<!-- section:modules -->');
    expect(result.prompt).toContain('export const feature = true;');
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.update-state.json'))).toBe(false);
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.last-scan.json'))).toBe(false);
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

  test('updates only deterministically affected sections for a route change', async () => {
    const sourcePath = path.join(testDir, 'src', 'routes', 'users.js');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    const oldSource = 'router.get("/users", listUsers);';
    fs.writeFileSync(sourcePath, oldSource);
    const relativePath = path.relative(testDir, sourcePath);
    const oldHash = require('crypto').createHash('md5').update(oldSource).digest('hex');
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan.json'), JSON.stringify({
      files: { [relativePath]: oldHash }
    }));
    fs.writeFileSync(path.join(testDir, 'ai-docs/src.md'), [
      '<!-- section:overview -->', 'overview', '<!-- /section:overview -->',
      '<!-- section:structure -->', 'structure', '<!-- /section:structure -->',
      '<!-- section:modules -->', 'modules', '<!-- /section:modules -->',
      '<!-- section:api -->', 'api', '<!-- /section:api -->',
      '<!-- section:data -->', 'data', '<!-- /section:data -->',
      '<!-- section:dependencies -->', 'dependencies', '<!-- /section:dependencies -->',
      '<!-- section:notes -->', 'notes', '<!-- /section:notes -->'
    ].join('\n'));
    fs.writeFileSync(sourcePath, 'router.post("/users", createUser);');

    const result = await updateCommand(testDir, { dryRun: true });
    const sections = result.sectionUpdates.map(update => update.sectionName).sort();

    expect(sections).toEqual(['api', 'modules']);
    expect(result.confirmationRequired).toEqual([]);
    expect(result.prompt).not.toContain('<!-- section:overview -->');
    expect(result.prompt).not.toContain('<!-- section:data -->');
  });

  test('unknown files require confirmation and prevent baseline commit', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src', 'domain.foo'), 'opaque domain format');
    fs.writeFileSync(path.join(testDir, 'ai-docs/src.md'), [
      '<!-- section:structure -->', 'old structure', '<!-- /section:structure -->',
      '<!-- section:modules -->', 'old modules', '<!-- /section:modules -->'
    ].join('\n'));
    generateWithAI.mockResolvedValueOnce('new structure');

    const detection = await updateCommand(testDir, { dryRun: false, prepareApply: true });

    expect(detection.sectionUpdates.map(update => update.sectionName)).toEqual(['structure']);
    expect(detection.confirmationRequired).toEqual([
      expect.objectContaining({ files: [expect.stringMatching(/domain\.foo/)] })
    ]);
    const execution = await executeUpdateTransaction(testDir, detection, { apiKey: 'test-key' });
    expect(execution.committed).toBe(false);
    expect(execution.confirmationRequired).toHaveLength(1);
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.last-scan.json'))).toBe(false);
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
        project: 'src',
        status: 'deleted',
        oldHash: 'old-hash',
        evidenceType: 'deletion'
      })
    ]));
    expect(result.sectionUpdates[0].prompt).toContain('status="deleted"');
    expect(result.sectionUpdates[0].prompt).toContain('project="src"');
    expect(result.sectionUpdates[0].prompt).toContain('File deleted from the current project.');
  });

  test('hash deletion is removed from committed baseline after docs succeed', async () => {
    const deletedPath = path.join('src', 'removed.js');
    fs.writeFileSync(path.join(testDir, 'ai-docs/.last-scan.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      files: { [deletedPath]: { mtimeMs: 1, hash: 'old-hash' } }
    }));
    fs.writeFileSync(path.join(testDir, 'ai-docs/src.md'), [
      '# src project',
      '<!-- section:modules -->',
      'removed.js module',
      '<!-- /section:modules -->'
    ].join('\n'));
    generateWithAI.mockResolvedValueOnce('module removed');

    const detection = await updateCommand(testDir, { dryRun: false, prepareApply: true });
    const execution = await executeUpdateTransaction(testDir, detection, { apiKey: 'test-key' });

    expect(execution.committed).toBe(true);
    const baseline = JSON.parse(fs.readFileSync(path.join(testDir, 'ai-docs/.last-scan.json'), 'utf8'));
    expect(baseline.files).not.toHaveProperty(deletedPath);
    const nextDetection = await updateCommand(testDir, { dryRun: true });
    expect(nextDetection.changedFiles).toEqual([]);
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

  test('hash mode persists new {mtimeMs, hash} format only after successful docs', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'content');
    fs.writeFileSync(path.join(testDir, 'ai-docs/src.md'), [
      '# src project',
      '<!-- section:modules -->',
      'old',
      '<!-- /section:modules -->'
    ].join('\n'));
    generateWithAI.mockResolvedValueOnce('new modules');

    const detection = await updateCommand(testDir, { dryRun: false, prepareApply: true });
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.last-scan.json'))).toBe(false);
    const transaction = await executeUpdateTransaction(testDir, detection, { apiKey: 'test-key' });
    expect(transaction.committed).toBe(true);

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

  test('partial failure preserves per-section retry state and commits after retry', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/app.js'), 'content');
    fs.writeFileSync(path.join(testDir, 'ai-docs/src.md'), [
      '# src project',
      '<!-- section:api -->',
      'old api',
      '<!-- /section:api -->',
      '<!-- section:modules -->',
      'old modules',
      '<!-- /section:modules -->'
    ].join('\n'));
    generateWithAI
      .mockResolvedValueOnce('new api')
      .mockRejectedValueOnce(new Error('temporary failure'));

    const firstDetection = await updateCommand(testDir, { dryRun: false, prepareApply: true });
    const firstExecution = await executeUpdateTransaction(testDir, firstDetection, { apiKey: 'test-key' });

    expect(firstExecution.committed).toBe(false);
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.last-scan.json'))).toBe(false);
    const pending = JSON.parse(fs.readFileSync(path.join(testDir, 'ai-docs/.update-state.json'), 'utf8'));
    expect(pending.sections['src.md#api'].status).toBe('success');
    expect(pending.sections['src.md#modules'].status).toBe('failed');

    generateWithAI.mockClear();
    generateWithAI.mockResolvedValueOnce('new modules');
    const retryDetection = await updateCommand(testDir, { dryRun: false, prepareApply: true });
    expect(retryDetection.sectionUpdates.find(update => update.sectionName === 'api').status).toBe('success');
    const retryExecution = await executeUpdateTransaction(testDir, retryDetection, { apiKey: 'test-key' });

    expect(generateWithAI).toHaveBeenCalledTimes(1);
    expect(retryExecution.committed).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.last-scan.json'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.update-state.json'))).toBe(false);
  });

  test('atomic write failure keeps the original doc and scan baseline pending', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/index.js'), 'content');
    const docPath = path.join(testDir, 'ai-docs/src.md');
    const original = [
      '# src project',
      '<!-- section:modules -->',
      'old modules',
      '<!-- /section:modules -->'
    ].join('\n');
    fs.writeFileSync(docPath, original);
    generateWithAI.mockResolvedValueOnce('new modules');

    const detection = await updateCommand(testDir, { dryRun: false, prepareApply: true });
    const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('rename failed');
    });
    let execution;
    try {
      execution = await executeUpdateTransaction(testDir, detection, { apiKey: 'test-key' });
    } finally {
      renameSpy.mockRestore();
    }

    expect(execution.committed).toBe(false);
    expect(execution.writeFailed).toBe(1);
    expect(fs.readFileSync(docPath, 'utf8')).toBe(original);
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.last-scan.json'))).toBe(false);
  });

  test('source changes during generation prevent baseline commit', async () => {
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    const sourcePath = path.join(testDir, 'src/index.js');
    fs.writeFileSync(sourcePath, 'version one');
    fs.writeFileSync(path.join(testDir, 'ai-docs/src.md'), [
      '# src project',
      '<!-- section:modules -->',
      'old modules',
      '<!-- /section:modules -->'
    ].join('\n'));
    generateWithAI.mockImplementationOnce(async () => {
      fs.writeFileSync(sourcePath, 'version two');
      return 'new modules';
    });

    const detection = await updateCommand(testDir, { dryRun: false, prepareApply: true });
    const execution = await executeUpdateTransaction(testDir, detection, { apiKey: 'test-key' });

    expect(execution.committed).toBe(false);
    expect(execution.reason).toContain('源码在文档生成期间发生变化');
    expect(fs.existsSync(path.join(testDir, 'ai-docs/.last-scan.json'))).toBe(false);
    const pending = JSON.parse(fs.readFileSync(path.join(testDir, 'ai-docs/.update-state.json'), 'utf8'));
    expect(pending.transactionError).toContain('扫描基线未提交');
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

  test('write failure overrides generated sections to failed', async () => {
    const docPath = path.join(testDir, 'ai-docs', 'web.md');
    const original = '# Web\n<!-- section:s -->\n旧\n<!-- /section:s -->';
    fs.writeFileSync(docPath, original);
    generateWithAI.mockResolvedValue('新');
    const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('rename failed');
    });

    let result;
    try {
      result = await executeUpdates(testDir, [
        { docName: 'web.md', sectionName: 's', prompt: 'update' }
      ], {});
    } finally {
      renameSpy.mockRestore();
    }

    expect(result).toEqual(expect.objectContaining({
      success: 0,
      failed: 1,
      writeFailed: 1,
      restoreFailed: 0
    }));
    expect(result.results[0]).toEqual(expect.objectContaining({
      sectionName: 's',
      status: 'failed',
      reason: expect.stringContaining('rename failed')
    }));
    expect(fs.readFileSync(docPath, 'utf8')).toBe(original);
  });

  test('restore failure is reflected in every affected section result', async () => {
    const docPath = path.join(testDir, 'ai-docs', 'web.md');
    fs.writeFileSync(docPath, [
      '<!-- section:a -->', '旧A', '<!-- /section:a -->',
      '<!-- section:b -->', '旧B', '<!-- /section:b -->'
    ].join('\n'));
    generateWithAI.mockResolvedValue('新');
    const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('rename failed');
    });
    const realCopy = fs.copyFileSync;
    let copyCount = 0;
    const copySpy = jest.spyOn(fs, 'copyFileSync').mockImplementation((source, destination) => {
      copyCount++;
      if (copyCount === 2) throw new Error('restore failed');
      return realCopy(source, destination);
    });

    let result;
    try {
      result = await executeUpdates(testDir, [
        { docName: 'web.md', sectionName: 'a', prompt: 'update a' },
        { docName: 'web.md', sectionName: 'b', prompt: 'update b' }
      ], {});
    } finally {
      copySpy.mockRestore();
      renameSpy.mockRestore();
    }

    expect(result.success).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.restoreFailed).toBe(1);
    expect(result.results).toHaveLength(2);
    for (const sectionResult of result.results) {
      expect(sectionResult.status).toBe('failed');
      expect(sectionResult.reason).toContain('备份恢复失败: restore failed');
    }
  });
});
