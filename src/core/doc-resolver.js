const fs = require('fs');
const path = require('path');
const { readFileUTF8 } = require('../utils/file-reader');

function findRelatedDoc(rootDir, changedFile) {
  const aiDocsDir = path.join(rootDir, 'ai-docs');
  if (!fs.existsSync(aiDocsDir)) return null;

  const docs = fs.readdirSync(aiDocsDir).filter(f => f.endsWith('.md'));
  for (const doc of docs) {
    if (doc === 'OVERVIEW.md') continue;
    const docContent = readFileUTF8(path.join(aiDocsDir, doc));
    const dirName = path.dirname(changedFile).replace(/\\/g, '/').split('/')[0];
    if (docContent.includes(dirName)) {
      return { name: doc, content: docContent };
    }
  }
  return null;
}

function findRelatedDocs(rootDir, changedFiles) {
  const results = new Map();
  for (const file of changedFiles) {
    const doc = findRelatedDoc(rootDir, file);
    if (doc && !results.has(doc.name)) {
      results.set(doc.name, doc);
    }
  }
  return [...results.values()];
}

function groupChangesByProject(changedFiles) {
  const groups = {};
  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, '/');
    const project = normalized.split('/')[0];
    if (project && project !== 'ai-docs') {
      if (!groups[project]) groups[project] = [];
      groups[project].push(file);
    }
  }
  return groups;
}

module.exports = { findRelatedDoc, findRelatedDocs, groupChangesByProject };
