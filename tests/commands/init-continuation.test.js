const fs = require('fs');
const path = require('path');

jest.mock('../../src/ai/client', () => ({
  generateWithContinuation: jest.fn()
}));

const { generateWithContinuation } = require('../../src/ai/client');
const { initCommand } = require('../../src/commands/init');

describe('initCommand AI continuation', () => {
  const testDir = path.join(__dirname, '../fixtures/init-continuation-test');

  beforeEach(() => {
    generateWithContinuation.mockReset();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, 'my-app'), { recursive: true });
    fs.writeFileSync(path.join(testDir, '.env'), 'OPENAI_API_KEY=test-key\n');
    fs.writeFileSync(path.join(testDir, 'my-app/package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' }
    }));
    fs.writeFileSync(path.join(testDir, 'my-app/App.jsx'), 'export default function App() { return null; }');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('concurrency does not exceed 2 for BATCH_MINIMAL', async () => {
    // Create 3 sub-projects with large files in src/ to trigger BATCH_MINIMAL (>60000 tokens)
    const largeContent = 'x'.repeat(200000);
    for (const name of ['app-a', 'app-b', 'app-c']) {
      const dir = path.join(testDir, name);
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
        dependencies: { react: '^18.0.0' }
      }));
      fs.writeFileSync(path.join(dir, 'src', 'App.jsx'), `// ${name}\n${largeContent}`);
    }

    let maxConcurrent = 0;
    let currentConcurrent = 0;
    const allSections = [
      '<!-- section:overview -->', '概述', '<!-- /section:overview -->',
      '<!-- section:structure -->', '结构', '<!-- /section:structure -->',
      '<!-- section:modules -->', '模块', '<!-- /section:modules -->',
      '<!-- section:api -->', 'API', '<!-- /section:api -->',
      '<!-- section:data -->', '数据', '<!-- /section:data -->',
      '<!-- section:dependencies -->', '依赖', '<!-- /section:dependencies -->',
      '<!-- section:notes -->', '备注', '<!-- /section:notes -->'
    ].join('\n');

    generateWithContinuation.mockImplementation(async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise(r => setTimeout(r, 50));
      currentConcurrent--;
      return allSections;
    });

    await initCommand(testDir, { skipPrompt: true, force: true });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(maxConcurrent).toBeGreaterThan(0);
  });

  test('one project failure does not stop others', async () => {
    const largeContent = 'x'.repeat(200000);
    for (const name of ['app-a', 'app-b', 'app-c']) {
      const dir = path.join(testDir, name);
      fs.mkdirSync(path.join(dir, 'src', 'components'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
        dependencies: { react: '^18.0.0' }
      }));
      fs.writeFileSync(path.join(dir, 'src', 'App.jsx'), `// ${name}\n${largeContent}`);
      for (let i = 0; i < 4; i++) {
        fs.writeFileSync(
          path.join(dir, 'src', 'components', `Part${i}.jsx`),
          `// ${name}-${i}\n${largeContent}`
        );
      }
    }

    const allSections = [
      '<!-- section:overview -->', '概述', '<!-- /section:overview -->',
      '<!-- section:structure -->', '结构', '<!-- /section:structure -->',
      '<!-- section:modules -->', '模块', '<!-- /section:modules -->',
      '<!-- section:api -->', 'API', '<!-- /section:api -->',
      '<!-- section:data -->', '数据', '<!-- /section:data -->',
      '<!-- section:dependencies -->', '依赖', '<!-- /section:dependencies -->',
      '<!-- section:notes -->', '备注', '<!-- /section:notes -->'
    ].join('\n');

    generateWithContinuation.mockImplementation(async (prompt) => {
      // Fail for app-a, succeed for app-b and OVERVIEW
      if (prompt.includes('app-a')) throw new Error('AI service unavailable');
      return allSections;
    });

    const result = await initCommand(testDir, { skipPrompt: true, force: true });

    const state = JSON.parse(fs.readFileSync(path.join(testDir, 'ai-docs', '.init-state.json'), 'utf8'));
    // app-a should have failed, app-b should be completed
    expect(state.projects['app-a']?.status).toBe('failed');
    expect(state.projects['app-b']?.status).toBe('completed');
    // Both docs should still be attempted (failure doesn't crash the process)
    expect(fs.existsSync(path.join(testDir, 'ai-docs', 'app-b.md'))).toBe(true);
    expect(result.success).toBe(false);
    expect(result.status).toBe('partial');
    expect(result.generation.failedDocs).toEqual(expect.arrayContaining([
      expect.objectContaining({ alias: 'app-a', error: 'AI service unavailable' })
    ]));
    expect(fs.existsSync(path.join(testDir, 'ai-docs', '.last-scan.json'))).toBe(false);
  });

  test('reports a structured failure when all AI generation fails', async () => {
    generateWithContinuation.mockRejectedValue(new Error('authentication failed'));

    const result = await initCommand(testDir, { skipPrompt: true, force: true });

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.generation.generatedDocs).toEqual({});
    expect(result.generation.failedDocs).toEqual(expect.arrayContaining([
      expect.objectContaining({ error: 'authentication failed' })
    ]));
  });

  test('does not write or complete a project when one-shot boundaries are invalid', async () => {
    generateWithContinuation.mockResolvedValue([
      '## my-app',
      '<!-- section:overview -->',
      'unstructured response',
      '<!-- /section:overview -->'
    ].join('\n'));

    const result = await initCommand(testDir, { skipPrompt: true, force: true });
    const state = JSON.parse(fs.readFileSync(
      path.join(testDir, 'ai-docs', '.init-state.json'),
      'utf8'
    ));

    expect(result.success).toBe(false);
    expect(state.projects['my-app']).toEqual(expect.objectContaining({ status: 'failed' }));
    expect(fs.existsSync(path.join(testDir, 'ai-docs', 'my-app.md'))).toBe(false);
  });

  test('uses continuation generation and appends missing template sections', async () => {
    generateWithContinuation
      .mockResolvedValueOnce([
        '<<<CODE_CTX_DOC my-app>>>',
        '# my-app',
        '<!-- section:overview -->',
        '项目概述',
        '<!-- /section:overview -->',
        '<<<END_CODE_CTX_DOC my-app>>>'
      ].join('\n'))
      .mockResolvedValueOnce([
        '<!-- section:structure -->',
        '目录结构',
        '<!-- /section:structure -->',
        '<!-- section:modules -->',
        '核心模块',
        '<!-- /section:modules -->',
        '<!-- section:api -->',
        'API',
        '<!-- /section:api -->',
        '<!-- section:data -->',
        '数据模型',
        '<!-- /section:data -->',
        '<!-- section:dependencies -->',
        '依赖关系',
        '<!-- /section:dependencies -->',
        '<!-- section:notes -->',
        '注意事项',
        '<!-- /section:notes -->'
      ].join('\n'))
      .mockResolvedValueOnce([
        '<!-- section:overview -->',
        '总览',
        '<!-- /section:overview -->',
      ].join('\n'))
      .mockResolvedValueOnce([
        '<!-- section:subprojects -->',
        '子项目',
        '<!-- /section:subprojects -->',
        '<!-- section:tech-stack -->',
        '技术栈',
        '<!-- /section:tech-stack -->',
        '<!-- section:architecture -->',
        '架构',
        '<!-- /section:architecture -->',
        '<!-- section:dependencies -->',
        '依赖矩阵',
        '<!-- /section:dependencies -->',
        '<!-- section:quickstart -->',
        '快速上手',
        '<!-- /section:quickstart -->'
      ].join('\n'));

    await initCommand(testDir, { skipPrompt: true, force: true });

    const doc = fs.readFileSync(path.join(testDir, 'ai-docs/my-app.md'), 'utf8');
    const overview = fs.readFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(
      path.join(testDir, 'ai-docs/project-manifest.json'),
      'utf8'
    ));
    expect(doc).toContain('<!-- section:overview -->');
    expect(doc).toContain('<!-- section:structure -->');
    expect(doc).toContain('<!-- section:modules -->');
    expect(doc).toContain('<!-- section:api -->');
    expect(doc).toContain('<!-- section:data -->');
    expect(doc).toContain('<!-- section:dependencies -->');
    expect(doc).toContain('<!-- section:notes -->');
    expect(overview).toContain('<!-- section:overview -->');
    expect(overview).toContain('<!-- section:quickstart -->');
    expect(manifest.projects[0]).toEqual(expect.objectContaining({
      id: 'my-app',
      sourcePath: './my-app',
      document: 'my-app.md'
    }));
    expect(generateWithContinuation).toHaveBeenCalledWith(
      expect.stringContaining('请为以下所有子项目生成结构文档'),
      expect.objectContaining({
        apiKey: 'test-key',
        onProgress: expect.any(Function)
      })
    );
    expect(generateWithContinuation).toHaveBeenCalledWith(
      expect.stringContaining('以上文档缺少以下章节，请补充完整'),
      expect.objectContaining({ apiKey: 'test-key' })
    );
  });
});
