const { findRelatedDoc, findRelatedDocs, groupChangesByProject } = require('../../src/core/doc-resolver');
const fs = require('fs');
const path = require('path');

describe('groupChangesByProject', () => {
  test('groups files by top-level directory', () => {
    const files = [
      'web/src/App.vue',
      'web/src/main.js',
      'api/routes/user.js',
      'api/models/user.js'
    ];
    const groups = groupChangesByProject(files);
    expect(groups).toEqual({
      'web': ['web/src/App.vue', 'web/src/main.js'],
      'api': ['api/routes/user.js', 'api/models/user.js']
    });
  });

  test('excludes ai-docs from groups', () => {
    const files = ['web/app.js', 'ai-docs/web.md'];
    const groups = groupChangesByProject(files);
    expect(groups).not.toHaveProperty('ai-docs');
    expect(groups).toHaveProperty('web');
  });

  test('returns empty object for empty file list', () => {
    expect(groupChangesByProject([])).toEqual({});
  });

  test('handles single-level files (no subdirectory)', () => {
    const files = ['README.md', 'package.json'];
    const groups = groupChangesByProject(files);
    expect(groups).toEqual({
      'README.md': ['README.md'],
      'package.json': ['package.json']
    });
  });

  test('handles Windows-style backslash paths', () => {
    const files = ['web\\src\\App.vue', 'web\\src\\main.js'];
    const groups = groupChangesByProject(files);
    expect(groups).toHaveProperty('web');
    expect(groups['web']).toEqual(['web\\src\\App.vue', 'web\\src\\main.js']);
  });

  test('normalizes mixed path separators', () => {
    const files = ['web/src/App.vue', 'web\\main.js'];
    const groups = groupChangesByProject(files);
    expect(groups).toHaveProperty('web');
    expect(groups['web']).toHaveLength(2);
  });

  test('excludes ai-docs even with trailing separator', () => {
    const files = ['ai-docs/web.md', 'web/app.js'];
    const groups = groupChangesByProject(files);
    expect(Object.keys(groups)).not.toContain('ai-docs');
  });
});

describe('findRelatedDoc', () => {
  const testDir = path.join(__dirname, '../fixtures/doc-resolver-test');

  beforeEach(() => {
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('finds doc that mentions the directory name', () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/web.md'), '# web 前端\nsrc/ 目录结构说明');
    const result = findRelatedDoc(testDir, 'web/src/App.vue');
    expect(result).not.toBeNull();
    expect(result.name).toBe('web.md');
    expect(result.content).toContain('web 前端');
  });

  test('returns null when no matching doc exists', () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/api.md'), '# API 文档');
    const result = findRelatedDoc(testDir, 'web/src/App.vue');
    expect(result).toBeNull();
  });

  test('returns null when ai-docs directory does not exist', () => {
    const emptyDir = path.join(testDir, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    const result = findRelatedDoc(emptyDir, 'web/src/App.vue');
    expect(result).toBeNull();
  });

  test('skips OVERVIEW.md', () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# 项目概述\nweb 前端说明');
    fs.writeFileSync(path.join(testDir, 'ai-docs/api.md'), '# API');
    const result = findRelatedDoc(testDir, 'web/src/App.vue');
    // OVERVIEW.md contains "web" but should be skipped; api.md does not contain "web"
    expect(result).toBeNull();
  });

  test('matches first doc that mentions the directory', () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/a.md'), '# A\n没有匹配内容');
    fs.writeFileSync(path.join(testDir, 'ai-docs/b.md'), '# B\nweb 前端相关');
    const result = findRelatedDoc(testDir, 'web/src/App.vue');
    expect(result).not.toBeNull();
    expect(result.name).toBe('b.md');
  });
});

describe('findRelatedDocs', () => {
  const testDir = path.join(__dirname, '../fixtures/doc-resolver-multi-test');

  beforeEach(() => {
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('finds docs for multiple changed files', () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/web.md'), '# Web\nweb 前端');
    fs.writeFileSync(path.join(testDir, 'ai-docs/api.md'), '# API\napi 后端');
    const result = findRelatedDocs(testDir, ['web/app.js', 'api/routes/user.js']);
    expect(result).toHaveLength(2);
    const names = result.map(r => r.name);
    expect(names).toContain('web.md');
    expect(names).toContain('api.md');
  });

  test('deduplicates docs when multiple files match same doc', () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/web.md'), '# Web\nweb 前端');
    const result = findRelatedDocs(testDir, ['web/app.js', 'web/main.js']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('web.md');
  });

  test('returns empty array when no matches', () => {
    fs.writeFileSync(path.join(testDir, 'ai-docs/api.md'), '# API');
    const result = findRelatedDocs(testDir, ['web/app.js']);
    expect(result).toEqual([]);
  });
});
