const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

async function updateCommand(rootDir, options = {}) {
  const lastScanPath = path.join(rootDir, 'ai-docs/.last-scan');
  
  let lastScan = { timestamp: null, files: {} };
  if (fs.existsSync(lastScanPath)) {
    lastScan = JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
  }
  
  const currentFiles = {};
  const srcDir = path.join(rootDir, 'src');
  if (fs.existsSync(srcDir)) {
    const files = getAllFiles(srcDir);
    for (const file of files) {
      const relativePath = path.relative(rootDir, file);
      currentFiles[relativePath] = getFileHash(file);
    }
  }
  
  const changedFiles = [];
  for (const [file, hash] of Object.entries(currentFiles)) {
    if (lastScan.files[file] !== hash) {
      changedFiles.push(file);
    }
  }
  
  if (!options.dryRun) {
    const newScan = {
      timestamp: new Date().toISOString(),
      files: currentFiles
    };
    fs.writeFileSync(lastScanPath, JSON.stringify(newScan, null, 2));
  }
  
  return { changedFiles };
}

function getAllFiles(dir, ignoreDirs = ['node_modules', '.git', 'dist']) {
  const files = [];
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

module.exports = { updateCommand };
