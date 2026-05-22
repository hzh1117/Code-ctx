const fs = require('fs');
const path = require('path');
const os = require('os');

const { scoreDocs, scoreOneDoc, EXPECTED_PROJECT_SECTIONS } = require('../../src/utils/doc-quality');
const { _clearCache } = require('../../src/utils/config');

function writeDoc(dir, name, content) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function fullDoc(sections, extraLines = 30) {
  const body = sections
    .map(s => `<!-- section:${s} -->\n${'L\n'.repeat(extraLines)}<!-- /section:${s} -->`)
    .join('\n\n');
  return `# Test\n\n${body}\n`;
}

describe('doc-quality', () => {
  let root;
  let aiDocs;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-quality-'));
    aiDocs = path.join(root, 'ai-docs');
    fs.mkdirSync(aiDocs);
    _clearCache();
  });

  afterEach(() => {
    _clearCache();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('returns HIGH_RISK when ai-docs is missing', () => {
    fs.rmSync(aiDocs, { recursive: true, force: true });
    const result = scoreDocs(root);
    expect(result.overall).toBe('HIGH_RISK');
    expect(result.aiDocsExists).toBe(false);
  });

  test('returns OK when configured docs are complete', () => {
    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'web', path: './web', type: 'react' }]
    }));
    writeDoc(aiDocs, 'web.md', fullDoc(EXPECTED_PROJECT_SECTIONS));
    writeDoc(aiDocs, 'OVERVIEW.md', fullDoc(['overview', 'subprojects', 'tech-stack', 'architecture', 'dependencies', 'quickstart']));

    const result = scoreDocs(root);
    expect(result.overall).toBe('OK');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.perDoc.find(d => d.name === 'web.md').level).toBe('OK');
  });

  test('marks doc as HIGH_RISK when sensitive info present', () => {
    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'web', path: './web', type: 'react' }]
    }));
    // Use a long fake key that the detector flags
    const sensitive = fullDoc(EXPECTED_PROJECT_SECTIONS) + '\napi_key = "abcdef1234567890abcdef"';
    writeDoc(aiDocs, 'web.md', sensitive);
    writeDoc(aiDocs, 'OVERVIEW.md', fullDoc(['overview', 'subprojects', 'tech-stack', 'architecture', 'dependencies', 'quickstart']));

    const result = scoreDocs(root);
    expect(result.overall).toBe('HIGH_RISK');
    const web = result.perDoc.find(d => d.name === 'web.md');
    expect(web.risks.some(r => r.type === 'sensitive')).toBe(true);
  });

  test('marks doc as HIGH_RISK when missing', () => {
    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'web', path: './web', type: 'react' }]
    }));
    // Note: only OVERVIEW.md, no web.md
    writeDoc(aiDocs, 'OVERVIEW.md', fullDoc(['overview', 'subprojects', 'tech-stack', 'architecture', 'dependencies', 'quickstart']));

    const result = scoreDocs(root);
    expect(result.overall).toBe('HIGH_RISK');
    const web = result.perDoc.find(d => d.name === 'web.md');
    expect(web.exists).toBe(false);
    expect(web.risks.some(r => r.type === 'doc-missing')).toBe(true);
  });

  test('WARN when sections are partially missing but no sensitive/missing', () => {
    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'web', path: './web', type: 'react' }]
    }));
    // Only half the sections
    const partial = ['overview', 'structure', 'modules'];
    writeDoc(aiDocs, 'web.md', fullDoc(partial));
    writeDoc(aiDocs, 'OVERVIEW.md', fullDoc(['overview', 'subprojects', 'tech-stack', 'architecture', 'dependencies', 'quickstart']));

    const result = scoreDocs(root);
    expect(['WARN', 'HIGH_RISK']).toContain(result.overall);
    const web = result.perDoc.find(d => d.name === 'web.md');
    expect(web.completeness.missing).toEqual(expect.arrayContaining(['api', 'data']));
  });

  test('detects stale doc when project files are newer', () => {
    const projectDir = path.join(root, 'web');
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, 'index.js'), '// 1');

    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'web', path: './web', type: 'react' }]
    }));

    const docPath = writeDoc(aiDocs, 'web.md', fullDoc(EXPECTED_PROJECT_SECTIONS));
    writeDoc(aiDocs, 'OVERVIEW.md', fullDoc(['overview', 'subprojects', 'tech-stack', 'architecture', 'dependencies', 'quickstart']));

    // Backdate doc, bump project file forward
    const past = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    fs.utimesSync(docPath, past, past);
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(projectDir, 'index.js'), future, future);

    const result = scoreDocs(root);
    const web = result.perDoc.find(d => d.name === 'web.md');
    expect(web.freshness.stale).toBe(true);
    expect(['WARN', 'HIGH_RISK']).toContain(result.overall);
  });

  test('scoreOneDoc handles a too-short doc', () => {
    writeDoc(aiDocs, 'tiny.md', '# Tiny\n\nonly a line\n');
    const result = scoreOneDoc({
      filePath: path.join(aiDocs, 'tiny.md'),
      docName: 'tiny.md',
      expectedSections: EXPECTED_PROJECT_SECTIONS,
      projectDir: null,
      freshnessDeadline: Date.now() + 1000
    });
    expect(result.risks.some(r => r.type === 'too-short')).toBe(true);
    expect(result.level).not.toBe('OK');
  });
});
