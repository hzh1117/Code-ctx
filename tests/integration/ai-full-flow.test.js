const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { initCommand } = require('../../src/commands/init');
const { updateCommand, executeUpdateTransaction } = require('../../src/commands/update');
const { useCommand } = require('../../src/commands/use');
const { getAIConfig, _clearCache } = require('../../src/utils/config');

function projectDocument(alias) {
  const sections = [
    ['overview', 'HTTP generated overview'],
    ['structure', 'src/routes.js'],
    ['modules', 'health route module'],
    ['api', 'GET /health'],
    ['data', 'No persistent data'],
    ['dependencies', 'express'],
    ['notes', 'Run with node']
  ].map(([name, content]) => [
    `<!-- section:${name} -->`,
    content,
    `<!-- /section:${name} -->`
  ].join('\n')).join('\n');
  return `<<<CODE_CTX_DOC ${alias}>>>\n# ${alias}\n${sections}\n<<<END_CODE_CTX_DOC ${alias}>>>`;
}

function overviewDocument() {
  return [
    ['overview', 'HTTP generated system overview'],
    ['subprojects', 'Single API project'],
    ['tech-stack', 'Node.js and Express'],
    ['architecture', 'No verified cross-project calls'],
    ['dependencies', 'No cross-project dependencies'],
    ['quickstart', 'node src/routes.js']
  ].map(([name, content]) => [
    `<!-- section:${name} -->`,
    content,
    `<!-- /section:${name} -->`
  ].join('\n')).join('\n');
}

describe('AI-backed full flow integration', () => {
  let rootDir;
  let server;
  const requests = [];
  const alias = 'code-ctx-ai-e2e';

  beforeAll(async () => {
    rootDir = path.join(os.tmpdir(), alias);
    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'package.json'), JSON.stringify({
      name: alias,
      dependencies: { express: '^5.0.0' }
    }));
    fs.writeFileSync(
      path.join(rootDir, 'src', 'routes.js'),
      'router.get("/health", () => "version-one");'
    );

    server = http.createServer((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        requests.push(parsed);
        const prompt = parsed.messages.map(message => message.content).join('\n');
        let content = 'Updated documentation from current source evidence.';
        if (prompt.includes('请为以下所有子项目生成结构文档')) {
          content = projectDocument(alias);
        } else if (prompt.includes('总览文档（OVERVIEW.md）')) {
          content = overviewDocument();
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          choices: [{ message: { content }, finish_reason: 'stop' }]
        }));
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    fs.writeFileSync(path.join(rootDir, '.env'), [
      'OPENAI_API_KEY=test-key',
      `OPENAI_BASE_URL=http://127.0.0.1:${port}/v1`,
      'OPENAI_MODEL=test-model',
      'AI_TIMEOUT=5000',
      'AI_ALLOW_LOCAL_BASE_URL=true',
      'AI_ALLOW_INSECURE_BASE_URL=true'
    ].join('\n'));
    _clearCache();
  });

  afterAll(async () => {
    _clearCache();
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('runs init, update apply and use through real HTTP requests', async () => {
    const initialized = await initCommand(rootDir, { skipPrompt: true, force: true });
    expect(initialized.success).toBe(true);
    expect(fs.readFileSync(path.join(rootDir, 'ai-docs', `${alias}.md`), 'utf8'))
      .toContain('GET /health');

    const initRequestText = JSON.stringify(requests);
    expect(initRequestText).toContain('router.get');
    expect(initRequestText).toContain('version-one');

    fs.writeFileSync(
      path.join(rootDir, 'src', 'routes.js'),
      'router.post("/health", () => "version-two");'
    );
    const detection = await updateCommand(rootDir, { prepareApply: true });
    const execution = await executeUpdateTransaction(rootDir, detection, getAIConfig(rootDir));

    expect(execution.committed).toBe(true);
    const updateRequestText = JSON.stringify(requests.slice(2));
    expect(updateRequestText).toContain('router.post');
    expect(updateRequestText).toContain('version-two');
    expect(updateRequestText).toContain('status=');

    const useResult = await useCommand({
      scenario: 'G',
      taskDescription: '调整健康检查接口',
      rootDir,
      noAiMatch: true
    });
    expect(useResult.prompt).toContain('HTTP generated system overview');
    expect(useResult.prompt).toContain('调整健康检查接口');
  }, 30000);
});
