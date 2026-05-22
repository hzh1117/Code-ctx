const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const { defaultRegistry } = require('../adapters');
const { PROJECT_LIMITS } = require('../utils/constants');

function scanProject(projectDir, projectType, options = {}) {
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    throw new Error(`Directory does not exist: ${projectDir}`);
  }

  const maxFiles = options.maxFiles || PROJECT_LIMITS.MAX_FILES_PER_PROJECT;
  const maxTokens = options.maxTokens || PROJECT_LIMITS.MAX_PROJECT_TOKENS;
  
  const patterns = defaultRegistry.getScanPatterns(projectType);
  const keyFiles = [];
  const tree = buildTree(projectDir);

  for (const pattern of patterns) {
    const matches = globSync(pattern, {
      cwd: projectDir,
      absolute: true,
      nodir: true
    });
    keyFiles.push(...matches);
  }

  const uniqueFiles = [...new Set(keyFiles)];

  // 限制文件数量
  let limitedFiles = uniqueFiles;
  if (uniqueFiles.length > maxFiles) {
    limitedFiles = prioritizeFiles(uniqueFiles, projectType).slice(0, maxFiles);
  }

  // 限制 token 数量
  const result = limitByTokens(limitedFiles, maxTokens);

  return {
    tree,
    keyFiles: result.files,
    totalFiles: uniqueFiles.length,
    limitedTo: result.files.length,
    estimatedTokens: result.tokens
  };
}

function prioritizeFiles(files, projectType) {
  // Adapter-driven: each project type contributes its own priorityKeywords map.
  // Unknown / unranked files get priority 100 and sort to the end.
  return files.slice().sort((a, b) => {
    const aScore = defaultRegistry.getFilePriority(projectType, a);
    const bScore = defaultRegistry.getFilePriority(projectType, b);
    return aScore - bScore;
  });
}

function limitByTokens(files, maxTokens) {
  let totalTokens = 0;
  const resultFiles = [];
  
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    
    const fileTokens = estimateTokensForContent(content);
    
    if (totalTokens + fileTokens > maxTokens && resultFiles.length > 0) {
      break;
    }
    
    totalTokens += fileTokens;
    resultFiles.push(filePath);
  }
  
  return { files: resultFiles, tokens: totalTokens };
}

function estimateTokensForContent(content) {
  let enCount = 0;
  let cnCount = 0;
  let codeCount = 0;

  for (const char of content) {
    const code = char.codePointAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) {
      cnCount++;
    } else if ((code >= 0x0020 && code <= 0x007e) || code === 0x000a || code === 0x000d) {
      if (/[a-zA-Z0-9\s]/.test(char)) {
        enCount++;
      } else {
        codeCount++;
      }
    }
  }

  return Math.round(enCount * 0.3 + cnCount * 0.6 + codeCount * 0.4);
}

function buildTree(dir, prefix = '', depth = 0, maxDepth = 5) {
  if (depth >= maxDepth) return prefix + '└── ...\n';

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let tree = '';

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tree += `${prefix}├── ${entry.name}/\n`;
      tree += buildTree(fullPath, prefix + '│   ', depth + 1, maxDepth);
    } else {
      tree += `${prefix}├── ${entry.name}\n`;
    }
  }

  return tree;
}

function estimateTokens(filePaths) {
  let totalTokens = 0;

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;

    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    totalTokens += estimateTokensForContent(content);
  }

  return Math.round(totalTokens);
}

module.exports = { scanProject, estimateTokens };
