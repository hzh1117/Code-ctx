const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { glob, globSync } = require('glob');
const { defaultRegistry } = require('../adapters');
const { CONTEXT_LIMITS, PROJECT_LIMITS } = require('../utils/constants');
const { estimateTokensForContent } = require('../utils/token-estimator');
const { filterSensitive } = require('../utils/sensitive-filter');
const { createIgnoreEngine } = require('../utils/ignore-engine');
const { mapWithConcurrency } = require('../utils/async-pool');

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
  const limitedFiles = prioritizeFiles(uniqueFiles, projectType, registry).slice(0, maxFiles);

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
    estimatedTokens: result.tokens,
    skippedFiles: result.skipped
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
    if (aScore !== bScore) return aScore - bScore;
    let aSize = Infinity;
    let bSize = Infinity;
    try { aSize = fs.statSync(a).size; } catch { /* unreadable files sort last */ }
    try { bSize = fs.statSync(b).size; } catch { /* unreadable files sort last */ }
    return aSize - bSize || a.localeCompare(b);
  });
}

function limitByTokens(files, maxTokens) {
  let totalTokens = 0;
  const resultFiles = [];
  const skipped = [];
  
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    
    const fileTokens = estimateTokensForContent(content);
    
    if (totalTokens + fileTokens > maxTokens) {
      skipped.push({ path: filePath, reason: 'token-budget', estimatedTokens: fileTokens });
      continue;
    }
    
    totalTokens += fileTokens;
    resultFiles.push(filePath);
  }
  
  return { files: resultFiles, tokens: totalTokens, skipped };
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

async function buildTreeAsync(
  dir, prefix = '', depth = 0, maxDepth = 5, ignoreEngine = null, deadline = Infinity
) {
  if (Date.now() > deadline) return prefix + '└── (扫描时间预算已用尽)\n';
  if (depth >= maxDepth) return prefix + '└── ...\n';
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return prefix + '└── (无法读取目录)\n';
  }
  const visible = entries.filter(entry =>
    !entry.name.startsWith('.') &&
    entry.name !== 'node_modules' &&
    entry.name !== 'ai-docs' &&
    entry.name !== 'code-ctx.config.json' &&
    entry.name !== 'code-ctx.config.js' &&
    (!ignoreEngine || !ignoreEngine.ignores(path.join(dir, entry.name)))
  );
  let tree = '';
  for (let index = 0; index < visible.length; index++) {
    const entry = visible[index];
    const isLast = index === visible.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? prefix + '    ' : prefix + '│   ';
    const fullPath = path.join(dir, entry.name);
    tree += `${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}\n`;
    if (entry.isDirectory()) {
      tree += await buildTreeAsync(
        fullPath, childPrefix, depth + 1, maxDepth, ignoreEngine, deadline
      );
    }
  }
  return tree;
}

async function readSample(filePath, bytes) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function scanProjectAsync(projectDir, projectType, options = {}) {
  let projectStat;
  try {
    projectStat = await fs.promises.stat(projectDir);
  } catch {
    projectStat = null;
  }
  if (!projectStat?.isDirectory()) throw new Error(`Directory does not exist: ${projectDir}`);

  const startedAt = Date.now();
  const deadline = startedAt + (options.maxScanTimeMs ?? PROJECT_LIMITS.MAX_SCAN_TIME_MS);
  const maxFiles = options.maxFiles || PROJECT_LIMITS.MAX_FILES_PER_PROJECT;
  const maxTokens = options.maxTokens || PROJECT_LIMITS.MAX_PROJECT_TOKENS;
  const maxScanBytes = options.maxScanBytes ?? PROJECT_LIMITS.MAX_SCAN_BYTES;
  const maxSampleBytes = options.maxSampleBytesPerFile ?? PROJECT_LIMITS.MAX_SAMPLE_BYTES_PER_FILE;
  const concurrency = options.ioConcurrency ?? PROJECT_LIMITS.IO_CONCURRENCY;
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

  const [tree, patternMatches] = await Promise.all([
    buildTreeAsync(projectDir, '', 0, 5, ignoreEngine, deadline),
    Promise.all(patterns.map(pattern => glob(pattern, {
      cwd: projectDir,
      absolute: true,
      nodir: true
    })))
  ]);
  const extracted = registry.extractKeyFiles(projectType, projectDir);
  const candidates = [...new Set(ignoreEngine.filter([...patternMatches.flat(), ...extracted]))];
  const stats = await mapWithConcurrency(candidates, concurrency, async filePath => {
    try {
      const stat = await fs.promises.stat(filePath);
      return stat.isFile() ? { filePath, size: stat.size } : null;
    } catch {
      return null;
    }
  });
  const existing = stats.filter(Boolean);
  const prioritized = existing.slice().sort((a, b) => {
    const aScore = registry.getFilePriority(projectType, a.filePath);
    const bScore = registry.getFilePriority(projectType, b.filePath);
    return aScore - bScore || a.size - b.size || a.filePath.localeCompare(b.filePath);
  }).slice(0, maxFiles);

  let plannedBytes = 0;
  const planned = [];
  const skipped = [];
  for (const item of prioritized) {
    const sampleBytes = Math.min(item.size, maxSampleBytes);
    if (plannedBytes + sampleBytes > maxScanBytes || Date.now() > deadline) {
      skipped.push({ path: item.filePath, reason: Date.now() > deadline ? 'time-budget' : 'byte-budget' });
      continue;
    }
    plannedBytes += sampleBytes;
    planned.push({ ...item, sampleBytes });
  }
  const sampled = await mapWithConcurrency(planned, concurrency, async item => ({
    ...item,
    content: await readSample(item.filePath, item.sampleBytes)
  }));

  let tokens = 0;
  const selected = [];
  for (const item of sampled) {
    const sampleTokens = estimateTokensForContent(item.content);
    const estimated = item.sampleBytes < item.size && item.sampleBytes > 0
      ? Math.ceil(sampleTokens * (item.size / item.sampleBytes))
      : sampleTokens;
    if (tokens + estimated > maxTokens) {
      skipped.push({ path: item.filePath, reason: 'token-budget', estimatedTokens: estimated });
      continue;
    }
    tokens += estimated;
    selected.push(item);
  }

  let remainingChars = Math.max(0, maxSourceChars);
  const sourceFiles = await mapWithConcurrency(selected, concurrency, async item => {
    const safe = filterSensitive(item.content);
    const originalChars = safe.content.length;
    const includedChars = Math.min(originalChars, maxSourceFileChars, remainingChars);
    remainingChars -= includedChars;
    return {
      path: path.relative(projectDir, item.filePath).split(path.sep).join('/'),
      language: detectLanguage(item.filePath),
      hash: await hashFile(item.filePath),
      hashAlgorithm: 'sha256',
      content: safe.content.slice(0, includedChars),
      redactions: safe.count,
      truncation: {
        truncated: includedChars < originalChars || item.sampleBytes < item.size,
        originalChars: item.sampleBytes < item.size ? item.size : originalChars,
        includedChars,
        reason: item.sampleBytes < item.size ? 'sample-limit' :
          (includedChars < originalChars ? 'file-limit' : null)
      }
    };
  });

  return {
    tree,
    keyFiles: selected.map(item => item.filePath),
    sourceFiles,
    promptHints: registry.getPromptHints(projectType),
    totalFiles: candidates.length,
    limitedTo: selected.length,
    estimatedTokens: tokens,
    scanBudget: {
      elapsedMs: Date.now() - startedAt,
      sampledBytes: plannedBytes,
      skipped
    }
  };
}

module.exports = { scanProject, scanProjectAsync, estimateTokens };
