const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extractSection, replaceSection, listSections } = require('../core/section');
const { readFileUTF8, isWithinDir } = require('../utils/file-reader');
const { renderTemplate, loadTemplate } = require('../template/engine');
const { STATE_FILES } = require('../utils/constants');
const { generateWithAI } = require('../ai/client');
const { filterSensitive } = require('../utils/sensitive-filter');
const { hasGitRepo, getCurrentCommitHash, getChangedFilesSince, getChangedFilesWorkingTree, getUntrackedFiles, getLastScanCommit } = require('../utils/git-utils');
const { findRelatedDoc, groupChangesByProject } = require('../core/doc-resolver');
const { initPlugins } = require('../plugins/loader');
const { addTask } = require('../utils/task-history');

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'ai-docs'];

function getFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

// Backward-compatible: old .last-scan stored value as raw hash string;
// new format stores { mtimeMs, hash } so we can skip hash recomputation when mtime unchanged.
function normalizeFileEntry(entry) {
  if (typeof entry === 'string') {
    return { mtimeMs: null, hash: entry };
  }
  if (entry && typeof entry === 'object') {
    return {
      mtimeMs: typeof entry.mtimeMs === 'number' ? entry.mtimeMs : null,
      hash: typeof entry.hash === 'string' ? entry.hash : null
    };
  }
  return { mtimeMs: null, hash: null };
}

function getAllFiles(dir, ignoreDirs = IGNORE_DIRS) {
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

function loadLastScan(lastScanPath) {
  if (!fs.existsSync(lastScanPath)) {
    return { timestamp: null, files: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
  } catch {
    return { timestamp: null, files: {} };
  }
}

function filterIgnored(files) {
  return files.filter(f => {
    const topDir = f.replace(/\\/g, '/').split('/')[0];
    return !IGNORE_DIRS.includes(topDir);
  });
}

function detectFromGit(rootDir) {
  const lastCommit = getLastScanCommit(rootDir);

  if (lastCommit) {
    const diffFiles = getChangedFilesSince(rootDir, lastCommit);
    if (diffFiles === null) {
      return { changedFiles: [], detectionMethod: null, gitFailed: true };
    }
    const untracked = filterIgnored(getUntrackedFiles(rootDir));
    return {
      changedFiles: [...new Set([...diffFiles, ...untracked])],
      detectionMethod: 'git-diff',
      gitFailed: false
    };
  }

  // First run with git: collect all untracked + modified tracked files
  const untracked = getUntrackedFiles(rootDir);
  const modified = getChangedFilesWorkingTree(rootDir) || [];
  return {
    changedFiles: filterIgnored([...new Set([...untracked, ...modified])]),
    detectionMethod: 'git-first-run',
    gitFailed: false
  };
}

function detectFromHash(rootDir, lastScanPath) {
  const lastScan = loadLastScan(lastScanPath);
  const currentFiles = {};
  const files = getAllFiles(rootDir);

  for (const file of files) {
    const relativePath = path.relative(rootDir, file);
    const prev = normalizeFileEntry(lastScan.files && lastScan.files[relativePath]);
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    // Skip hash computation when mtime matches and we have a cached hash.
    // Tradeoff: a content change that preserves mtime (rare in practice)
    // would be missed; the speedup on unchanged trees is worth it.
    if (prev.mtimeMs !== null && prev.hash && stat.mtimeMs === prev.mtimeMs) {
      currentFiles[relativePath] = { mtimeMs: stat.mtimeMs, hash: prev.hash };
    } else {
      currentFiles[relativePath] = { mtimeMs: stat.mtimeMs, hash: getFileHash(file) };
    }
  }

  const changedFiles = [];
  for (const [file, entry] of Object.entries(currentFiles)) {
    const prev = normalizeFileEntry(lastScan.files && lastScan.files[file]);
    if (prev.hash !== entry.hash) {
      changedFiles.push(file);
    }
  }
  return { changedFiles, detectionMethod: 'hash', hashScanState: currentFiles };
}

function detectChangedFiles(rootDir, lastScanPath) {
  const useGit = hasGitRepo(rootDir);

  if (useGit) {
    const gitResult = detectFromGit(rootDir);
    if (!gitResult.gitFailed) {
      return { ...gitResult, useGit, hashScanState: null };
    }
  }

  // Hash fallback: triggered when !useGit, or git mode failed.
  const hashResult = detectFromHash(rootDir, lastScanPath);
  return { ...hashResult, useGit };
}

function saveLastScan(rootDir, lastScanPath, changedFiles, useGit, hashScanState) {
  // Start from previously-stored entries (normalized to new format) so
  // unchanged files keep their metadata; then layer in fresh entries.
  const finalFiles = {};
  const oldScan = loadLastScan(lastScanPath);
  if (oldScan && oldScan.files && typeof oldScan.files === 'object') {
    for (const [file, entry] of Object.entries(oldScan.files)) {
      finalFiles[file] = normalizeFileEntry(entry);
    }
  }

  if (hashScanState) {
    // Hash mode already walked every file — use it as the authoritative state.
    for (const [file, entry] of Object.entries(hashScanState)) {
      finalFiles[file] = entry;
    }
  } else {
    // Git mode: only refresh entries for files git reported as changed.
    for (const f of changedFiles) {
      const absPath = path.join(rootDir, f);
      if (!fs.existsSync(absPath)) continue;
      try {
        const stat = fs.statSync(absPath);
        finalFiles[f] = { mtimeMs: stat.mtimeMs, hash: getFileHash(absPath) };
      } catch (err) {
        console.debug(`[update] stat/hash skipped for ${f}: ${err.message}`);
      }
    }
  }

  const newScan = {
    timestamp: new Date().toISOString(),
    lastCommitHash: useGit ? getCurrentCommitHash(rootDir) : null,
    files: finalFiles
  };
  fs.writeFileSync(lastScanPath, JSON.stringify(newScan, null, 2));
}

/**
 * Build per-section prompts for changed files.
 * Returns an array of { docName, sectionName, prompt } objects.
 */
function buildSectionUpdatePrompts(rootDir, changedFiles) {
  const changesByProject = groupChangesByProject(changedFiles);
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

      sectionUpdates.push({ docName: relatedDoc.name, sectionName, prompt });
    }
  }

  return sectionUpdates;
}

function buildFullDocPrompt(rootDir, changedFiles) {
  const changesByProject = groupChangesByProject(changedFiles);
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
  return renderTemplate(tpl, { projectSections: projectSections.join('\n\n') });
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

function groupSectionUpdates(sectionUpdates) {
  const updatesByDoc = {};
  for (const update of sectionUpdates) {
    if (!updatesByDoc[update.docName]) updatesByDoc[update.docName] = [];
    updatesByDoc[update.docName].push(update);
  }
  return updatesByDoc;
}

/**
 * Execute section-level updates by calling AI and writing back.
 * Sections within the same doc are requested in parallel; results are
 * applied in a single atomic write per doc. A .bak backup is taken
 * before writing so the original can be restored on write failure.
 *
 * @param {string} rootDir
 * @param {Array<{docName: string, sectionName: string, prompt: string}>} sectionUpdates
 * @param {object} aiConfig - AI config from getAIConfig
 * @returns {{ success: number, failed: number, skipped: number, results: Array }}
 */
async function executeUpdates(rootDir, sectionUpdates, aiConfig) {
  const aiDocsDir = path.join(rootDir, 'ai-docs');
  const results = [];
  let success = 0;
  let failed = 0;
  let skipped = 0;

  const updatesByDoc = groupSectionUpdates(sectionUpdates);

  for (const [docName, updates] of Object.entries(updatesByDoc)) {
    const docPath = path.join(aiDocsDir, docName);
    if (!isWithinDir(docPath, aiDocsDir)) {
      for (const u of updates) {
        results.push({ docName, sectionName: u.sectionName, status: 'skipped', reason: '非法文档路径' });
        skipped++;
      }
      continue;
    }
    if (!fs.existsSync(docPath)) {
      for (const u of updates) {
        results.push({ docName, sectionName: u.sectionName, status: 'skipped', reason: '文件不存在' });
        skipped++;
      }
      continue;
    }

    // Backup before modifying so we can restore on write failure
    const backupPath = docPath + '.bak';
    try {
      fs.copyFileSync(docPath, backupPath);
    } catch (err) {
      console.warn(`  ⚠ 备份 ${docName} 失败: ${err.message}`);
    }

    // Concurrent AI calls within this doc — each section catches its own error
    // so Promise.all never rejects and partial failures don't abort the others.
    const sectionOutcomes = await Promise.all(updates.map(async (update) => {
      console.log(`  调用 AI 更新 ${docName} > ${update.sectionName}...`);
      try {
        const newContent = await generateWithAI(update.prompt, aiConfig);
        const safeContent = filterSensitive(newContent).content;
        return { sectionName: update.sectionName, status: 'success', newContent: safeContent };
      } catch (err) {
        console.error(`  ✗ ${docName} > ${update.sectionName} 更新失败: ${err.message}`);
        return { sectionName: update.sectionName, status: 'failed', reason: err.message };
      }
    }));

    const sectionResults = [];
    for (const outcome of sectionOutcomes) {
      if (outcome.status === 'success') {
        sectionResults.push({ sectionName: outcome.sectionName, newContent: outcome.newContent });
        results.push({ docName, sectionName: outcome.sectionName, status: 'success' });
        success++;
      } else {
        results.push({ docName, sectionName: outcome.sectionName, status: 'failed', reason: outcome.reason });
        failed++;
      }
    }

    // Apply all successful section updates to the doc in one write
    if (sectionResults.length > 0) {
      try {
        applySectionUpdates(docPath, sectionResults);
        console.log(`  ✓ ${docName} 已更新 ${sectionResults.length} 个 section`);
      } catch (err) {
        console.error(`  ✗ 写入 ${docName} 失败: ${err.message}`);
        if (fs.existsSync(backupPath)) {
          try {
            fs.copyFileSync(backupPath, docPath);
            console.log(`  ↩ 已从备份恢复 ${docName}`);
          } catch (restoreErr) {
            console.error(`  ✗ 从备份恢复 ${docName} 失败: ${restoreErr.message}`);
          }
        }
      }
    }
  }

  return { success, failed, skipped, results };
}

async function updateCommand(rootDir, options = {}) {
  initPlugins(rootDir);
  const lastScanPath = path.join(rootDir, 'ai-docs', STATE_FILES.LAST_SCAN);

  const { changedFiles, detectionMethod, useGit, hashScanState } =
    detectChangedFiles(rootDir, lastScanPath);

  const sectionUpdates = buildSectionUpdatePrompts(rootDir, changedFiles);

  const prompt = sectionUpdates.length === 0 && changedFiles.length > 0
    ? buildFullDocPrompt(rootDir, changedFiles)
    : null;

  if (!options.dryRun) {
    saveLastScan(rootDir, lastScanPath, changedFiles, useGit, hashScanState);
  }

  try {
    addTask(rootDir, {
      source: 'update',
      task: options.dryRun ? 'update (dry-run)' : 'update',
      changedFiles: changedFiles.length,
      detectionMethod,
      ...(prompt ? { prompt } : {})
    });
  } catch (err) {
    // History writes are best-effort.
    if (process.env.AI_DEBUG === 'true') {
      console.debug('[update] addTask failed:', err.message);
    }
  }

  return { changedFiles, prompt, sectionUpdates, detectionMethod };
}

module.exports = { updateCommand, applySectionUpdates, executeUpdates, getFileHash, normalizeFileEntry };
