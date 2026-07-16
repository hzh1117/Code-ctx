const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { globSync } = require('glob');
const { defaultRegistry } = require('../adapters');
const { CONTEXT_LIMITS, PROJECT_LIMITS } = require('../utils/constants');
const { estimateTokensForContent } = require('../utils/token-estimator');
const { filterSensitive } = require('../utils/sensitive-filter');
const { createIgnoreEngine } = require('../utils/ignore-engine');

const LANGUAGE_BY_EXTENSION = {
  '.c': 'c',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.css': 'css',
  '.go': 'go',
  '.gradle': 'groovy',
  '.html': 'html',
  '.java': 'java',
  '.js': 'javascript',
  '.json': 'json',
  '.jsx': 'javascript',
  '.kt': 'kotlin',
  '.md': 'markdown',
  '.php': 'php',
  '.properties': 'properties',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.scss': 'scss',
  '.sh': 'shell',
  '.sql': 'sql',
  '.svelte': 'svelte',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.vue': 'vue',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml'
};

const PROJECT_MANIFEST_PATTERNS = [
  'package.json', 'pom.xml', 'build.gradle', 'settings.gradle',
  'go.mod', 'Cargo.toml', 'pyproject.toml', 'requirements*.txt'
];

function scanProject(projectDir, projectType, options = {}) {
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    throw new Error(`Directory does not exist: ${projectDir}`);
  }

  const maxFiles = options.maxFiles || PROJECT_LIMITS.MAX_FILES_PER_PROJECT;
  const maxTokens = options.maxTokens || PROJECT_LIMITS.MAX_PROJECT_TOKENS;
  const maxSourceChars = options.maxSourceChars ?? CONTEXT_LIMITS.MAX_KEYFILE_CHARS;
  const maxSourceFileChars = options.maxSourceFileChars ?? CONTEXT_LIMITS.MAX_SOURCE_FILE_CHARS;
  
  const registry = options.registry || defaultRegistry;
  const ignoreEngine = options.ignoreEngine || createIgnoreEngine(projectDir, {
    excludeDirs: options.excludeDirs
  });
  const configuredPatterns = Array.isArray(options.scanPatterns) ? options.scanPatterns : null;
  const adapterPatterns = configuredPatterns || registry.getScanPatterns(projectType);
  const patterns = adapterPatterns.length > 0
    ? [...adapterPatterns, ...PROJECT_MANIFEST_PATTERNS]
    : [];
  const keyFiles = [];
  const tree = buildTree(projectDir, '', 0, 5, ignoreEngine);

  for (const pattern of patterns) {
    const matches = globSync(pattern, {
      cwd: projectDir,
      absolute: true,
      nodir: true
    });
    keyFiles.push(...ignoreEngine.filter(matches));
  }

  keyFiles.push(...registry.extractKeyFiles(projectType, projectDir)
    .filter(filePath =>
      fs.existsSync(filePath) && fs.statSync(filePath).isFile() && !ignoreEngine.ignores(filePath)
    ));

  const uniqueFiles = [...new Set(keyFiles)];

  // 限制文件数量
  let limitedFiles = uniqueFiles;
  if (uniqueFiles.length > maxFiles) {
    limitedFiles = prioritizeFiles(uniqueFiles, projectType, registry).slice(0, maxFiles);
  }

  // 限制 token 数量
  const result = limitByTokens(limitedFiles, maxTokens);
  const sourceFiles = buildSourceSnapshots(
    result.files,
    projectDir,
    maxSourceChars,
    maxSourceFileChars
  );

  return {
    tree,
    keyFiles: result.files,
    sourceFiles,
    promptHints: registry.getPromptHints(projectType),
    totalFiles: uniqueFiles.length,
    limitedTo: result.files.length,
    estimatedTokens: result.tokens
  };
}

function detectLanguage(filePath) {
  const basename = path.basename(filePath).toLowerCase();
  if (basename === 'dockerfile') return 'dockerfile';
  if (basename === 'makefile') return 'makefile';
  return LANGUAGE_BY_EXTENSION[path.extname(basename)] || 'text';
}

function buildSourceSnapshots(files, projectDir, maxTotalChars, maxFileChars) {
  let remainingChars = Math.max(0, maxTotalChars);

  return files.map(filePath => {
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return null;
    }

    const safe = filterSensitive(content);
    const originalChars = safe.content.length;
    const includedChars = Math.min(originalChars, maxFileChars, remainingChars);
    const snippet = safe.content.slice(0, includedChars);
    remainingChars -= includedChars;

    let reason = null;
    if (includedChars < originalChars) {
      reason = remainingChars === 0 && includedChars < Math.min(originalChars, maxFileChars)
        ? 'total-budget'
        : 'file-limit';
    }

    return {
      path: path.relative(projectDir, filePath).split(path.sep).join('/'),
      language: detectLanguage(filePath),
      hash: crypto.createHash('sha256').update(content).digest('hex'),
      hashAlgorithm: 'sha256',
      content: snippet,
      redactions: safe.count,
      truncation: {
        truncated: includedChars < originalChars,
        originalChars,
        includedChars,
        reason
      }
    };
  }).filter(Boolean);
}

function prioritizeFiles(files, projectType, registry = defaultRegistry) {
  // Adapter-driven: each project type contributes its own priorityKeywords map.
  // Unknown / unranked files get priority 100 and sort to the end.
  return files.slice().sort((a, b) => {
    const aScore = registry.getFilePriority(projectType, a);
    const bScore = registry.getFilePriority(projectType, b);
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

function buildTree(dir, prefix = '', depth = 0, maxDepth = 5, ignoreEngine = null) {
  if (depth >= maxDepth) return prefix + '└── ...\n';

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return prefix + '└── (无法读取目录)\n';
  }

  // Filter hidden dirs/files and node_modules, preserving entry objects
  const visible = entries.filter(e =>
    !e.name.startsWith('.') &&
    e.name !== 'node_modules' &&
    e.name !== 'ai-docs' &&
    e.name !== 'code-ctx.config.json' &&
    e.name !== 'code-ctx.config.js' &&
    (!ignoreEngine || !ignoreEngine.ignores(path.join(dir, e.name)))
  );
  let tree = '';

  for (let i = 0; i < visible.length; i++) {
    const entry = visible[i];
    const isLast = i === visible.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? prefix + '    ' : prefix + '│   ';

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tree += `${prefix}${connector}${entry.name}/\n`;
      tree += buildTree(fullPath, childPrefix, depth + 1, maxDepth, ignoreEngine);
    } else {
      tree += `${prefix}${connector}${entry.name}\n`;
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
