const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const { defaultRegistry } = require('../adapters');

function scanProject(projectDir, projectType) {
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    throw new Error(`Directory does not exist: ${projectDir}`);
  }

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
  return { tree, keyFiles: uniqueFiles };
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

    totalTokens += enCount * 0.3 + cnCount * 0.6 + codeCount * 0.4;
  }

  return Math.round(totalTokens);
}

module.exports = { scanProject, estimateTokens };
