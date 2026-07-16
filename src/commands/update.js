const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extractSection, replaceSection, listSections } = require('../core/section');
const { readFileUTF8, isWithinDir } = require('../utils/file-reader');
const { renderTemplate, loadTemplate } = require('../template/engine');
const { STATE_FILES, UPDATE_LIMITS } = require('../utils/constants');
const { generateWithAI } = require('../ai/client');
const { isAICancellationError } = require('../ai/errors');
const { filterSensitive } = require('../utils/sensitive-filter');
const {
  hasGitRepo,
  getCurrentCommitHash,
  getChangedFilesAgainst,
  getFileDiff,
  getUntrackedFiles,
  getLastScanCommit
} = require('../utils/git-utils');
const {
  findRelatedDoc, groupChangesByProject, resolveProjectForFile
} = require('../core/doc-resolver');
const { initPlugins } = require('../plugins/loader');
const { addTask } = require('../utils/task-history');
const { createIgnoreEngine } = require('../utils/ignore-engine');

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

function getAllFiles(dir, ignoreEngine) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (ignoreEngine.ignores(fullPath)) continue;
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, ignoreEngine));
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

function filterIgnored(files, ignoreEngine) {
  return ignoreEngine.filter(files);
}

function getProjectFromPath(filePath) {
  return String(filePath).replace(/\\/g, '/').split('/')[0] || '.';
}

function detectFromGit(rootDir, ignoreEngine) {
  const lastCommit = getLastScanCommit(rootDir);
  const baseRef = lastCommit || 'HEAD';
  const diffFiles = getChangedFilesAgainst(rootDir, baseRef);
  if (diffFiles === null) {
    return { changedFiles: [], changes: [], detectionMethod: null, gitFailed: true };
  }

  const lastScan = loadLastScan(path.join(rootDir, 'ai-docs', STATE_FILES.LAST_SCAN));
  const processedChanges = lastScan.processedChanges || {};
  const untracked = filterIgnored(getUntrackedFiles(rootDir), ignoreEngine);
  const untrackedSet = new Set(untracked);
  const candidates = filterIgnored([
    ...new Set([...diffFiles, ...untracked, ...Object.keys(processedChanges)])
  ], ignoreEngine);
  const changedFiles = candidates.filter(file => {
    const processed = processedChanges[file];
    if (!processed) return true;
    const absPath = path.join(rootDir, file);
    if (!fs.existsSync(absPath)) return processed.status !== 'deleted';
    try {
      return processed.status === 'deleted' || processed.hash !== getFileHash(absPath);
    } catch {
      return true;
    }
  });
  const changes = changedFiles.map(file => ({
    path: file,
    project: getProjectFromPath(file),
    status: untrackedSet.has(file) ? 'added' : (fs.existsSync(path.join(rootDir, file)) ? 'modified' : 'deleted')
  }));

  return {
    changedFiles,
    changes,
    detectionMethod: lastCommit ? 'git-diff' : 'git-first-run',
    gitBaseRef: baseRef,
    gitFailed: false
  };
}

function detectFromHash(rootDir, lastScanPath, ignoreEngine) {
  const lastScan = loadLastScan(lastScanPath);
  const currentFiles = {};
  const files = getAllFiles(rootDir, ignoreEngine);

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

  const changes = [];
  for (const [file, entry] of Object.entries(currentFiles)) {
    const prev = normalizeFileEntry(lastScan.files && lastScan.files[file]);
    if (prev.hash !== entry.hash) {
      changes.push({
        path: file,
        project: getProjectFromPath(file),
        status: prev.hash ? 'modified' : 'added',
        oldHash: prev.hash,
        newHash: entry.hash
      });
    }
  }

  for (const [file, oldEntry] of Object.entries(lastScan.files || {})) {
    if (!Object.prototype.hasOwnProperty.call(currentFiles, file)) {
      changes.push({
        path: file,
        project: getProjectFromPath(file),
        status: 'deleted',
        oldHash: normalizeFileEntry(oldEntry).hash,
        newHash: null
      });
    }
  }

  return {
    changedFiles: changes.map(change => change.path),
    changes,
    detectionMethod: 'hash',
    hashScanState: currentFiles
  };
}

function detectChangedFiles(rootDir, lastScanPath, ignoreEngine = createIgnoreEngine(rootDir)) {
  const useGit = hasGitRepo(rootDir);

  if (useGit) {
    const gitResult = detectFromGit(rootDir, ignoreEngine);
    if (!gitResult.gitFailed) {
      return { ...gitResult, useGit, hashScanState: null };
    }
  }

  // Hash fallback: triggered when !useGit, or git mode failed.
  const hashResult = detectFromHash(rootDir, lastScanPath, ignoreEngine);
  return { ...hashResult, useGit };
}

function saveLastScan(rootDir, lastScanPath, changedFiles, useGit, hashScanState) {
  // Start from previously-stored entries (normalized to new format) so
  // unchanged files keep their metadata; then layer in fresh entries.
  let finalFiles = {};
  const oldScan = loadLastScan(lastScanPath);
  const processedChanges = useGit ? { ...(oldScan.processedChanges || {}) } : {};
  if (!hashScanState && oldScan && oldScan.files && typeof oldScan.files === 'object') {
    for (const [file, entry] of Object.entries(oldScan.files)) {
      finalFiles[file] = normalizeFileEntry(entry);
    }
  }

  if (hashScanState) {
    // Hash mode already walked every file — use it as the authoritative state.
    finalFiles = { ...hashScanState };
  } else {
    // Git mode: only refresh entries for files git reported as changed.
    for (const f of changedFiles) {
      const absPath = path.join(rootDir, f);
      if (!fs.existsSync(absPath)) {
        delete finalFiles[f];
        processedChanges[f] = { status: 'deleted', hash: null };
        continue;
      }
      try {
        const stat = fs.statSync(absPath);
        const hash = getFileHash(absPath);
        finalFiles[f] = { mtimeMs: stat.mtimeMs, hash };
        processedChanges[f] = { status: 'present', hash };
      } catch (err) {
        console.debug(`[update] stat/hash skipped for ${f}: ${err.message}`);
      }
    }
  }

  const newScan = {
    timestamp: new Date().toISOString(),
    lastCommitHash: useGit ? getCurrentCommitHash(rootDir) : null,
    files: finalFiles,
    ...(useGit ? { processedChanges } : {})
  };
  fs.writeFileSync(lastScanPath, JSON.stringify(newScan, null, 2));
}

function getUpdateStatePath(rootDir) {
  return path.join(rootDir, 'ai-docs', STATE_FILES.UPDATE_STATE);
}

function loadUpdateState(rootDir) {
  const statePath = getUpdateStatePath(rootDir);
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function saveUpdateState(rootDir, state) {
  fs.writeFileSync(getUpdateStatePath(rootDir), JSON.stringify(state, null, 2));
}

function getSectionKey(docName, sectionName) {
  return `${docName}#${sectionName}`;
}

function buildChangeSetId(changes) {
  const normalized = changes.map(change => ({
    path: change.path,
    project: change.project,
    status: change.status,
    oldHash: change.oldHash || null,
    newHash: change.newHash || null,
    evidenceHash: change.evidenceHash || crypto.createHash('sha256').update(change.evidence || '').digest('hex')
  })).sort((a, b) => a.path.localeCompare(b.path) || a.status.localeCompare(b.status));
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function prepareUpdateState(
  rootDir, changeSetId, changes, sectionUpdates, detectionMethod, confirmations = []
) {
  const previous = loadUpdateState(rootDir);
  const canResume = previous?.changeSetId === changeSetId;
  const sections = {};

  for (const update of sectionUpdates) {
    const key = getSectionKey(update.docName, update.sectionName);
    const oldSection = canResume ? previous.sections?.[key] : null;
    sections[key] = oldSection || {
      docName: update.docName,
      sectionName: update.sectionName,
      status: 'pending',
      error: null
    };
  }

  return {
    changeSetId,
    detectedAt: canResume ? previous.detectedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    detectionMethod,
    changes: changes.map(({ path: filePath, project, status, oldHash, newHash }) => ({
      path: filePath,
      project,
      status,
      oldHash: oldHash || null,
      newHash: newHash || null
    })),
    sections,
    confirmations
  };
}

function readCurrentSourceEvidence(rootDir, filePath) {
  const absPath = path.join(rootDir, filePath);
  if (!isWithinDir(absPath, rootDir) || !fs.existsSync(absPath)) return '';
  try {
    return readFileUTF8(absPath);
  } catch {
    return '';
  }
}

function attachChangeEvidence(rootDir, changes, options = {}) {
  const maxFileChars = Math.max(0, options.maxFileChars ?? UPDATE_LIMITS.MAX_FILE_EVIDENCE_CHARS);

  return changes.map(change => {
    let evidenceType = 'source';
    let rawEvidence = '';

    if (change.status === 'deleted') {
      rawEvidence = options.gitBaseRef
        ? (getFileDiff(rootDir, options.gitBaseRef, change.path) || '')
        : '';
      evidenceType = rawEvidence ? 'patch' : 'deletion';
      if (!rawEvidence) rawEvidence = 'File deleted from the current project.';
    } else if (options.gitBaseRef && change.status !== 'added') {
      rawEvidence = getFileDiff(rootDir, options.gitBaseRef, change.path) || '';
      evidenceType = rawEvidence ? 'patch' : 'source';
    }

    if (!rawEvidence && change.status !== 'deleted') {
      rawEvidence = readCurrentSourceEvidence(rootDir, change.path);
      evidenceType = 'source';
    }

    const safeEvidence = filterSensitive(rawEvidence).content;
    const includedChars = Math.min(safeEvidence.length, maxFileChars);
    const status = change.status === 'modified' && rawEvidence.includes('new file mode')
      ? 'added'
      : change.status;
    return {
      ...change,
      status,
      evidenceType,
      evidence: safeEvidence.slice(0, includedChars),
      evidenceHash: crypto.createHash('sha256').update(safeEvidence).digest('hex'),
      truncation: {
        truncated: includedChars < safeEvidence.length,
        originalChars: safeEvidence.length,
        includedChars,
        reason: includedChars < safeEvidence.length ? 'file-limit' : null
      }
    };
  });
}

function formatChangeEvidence(change) {
  const metadata = [
    `path=${JSON.stringify(change.path)}`,
    `project=${JSON.stringify(change.project || getProjectFromPath(change.path))}`,
    `status=${JSON.stringify(change.status)}`,
    `evidence=${JSON.stringify(change.evidenceType)}`,
    `truncated=${change.truncation?.truncated === true}`
  ];
  if (change.oldHash) metadata.push(`oldHash=${JSON.stringify(change.oldHash)}`);
  if (change.newHash) metadata.push(`newHash=${JSON.stringify(change.newHash)}`);
  return `<change ${metadata.join(' ')}>\n${change.evidence || ''}\n</change>`;
}

function buildEvidenceChunks(changes, options = {}) {
  const maxTotalChars = options.maxTotalChars ?? UPDATE_LIMITS.MAX_EVIDENCE_CHARS;
  const maxChunkChars = Math.max(1, options.maxChunkChars ?? UPDATE_LIMITS.MAX_EVIDENCE_CHUNK_CHARS);
  const orderedChanges = changes.slice().sort((a, b) => {
    const pathOrder = String(a.path).replace(/\\/g, '/').localeCompare(String(b.path).replace(/\\/g, '/'));
    return pathOrder || String(a.status).localeCompare(String(b.status));
  });
  const serialized = orderedChanges.map(formatChangeEvidence).join('\n\n');
  const included = serialized.slice(0, Math.max(0, maxTotalChars));
  const chunks = [];

  for (let offset = 0; offset < included.length; offset += maxChunkChars) {
    chunks.push(included.slice(offset, offset + maxChunkChars));
  }

  return {
    chunks,
    truncated: included.length < serialized.length,
    originalChars: serialized.length,
    includedChars: included.length
  };
}

function renderEvidenceChunks(bundle) {
  const total = bundle.chunks.length;
  const rendered = bundle.chunks.map((chunk, index) => [
    `--- change-evidence chunk ${index + 1}/${total} ---`,
    chunk
  ].join('\n'));
  if (bundle.truncated) {
    rendered.push(`[change evidence truncated: included ${bundle.includedChars}/${bundle.originalChars} chars]`);
  }
  return rendered.join('\n\n');
}

function selectChanges(changes, files) {
  const fileSet = new Set(files);
  return changes.filter(change => fileSet.has(change.path));
}

function inferSectionsForChange(change) {
  const normalized = change.path.replace(/\\/g, '/').toLowerCase();
  const basename = path.posix.basename(normalized);
  const evidence = String(change.evidence || '').toLowerCase();
  const sections = new Set();
  let recognized = false;

  if (/^(package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|pom\.xml|build\.gradle|go\.mod|cargo\.toml|pyproject\.toml|requirements.*\.txt)$/.test(basename)) {
    sections.add('dependencies');
    recognized = true;
  }
  if (/^(readme|changelog|contributing)(\.|$)/.test(basename)) {
    sections.add('overview');
    sections.add('notes');
    recognized = true;
  }
  if (/(^|\/)(api|routes?|controllers?|handlers?|middleware)(\/|\.|$)/.test(normalized) ||
      /(?:router|app|server)\.(get|post|put|patch|delete)\s*\(/.test(evidence) ||
      /^(app|server|main)\.[cm]?[jt]s$/.test(basename)) {
    sections.add('api');
    sections.add('modules');
    recognized = true;
  }
  if (/(^|\/)(models?|entities|schemas?|migrations?|repositories|store|state|reducers?)(\/|\.|$)/.test(normalized)) {
    sections.add('data');
    sections.add('modules');
    recognized = true;
  }
  if (/(^|\/)(components?|pages?|views?|hooks?|services?|modules?|utils?|lib|src)(\/|\.|$)/.test(normalized) &&
      /\.(js|jsx|ts|tsx|vue|svelte|py|java|kt|go|rs|php|rb|cs|c|cc|cpp)$/.test(normalized)) {
    sections.add('modules');
    recognized = true;
  }
  if (/(^|\/)(config|configs)(\/|\.|$)/.test(normalized) || /^\.env/.test(basename)) {
    sections.add('dependencies');
    sections.add('notes');
    recognized = true;
  }
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)) {
    sections.add('notes');
    recognized = true;
  }
  if (change.status === 'added' || change.status === 'deleted') sections.add('structure');

  return {
    sections: [...sections],
    uncertain: !recognized,
    reason: recognized ? null : '无法从文件类型、路径或符号证据确定受影响 section'
  };
}

/**
 * Build per-section prompts for changed files.
 * Returns an array of { docName, sectionName, prompt } objects.
 */
function buildSectionUpdatePrompts(rootDir, changedFiles, changes, evidenceOptions) {
  const changesByProject = groupChangesByProject(rootDir, changedFiles);
  const sectionUpdates = [];
  const confirmations = [];

  for (const file of changedFiles) {
    if (!resolveProjectForFile(rootDir, file)) {
      confirmations.push({
        projectId: null,
        docName: null,
        files: [file],
        reason: '文件未映射到配置和 manifest 中的任何项目'
      });
    }
  }

  for (const [project, projFiles] of Object.entries(changesByProject)) {
    const relatedDoc = findRelatedDoc(rootDir, projFiles[0]);
    if (!relatedDoc) {
      confirmations.push({ projectId: project, docName: null, files: projFiles, reason: '项目文档不存在' });
      continue;
    }

    const sections = listSections(relatedDoc.content);
    if (sections.length === 0) {
      confirmations.push({
        projectId: project,
        docName: relatedDoc.name,
        files: projFiles,
        reason: '项目文档没有可更新的 section 标记'
      });
      continue;
    }
    const sectionChanges = new Map();
    for (const change of selectChanges(changes, projFiles)) {
      const inference = inferSectionsForChange(change);
      const available = inference.sections.filter(section => sections.includes(section));
      for (const section of available) {
        if (!sectionChanges.has(section)) sectionChanges.set(section, []);
        sectionChanges.get(section).push(change);
      }
      if (inference.uncertain || available.length === 0) {
        confirmations.push({
          projectId: project,
          docName: relatedDoc.name,
          files: [change.path],
          reason: inference.reason || `文档不包含推断出的 section: ${inference.sections.join(', ')}`
        });
      }
    }

    const tpl = loadTemplate('update-prompt.md');
    for (const [sectionName, affectedChanges] of sectionChanges) {
      const sectionContent = extractSection(relatedDoc.content, sectionName);
      if (sectionContent === null) {
        confirmations.push({
          projectId: project,
          docName: relatedDoc.name,
          files: affectedChanges.map(change => change.path),
          reason: `section ${sectionName} 标记格式无效，无法安全替换`
        });
        continue;
      }
      const affectedFiles = affectedChanges.map(change => change.path);
      const projectEvidence = buildEvidenceChunks(affectedChanges, evidenceOptions);
      const renderedEvidence = renderEvidenceChunks(projectEvidence);

      const prompt = renderTemplate(tpl, {
        project,
        sectionName,
        changedFiles: affectedFiles.map(f => `- ${f}`).join('\n'),
        changeEvidence: renderedEvidence,
        sectionContent
      });

      const update = { docName: relatedDoc.name, sectionName, prompt };
      Object.defineProperty(update, '_manualContext', {
        value: {
          project,
          changedFiles: affectedFiles,
          changeEvidence: renderedEvidence,
          sectionContent
        },
        enumerable: false
      });
      sectionUpdates.push(update);
    }
  }

  return { sectionUpdates, confirmations };
}

function buildConfirmationPrompt(confirmations, changes, evidenceOptions) {
  const parts = [
    '以下代码变化无法确定性映射到文档 section，需要先确认影响范围。',
    '请只返回每个文件应影响的文档和 section，不要改写文档内容。'
  ];
  for (const confirmation of confirmations) {
    parts.push('', `## 待确认: ${confirmation.files.join(', ')}`);
    if (confirmation.projectId) parts.push(`项目: ${confirmation.projectId}`);
    if (confirmation.docName) parts.push(`文档: ${confirmation.docName}`);
    parts.push(`原因: ${confirmation.reason}`);
    const evidence = buildEvidenceChunks(
      selectChanges(changes, confirmation.files),
      evidenceOptions
    );
    parts.push('变化证据：', renderEvidenceChunks(evidence));
  }
  return parts.join('\n');
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
  const tempPath = `${docPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, docPath);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // Preserve the original write error.
    }
    throw err;
  }
}

function buildCombinedSectionPrompt(sectionUpdates) {
  const updatesByDoc = groupSectionUpdates(sectionUpdates);
  const parts = [
    '请根据以下变化证据，一次性更新所有列出的文档 section。',
    '只陈述变化证据支持的事实；未受影响内容保持不变。',
    '输出时按文档分组，每个 section 必须使用原 section 名称的 HTML 注释标记包裹。'
  ];

  for (const [docName, updates] of Object.entries(updatesByDoc)) {
    parts.push('', `## 文档: ${docName}`, '待更新 section：');
    for (const update of updates) {
      const updateContext = update._manualContext || {};
      parts.push(
        '',
        `### ${update.sectionName}`,
        `子项目: ${updateContext.project || ''}`,
        '变化文件：',
        ...(updateContext.changedFiles || []).map(file => `- ${file}`),
        '变化证据：',
        updateContext.changeEvidence || '（无可用源码证据）',
        '当前 section：',
        `<!-- section:${update.sectionName} -->`,
        updateContext.sectionContent || '',
        `<!-- /section:${update.sectionName} -->`
      );
    }
  }

  return parts.join('\n');
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
  let writeFailed = 0;
  let restoreFailed = 0;

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
    let backupCreated = false;
    try {
      fs.copyFileSync(docPath, backupPath);
      backupCreated = true;
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
        if (isAICancellationError(err)) throw err;
        console.error(`  ✗ ${docName} > ${update.sectionName} 更新失败: ${err.message}`);
        return { sectionName: update.sectionName, status: 'failed', reason: err.message };
      }
    }));

    const sectionResults = [];
    for (const outcome of sectionOutcomes) {
      if (outcome.status === 'success') {
        sectionResults.push({ sectionName: outcome.sectionName, newContent: outcome.newContent });
      } else {
        results.push({ docName, sectionName: outcome.sectionName, status: 'failed', reason: outcome.reason });
        failed++;
      }
    }

    // Apply all successful section updates to the doc in one write
    if (sectionResults.length > 0) {
      try {
        applySectionUpdates(docPath, sectionResults);
        for (const sectionResult of sectionResults) {
          results.push({ docName, sectionName: sectionResult.sectionName, status: 'success' });
          success++;
        }
        console.log(`  ✓ ${docName} 已更新 ${sectionResults.length} 个 section`);
      } catch (err) {
        writeFailed++;
        let failureReason = `文档写入失败: ${err.message}`;
        console.error(`  ✗ 写入 ${docName} 失败: ${err.message}`);
        if (backupCreated) {
          try {
            fs.copyFileSync(backupPath, docPath);
            console.log(`  ↩ 已从备份恢复 ${docName}`);
          } catch (restoreErr) {
            restoreFailed++;
            failureReason += `; 备份恢复失败: ${restoreErr.message}`;
            console.error(`  ✗ 从备份恢复 ${docName} 失败: ${restoreErr.message}`);
          }
        }
        for (const sectionResult of sectionResults) {
          results.push({
            docName,
            sectionName: sectionResult.sectionName,
            status: 'failed',
            reason: failureReason
          });
          failed++;
        }
      }
    }
  }

  return { success, failed, skipped, writeFailed, restoreFailed, results };
}

function removeUpdateState(rootDir) {
  const statePath = getUpdateStatePath(rootDir);
  if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
}

async function executeUpdateTransaction(rootDir, updateResult, aiConfig) {
  if (!aiConfig || !aiConfig.apiKey) {
    throw new Error('未配置 API Key，无法执行 update 事务');
  }
  const transaction = updateResult && updateResult._stateTransaction;
  if (!transaction) {
    throw new Error('缺少 update 事务上下文，请先调用 updateCommand');
  }

  const storedState = loadUpdateState(rootDir);
  const state = storedState?.changeSetId === transaction.changeSetId
    ? storedState
    : transaction.pendingState;
  const pendingUpdates = updateResult.sectionUpdates.filter(update => {
    const key = getSectionKey(update.docName, update.sectionName);
    return state.sections[key]?.status !== 'success';
  });
  const execution = await executeUpdates(rootDir, pendingUpdates, aiConfig);

  for (const result of execution.results) {
    const key = getSectionKey(result.docName, result.sectionName);
    if (!state.sections[key]) continue;
    state.sections[key] = {
      ...state.sections[key],
      status: result.status === 'success' ? 'success' : 'failed',
      error: result.status === 'success' ? null : (result.reason || result.status)
    };
  }
  state.updatedAt = new Date().toISOString();

  if ((state.confirmations || []).length > 0) {
    state.transactionError = '存在待确认的 section 影响范围，扫描基线未提交';
    saveUpdateState(rootDir, state);
    return {
      ...execution,
      committed: false,
      pendingState: state,
      confirmationRequired: state.confirmations,
      reason: state.transactionError
    };
  }

  const sectionStates = Object.values(state.sections);
  const allSectionsSucceeded = sectionStates.length > 0 &&
    sectionStates.every(section => section.status === 'success');
  saveUpdateState(rootDir, state);

  if (!allSectionsSucceeded) {
    return { ...execution, committed: false, pendingState: state };
  }

  const lastScanPath = path.join(rootDir, 'ai-docs', STATE_FILES.LAST_SCAN);
  const freshDetection = detectChangedFiles(rootDir, lastScanPath);
  const freshChanges = attachChangeEvidence(rootDir, freshDetection.changes, {
    ...transaction.evidenceOptions,
    gitBaseRef: freshDetection.gitBaseRef
  });
  const freshChangeSetId = buildChangeSetId(freshChanges);

  if (freshChangeSetId !== transaction.changeSetId) {
    state.transactionError = '源码在文档生成期间发生变化，扫描基线未提交';
    state.updatedAt = new Date().toISOString();
    saveUpdateState(rootDir, state);
    return {
      ...execution,
      committed: false,
      pendingState: state,
      reason: state.transactionError
    };
  }

  saveLastScan(
    rootDir,
    lastScanPath,
    freshDetection.changedFiles,
    freshDetection.useGit,
    freshDetection.hashScanState
  );
  removeUpdateState(rootDir);
  return { ...execution, committed: true, pendingState: null };
}

async function updateCommand(rootDir, options = {}) {
  if (options.dryRun && options.prepareApply) {
    throw new Error('dry-run 与 apply 不能同时使用');
  }
  initPlugins(rootDir);
  const lastScanPath = path.join(rootDir, 'ai-docs', STATE_FILES.LAST_SCAN);

  const { changedFiles, changes, detectionMethod, useGit, hashScanState, gitBaseRef } =
    detectChangedFiles(rootDir, lastScanPath);

  const evidenceOptions = {
    maxFileChars: options.maxEvidenceFileChars,
    maxTotalChars: options.maxEvidenceChars,
    maxChunkChars: options.maxEvidenceChunkChars
  };
  const changesWithEvidence = attachChangeEvidence(rootDir, changes, {
    ...evidenceOptions,
    gitBaseRef
  });
  const evidenceChunks = buildEvidenceChunks(changesWithEvidence, evidenceOptions);
  const impactPlan = buildSectionUpdatePrompts(
    rootDir,
    changedFiles,
    changesWithEvidence,
    evidenceOptions
  );
  let sectionUpdates = impactPlan.sectionUpdates;
  const confirmationRequired = impactPlan.confirmations;

  const updatePrompt = sectionUpdates.length > 0
    ? buildCombinedSectionPrompt(sectionUpdates)
    : null;
  const confirmationPrompt = confirmationRequired.length > 0
    ? buildConfirmationPrompt(confirmationRequired, changesWithEvidence, evidenceOptions)
    : null;
  const promptParts = [updatePrompt, confirmationPrompt].filter(Boolean);
  const prompt = promptParts.length > 0 ? promptParts.join('\n\n') : null;
  if (changedFiles.length > 0 && (typeof prompt !== 'string' || prompt.trim() === '')) {
    throw new Error('update 生成了空 Prompt');
  }

  const changeSetId = buildChangeSetId(changesWithEvidence);
  const pendingState = prepareUpdateState(
    rootDir,
    changeSetId,
    changesWithEvidence,
    sectionUpdates,
    detectionMethod,
    confirmationRequired
  );
  sectionUpdates = sectionUpdates.map(update => ({
    ...update,
    status: pendingState.sections[getSectionKey(update.docName, update.sectionName)]?.status || 'pending'
  }));

  if (options.prepareApply === true && !options.dryRun) {
    if (changedFiles.length > 0) {
      saveUpdateState(rootDir, pendingState);
    } else {
      removeUpdateState(rootDir);
    }
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

  const result = {
    changedFiles,
    changes: changesWithEvidence,
    evidenceChunks,
    prompt,
    sectionUpdates,
    confirmationRequired,
    detectionMethod,
    changeSetId
  };
  Object.defineProperty(result, '_stateTransaction', {
    value: {
      changeSetId,
      evidenceOptions,
      pendingState,
      useGit,
      hashScanState
    },
    enumerable: false
  });
  return result;
}

module.exports = {
  updateCommand,
  applySectionUpdates,
  executeUpdates,
  executeUpdateTransaction,
  buildEvidenceChunks,
  getFileHash,
  normalizeFileEntry
};
