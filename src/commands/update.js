const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
    const docContent = fs.readFileSync(path.join(aiDocsDir, doc), 'utf8');
    const dirName = path.dirname(changedFile).split(path.sep)[0];
    if (docContent.includes(dirName)) {
      return { name: doc, content: docContent };
    }
  }
  return null;
}

async function updateCommand(rootDir, options = {}) {
  const lastScanPath = path.join(rootDir, 'ai-docs/.last-scan');

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

  let prompt = null;
  if (changedFiles.length > 0) {
    const parts = [];
    parts.push('以下是项目中发生变化的文件，请根据变化更新对应的文档：\n');

    const changesByProject = {};
    for (const file of changedFiles) {
      const fileParts = file.split(path.sep);
      const project = fileParts[0] === 'ai-docs' ? null : fileParts[0];
      if (project) {
        if (!changesByProject[project]) changesByProject[project] = [];
        changesByProject[project].push(file);
      }
    }

    for (const [project, projFiles] of Object.entries(changesByProject)) {
      parts.push(`### 子项目: ${project}`);
      parts.push('变化文件：');
      projFiles.forEach(f => parts.push(`- ${f}`));

      const relatedDoc = findRelatedDoc(rootDir, projFiles[0]);
      if (relatedDoc) {
        parts.push(`\n当前文档内容（${relatedDoc.name}）：`);
        parts.push('```markdown');
        parts.push(relatedDoc.content);
        parts.push('```');
      }
      parts.push('');
    }

    parts.push('请更新对应的文档，只修改变化的部分，保持其他内容不变。');
    prompt = parts.join('\n');
  }

  if (!options.dryRun) {
    const newScan = {
      timestamp: new Date().toISOString(),
      files: currentFiles
    };
    fs.writeFileSync(lastScanPath, JSON.stringify(newScan, null, 2));
  }

  return { changedFiles, prompt };
}

module.exports = { updateCommand };
