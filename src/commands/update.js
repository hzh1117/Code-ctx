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

/**
 * Execute section-level updates by calling AI and writing back.
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

  // Group updates by doc to avoid concurrent writes to same file
  const updatesByDoc = {};
  for (const update of sectionUpdates) {
    if (!updatesByDoc[update.docName]) updatesByDoc[update.docName] = [];
    updatesByDoc[update.docName].push(update);
  }

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

    // Backup before modifying
    const backupPath = docPath + '.bak';
    try {
      fs.copyFileSync(docPath, backupPath);
    } catch (err) {
      console.warn(`  ⚠ 备份 ${docName} 失败: ${err.message}`);
    }

    const sectionResults = [];
    for (const update of updates) {
      try {
        console.log(`  调用 AI 更新 ${docName} > ${update.sectionName}...`);
        const newContent = await generateWithAI(update.prompt, aiConfig);
        const safeContent = filterSensitive(newContent).content;
        sectionResults.push({ sectionName: update.sectionName, newContent: safeContent });
        results.push({ docName, sectionName: update.sectionName, status: 'success' });
        success++;
      } catch (err) {
        console.error(`  ✗ ${docName} > ${update.sectionName} 更新失败: ${err.message}`);
        results.push({ docName, sectionName: update.sectionName, status: 'failed', reason: err.message });
        failed++;
      }
    }

    // Apply all successful section updates to the doc
    if (sectionResults.length > 0) {
      try {
        applySectionUpdates(docPath, sectionResults);
        console.log(`  ✓ ${docName} 已更新 ${sectionResults.length} 个 section`);
      } catch (err) {
        console.error(`  ✗ 写入 ${docName} 失败: ${err.message}`);
        // Restore from backup
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
  const lastScanPath = path.join(rootDir, 'ai-docs', STATE_FILES.LAST_SCAN);
  const useGit = hasGitRepo(rootDir);
  let changedFiles = [];
  let detectionMethod = 'hash';

  let gitFailed = false;

  if (useGit) {
    // Git mode: use git diff
    const lastCommit = getLastScanCommit(rootDir);
    if (lastCommit) {
      const diffFiles = getChangedFilesSince(rootDir, lastCommit);
      if (diffFiles !== null) {
        changedFiles = diffFiles;
        // Also include untracked files
        const untracked = getUntrackedFiles(rootDir);
        const ignoreDirs = ['node_modules', '.git', 'dist', 'ai-docs'];
        const filteredUntracked = untracked.filter(f => {
          const topDir = f.replace(/\\/g, '/').split('/')[0];
          return !ignoreDirs.includes(topDir);
        });
        changedFiles = [...new Set([...changedFiles, ...filteredUntracked])];
        detectionMethod = 'git-diff';
      } else {
        gitFailed = true;
      }
    } else {
      // First run with git: get all untracked + modified tracked files
      const untracked = getUntrackedFiles(rootDir);
      const modified = getChangedFilesWorkingTree(rootDir) || [];
      const ignoreDirs = ['node_modules', '.git', 'dist', 'ai-docs'];
      const allFiles = [...new Set([...untracked, ...modified])];
      changedFiles = allFiles.filter(f => {
        const topDir = f.replace(/\\/g, '/').split('/')[0];
        return !ignoreDirs.includes(topDir);
      });
      detectionMethod = 'git-first-run';
    }
  }

  // Fallback to hash-based detection if git not available, failed, or returned nothing
  if (changedFiles.length === 0 && (!useGit || gitFailed)) {
    let lastScan = { timestamp: null, files: {} };
    if (fs.existsSync(lastScanPath)) {
      try {
        lastScan = JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
      } catch {}
    }

    const currentFiles = {};
    const files = getAllFiles(rootDir);
    for (const file of files) {
      const relativePath = path.relative(rootDir, file);
      currentFiles[relativePath] = getFileHash(file);
    }

    for (const [file, hash] of Object.entries(currentFiles)) {
      if (lastScan.files[file] !== hash) {
        changedFiles.push(file);
      }
    }
    detectionMethod = 'hash';
  }

  // Build section-aware update prompts
  const sectionUpdates = buildSectionUpdatePrompts(rootDir, changedFiles);

  // Fallback: if no sections found, build a single full-doc prompt
  let prompt = null;
  if (sectionUpdates.length === 0 && changedFiles.length > 0) {
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
    prompt = renderTemplate(tpl, { projectSections: projectSections.join('\n\n') });
  }

  if (!options.dryRun) {
    const newScan = {
      timestamp: new Date().toISOString(),
      lastCommitHash: useGit ? getCurrentCommitHash(rootDir) : null,
      files: changedFiles.reduce((acc, f) => {
        const absPath = path.join(rootDir, f);
        if (fs.existsSync(absPath)) {
          acc[f] = getFileHash(absPath);
        }
        return acc;
      }, {})
    };
    // Preserve existing file hashes for unchanged files
    if (fs.existsSync(lastScanPath)) {
      try {
        const oldScan = JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
        newScan.files = { ...oldScan.files, ...newScan.files };
      } catch {}
    }
    fs.writeFileSync(lastScanPath, JSON.stringify(newScan, null, 2));
  }

  return { changedFiles, prompt, sectionUpdates, detectionMethod };
}

module.exports = { updateCommand, applySectionUpdates, executeUpdates };
