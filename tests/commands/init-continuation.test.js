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

  test('uses continuation generation and appends missing template sections', async () => {
    generateWithContinuation
      .mockResolvedValueOnce([
        '## my-app',
        '<!-- section:overview -->',
        '项目概述',
        '<!-- /section:overview -->'
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
    expect(doc).toContain('<!-- section:overview -->');
    expect(doc).toContain('<!-- section:structure -->');
    expect(doc).toContain('<!-- section:modules -->');
    expect(doc).toContain('<!-- section:api -->');
    expect(doc).toContain('<!-- section:data -->');
    expect(doc).toContain('<!-- section:dependencies -->');
    expect(doc).toContain('<!-- section:notes -->');
    expect(overview).toContain('<!-- section:overview -->');
    expect(overview).toContain('<!-- section:quickstart -->');
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
