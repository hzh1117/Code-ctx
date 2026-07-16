const fs = require('fs');
const path = require('path');
const { readFileUTF8, isWithinDir } = require('../utils/file-reader');
const { loadProjectConfig } = require('../utils/config');

function loadManifest(rootDir) {
  const manifestPath = path.join(rootDir, 'ai-docs', 'project-manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return Array.isArray(manifest.projects) ? manifest : null;
  } catch {
    return null;
  }
}

function getProjectMappings(rootDir) {
  const manifest = loadManifest(rootDir);
  if (!manifest) return [];
  let config;
  try {
    config = loadProjectConfig(rootDir);
  } catch {
    return [];
  }
  if (!Array.isArray(config.projects)) return [];

  const manifestById = new Map(manifest.projects.map(project => [project.id, project]));
  const aiDocsDir = path.resolve(rootDir, 'ai-docs');
  return config.projects.flatMap(project => {
    const entry = manifestById.get(project.alias);
    if (!entry || !project.path || !entry.sourcePath || !entry.document) return [];
    const configRoot = path.resolve(rootDir, project.path);
    const manifestRoot = path.resolve(rootDir, entry.sourcePath);
    if (configRoot !== manifestRoot || !isWithinDir(configRoot, rootDir)) return [];
    if (path.basename(entry.document) !== entry.document || !entry.document.endsWith('.md')) return [];
    const docPath = path.resolve(aiDocsDir, entry.document);
    if (!isWithinDir(docPath, aiDocsDir) || !fs.existsSync(docPath)) return [];
    return [{
      id: project.alias,
      projectRoot: configRoot,
      sourcePath: entry.sourcePath,
      docName: entry.document,
      docPath
    }];
  }).sort((a, b) => b.projectRoot.length - a.projectRoot.length);
}

function resolveProjectForFile(rootDir, changedFile) {
  const absoluteFile = path.resolve(rootDir, changedFile);
  if (!isWithinDir(absoluteFile, rootDir) || isWithinDir(absoluteFile, path.join(rootDir, 'ai-docs'))) {
    return null;
  }
  return getProjectMappings(rootDir).find(mapping =>
    isWithinDir(absoluteFile, mapping.projectRoot)
  ) || null;
}

function findRelatedDoc(rootDir, changedFile) {
  const mapping = resolveProjectForFile(rootDir, changedFile);
  if (!mapping) return null;
  return {
    name: mapping.docName,
    content: readFileUTF8(mapping.docPath),
    projectId: mapping.id,
    sourcePath: mapping.sourcePath
  };
}

function findRelatedDocs(rootDir, changedFiles) {
  const results = new Map();
  for (const file of changedFiles) {
    const doc = findRelatedDoc(rootDir, file);
    if (doc && !results.has(doc.name)) results.set(doc.name, doc);
  }
  return [...results.values()];
}

function groupChangesByProject(rootDir, changedFiles) {
  const groups = {};
  for (const file of changedFiles) {
    const mapping = resolveProjectForFile(rootDir, file);
    if (!mapping) continue;
    if (!groups[mapping.id]) groups[mapping.id] = [];
    groups[mapping.id].push(file);
  }
  return groups;
}

module.exports = {
  findRelatedDoc,
  findRelatedDocs,
  getProjectMappings,
  groupChangesByProject,
  resolveProjectForFile
};
