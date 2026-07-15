const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

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

  test('complete docs without a manifest remain unverified', () => {
    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'web', path: './web', type: 'react' }]
    }));
    writeDoc(aiDocs, 'web.md', fullDoc(EXPECTED_PROJECT_SECTIONS));
    writeDoc(aiDocs, 'OVERVIEW.md', fullDoc(['overview', 'subprojects', 'tech-stack', 'architecture', 'dependencies', 'quickstart']));

    const result = scoreDocs(root);
    expect(result.overall).toBe('WARN');
    expect(result.summary.formatHealth).toBeGreaterThanOrEqual(80);
    expect(result.summary.factualConfidence).toBe(0);
    expect(result.perDoc.find(d => d.name === 'web.md').factualConfidence.status).toBe('unverified');
  });

  test('returns OK only when source facts and citations verify against the manifest', () => {
    const projectDir = path.join(root, 'web');
    fs.mkdirSync(projectDir);
    const source = [
      "const express = require('express');",
      "router.get('/users', listUsers);",
      'function listUsers() {}'
    ].join('\n');
    fs.writeFileSync(path.join(projectDir, 'index.js'), source);
    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'web', path: './web', type: 'node-backend' }]
    }));
    const hash = crypto.createHash('sha256').update(source).digest('hex');
    fs.writeFileSync(path.join(aiDocs, 'project-manifest.json'), JSON.stringify({
      version: 1,
      projects: [{
        id: 'web',
        sourcePath: './web',
        document: 'web.md',
        keyFiles: [{ path: 'index.js', hash }]
      }]
    }));
    const projectDoc = fullDoc(EXPECTED_PROJECT_SECTIONS) + [
      '',
      `Source: \`index.js\` sha256:${hash}`,
      'Symbol: `index.js#listUsers`',
      'Route: GET /users'
    ].join('\n');
    writeDoc(aiDocs, 'web.md', projectDoc);
    writeDoc(
      aiDocs,
      'OVERVIEW.md',
      fullDoc(['overview', 'subprojects', 'tech-stack', 'architecture', 'dependencies', 'quickstart']) +
        '\nweb ./web web.md\n'
    );

    const result = scoreDocs(root);

    expect(result.overall).toBe('OK');
    expect(result.summary.factualConfidence).toBe(100);
    expect(result.perDoc.find(d => d.name === 'web.md').factualConfidence).toEqual(
      expect.objectContaining({ status: 'verified', score: 100 })
    );
  });

  test('marks changed source hashes as factual risk even when formatting is complete', () => {
    const projectDir = path.join(root, 'web');
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, 'index.js'), 'current source');
    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'web', path: './web', type: 'generic-js-ts' }]
    }));
    fs.writeFileSync(path.join(aiDocs, 'project-manifest.json'), JSON.stringify({
      projects: [{
        id: 'web', sourcePath: './web', document: 'web.md',
        keyFiles: [{ path: 'index.js', hash: 'stale-hash' }]
      }]
    }));
    writeDoc(aiDocs, 'web.md', fullDoc(EXPECTED_PROJECT_SECTIONS) + '\n`index.js` stale-hash\n');
    writeDoc(
      aiDocs,
      'OVERVIEW.md',
      fullDoc(['overview', 'subprojects', 'tech-stack', 'architecture', 'dependencies', 'quickstart']) +
        '\nweb ./web web.md\n'
    );

    const result = scoreDocs(root);
    const web = result.perDoc.find(d => d.name === 'web.md');

    expect(result.overall).toBe('HIGH_RISK');
    expect(web.formatHealth.score).toBeGreaterThanOrEqual(80);
    expect(web.factualConfidence.metrics.referenceResolution).toBe(0);
    expect(web.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'source-reference-invalid' })
    ]));
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
