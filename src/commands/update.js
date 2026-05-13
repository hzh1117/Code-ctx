const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extractSection, replaceSection, listSections } = require('../core/section');
const { readFileUTF8 } = require('../utils/file-reader');
const { renderTemplate, loadTemplate } = require('../template/engine');

function getFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

function getAllFiles(dir, ignoreDirs = ['node_modules', '.git', 'dist', 'ai-docs']) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoreDirs.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, ignoreDirs));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function findRelatedDoc(rootDir, changedFile) {
  const aiDocsDir = path.join(rootDir, 'ai-docs');
  if (!fs.existsSync(aiDocsDir)) return null;

  const docs = fs.readdirSync(aiDocsDir).filter(f => f.endsWith('.md'));
  for (const doc of docs) {
    if (doc === 'OVERVIEW.md') continue;
    const docContent = readFileUTF8(path.join(aiDocsDir, doc));
    const dirName = path.dirname(changedFile).split(path.sep)[0];
    if (docContent.includes(dirName)) {
      return { name: doc, content: docContent };
    }
  }
  return null;
}

/**
 * Build per-section prompts for changed files.
 * Returns an array of { docName, sectionName, prompt } objects.
 */
function buildSectionUpdatePrompts(rootDir, changedFiles) {
  const changesByProject = {};
  for (const file of changedFiles) {
    const fileParts = file.split(path.sep);
    const project = fileParts[0] === 'ai-docs' ? null : fileParts[0];
    if (project) {
      if (!changesByProject[project]) changesByProject[project] = [];
      changesByProject[project].push(file);
    }
  }

  const sectionUpdates = [];

  for (const [project, projFiles] of Object.entries(changesByProject)) {
    const relatedDoc = findRelatedDoc(rootDir, projFiles[0]);
    if (!relatedDoc) continue;

    const sections = listSections(relatedDoc.content);
    if (sections.length === 0) continue;

    const tpl = loadTemplate('update-prompt.md');
    for (const sectionName of sections) {
      const sectionContent = extractSection(relatedDoc.content, sectionName);
      if (sectionContent === null) continue;

      const prompt = renderTemplate(tpl, {
        project,
        sectionName,
        changedFiles: projFiles.map(f => `- ${f}`).join('\n'),
        sectionContent
      });

      sectionUpdates.push({
        docName: relatedDoc.name,
        sectionName,
        prompt
      });
    }
  }

  return sectionUpdates;
}

/**
 * Apply section-level updates to a doc file.
 * @param {string} docPath - Path to the doc file
 * @param {Array<{sectionName: string, newContent: string}>} updates
 */
function applySectionUpdates(docPath, updates) {
  let content = readFileUTF8(docPath);
  for (const { sectionName, newContent } of updates) {
    content = replaceSection(content, sectionName, newContent);
  }
  fs.writeFileSync(docPath, content);
}

async function updateCommand(rootDir, options = {}) {
  const lastScanPath = path.join(rootDir, 'ai-docs/.last-scan.json');

  let lastScan = { timestamp: null, files: {} };
  if (fs.existsSync(lastScanPath)) {
    lastScan = JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
  }

  const currentFiles = {};
  const files = getAllFiles(rootDir);
  for (const file of files) {
    const relativePath = path.relative(rootDir, file);
    currentFiles[relativePath] = getFileHash(file);
  }

  const changedFiles = [];
  for (const [file, hash] of Object.entries(currentFiles)) {
    if (lastScan.files[file] !== hash) {
      changedFiles.push(file);
    }
  }

  // Build section-aware update prompts
  const sectionUpdates = buildSectionUpdatePrompts(rootDir, changedFiles);

  // Fallback: if no sections found, build a single full-doc prompt
  let prompt = null;
  if (sectionUpdates.length === 0 && changedFiles.length > 0) {
    const changesByProject = {};
    for (const file of changedFiles) {
      const fileParts = file.split(path.sep);
      const project = fileParts[0] === 'ai-docs' ? null : fileParts[0];
      if (project) {
        if (!changesByProject[project]) changesByProject[project] = [];
        changesByProject[project].push(file);
      }
    }

    const projectSections = [];
    for (const [project, projFiles] of Object.entries(changesByProject)) {
      const parts = [`### 子项目: ${project}`, '变化文件：'];
      projFiles.forEach(f => parts.push(`- ${f}`));

      const relatedDoc = findRelatedDoc(rootDir, projFiles[0]);
      if (relatedDoc) {
        parts.push(`\n当前文档内容（${relatedDoc.name}）：`);
        parts.push('```markdown');
        parts.push(relatedDoc.content);
        parts.push('```');
      }
      projectSections.push(parts.join('\n'));
    }

    const tpl = loadTemplate('update-prompt-full.md');
    prompt = renderTemplate(tpl, { projectSections: projectSections.join('\n\n') });
  }

  if (!options.dryRun) {
    const newScan = {
      timestamp: new Date().toISOString(),
      files: currentFiles
    };
    fs.writeFileSync(lastScanPath, JSON.stringify(newScan, null, 2));
  }

  return { changedFiles, prompt, sectionUpdates };
}

module.exports = { updateCommand, applySectionUpdates };
