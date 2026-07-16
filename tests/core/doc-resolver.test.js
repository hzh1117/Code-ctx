const {
  findRelatedDoc,
  findRelatedDocs,
  groupChangesByProject,
  resolveProjectForFile
} = require('../../src/core/doc-resolver');
const { _clearCache } = require('../../src/utils/config');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('manifest-backed doc resolver', () => {
  let root;
  let aiDocs;

  function configure(projects) {
    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({ projects }));
    fs.writeFileSync(path.join(aiDocs, 'project-manifest.json'), JSON.stringify({
      version: 1,
      projects: projects.map(project => ({
        id: project.alias,
        sourcePath: project.path,
        document: `${project.alias}.md`
      }))
    }));
    for (const project of projects) {
      fs.writeFileSync(path.join(aiDocs, `${project.alias}.md`), `# ${project.alias}\n正文不参与归属判断`);
    }
    _clearCache();
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-resolver-'));
    aiDocs = path.join(root, 'ai-docs');
    fs.mkdirSync(aiDocs);
    _clearCache();
  });

  afterEach(() => {
    _clearCache();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('uses longest normalized project-root prefix for nested projects', () => {
    fs.mkdirSync(path.join(root, 'packages', 'web', 'src'), { recursive: true });
    configure([
      { alias: 'root', path: '.', type: 'generic-js-ts' },
      { alias: 'web', path: './packages/web', type: 'react' }
    ]);

    expect(findRelatedDoc(root, 'packages/web/src/App.jsx')).toEqual(expect.objectContaining({
      name: 'web.md',
      projectId: 'web'
    }));
    expect(findRelatedDoc(root, 'package.json')).toEqual(expect.objectContaining({
      name: 'root.md',
      projectId: 'root'
    }));
  });

  test('resolves same-named nested directories by full project path', () => {
    fs.mkdirSync(path.join(root, 'apps', 'admin', 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'packages', 'admin', 'src'), { recursive: true });
    configure([
      { alias: 'apps-admin', path: './apps/admin', type: 'react' },
      { alias: 'packages-admin', path: './packages/admin', type: 'react' }
    ]);

    expect(resolveProjectForFile(root, 'packages/admin/src/App.jsx').id).toBe('packages-admin');
    expect(resolveProjectForFile(root, 'apps/admin/src/App.jsx').id).toBe('apps-admin');
  });

  test('does not infer ownership from document body when manifest is missing', () => {
    fs.writeFileSync(path.join(aiDocs, 'web.md'), '# web\npackages/web src App');
    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'web', path: './packages/web', type: 'react' }]
    }));
    _clearCache();

    expect(findRelatedDoc(root, 'packages/web/src/App.jsx')).toBeNull();
  });

  test('rejects manifest source paths that disagree with config', () => {
    fs.mkdirSync(path.join(root, 'apps', 'web'), { recursive: true });
    fs.writeFileSync(path.join(root, 'code-ctx.config.json'), JSON.stringify({
      projects: [{ alias: 'web', path: './apps/web', type: 'react' }]
    }));
    fs.writeFileSync(path.join(aiDocs, 'web.md'), '# Web');
    fs.writeFileSync(path.join(aiDocs, 'project-manifest.json'), JSON.stringify({
      projects: [{ id: 'web', sourcePath: './other/web', document: 'web.md' }]
    }));
    _clearCache();

    expect(findRelatedDoc(root, 'apps/web/App.jsx')).toBeNull();
  });

  test('groups root and nested changes by canonical project id', () => {
    fs.mkdirSync(path.join(root, 'packages', 'api'), { recursive: true });
    configure([
      { alias: 'root', path: '.', type: 'generic-js-ts' },
      { alias: 'api', path: './packages/api', type: 'node-backend' }
    ]);

    expect(groupChangesByProject(root, [
      'README.md',
      'packages/api/routes.js',
      'ai-docs/root.md'
    ])).toEqual({
      root: ['README.md'],
      api: ['packages/api/routes.js']
    });
  });

  test('findRelatedDocs deduplicates manifest documents', () => {
    fs.mkdirSync(path.join(root, 'web'), { recursive: true });
    configure([{ alias: 'web', path: './web', type: 'react' }]);

    const docs = findRelatedDocs(root, ['web/App.jsx', 'web/main.jsx']);

    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe('web.md');
  });
});
