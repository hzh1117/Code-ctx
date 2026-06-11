const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const { loadProjectConfig } = require('./config');
const { filterSensitive } = require('./sensitive-filter');
const { STATE_FILES } = require('./constants');

// Rotation thresholds. JSONL grows linearly with `use`/`update` calls, so
// we cap both the entry count and the file size to keep dashboards snappy
// and to prevent the file from leaking unbounded prompt previews over time.
const MAX_ENTRIES = 200;
const MAX_FILE_BYTES = 256 * 1024;
const PREVIEW_CHARS = 120;

function getHistoryPath(rootDir) {
  const config = loadProjectConfig(rootDir);
  const outputDir = config.outputDir || 'ai-docs';
  return path.join(rootDir, outputDir, STATE_FILES.TASK_HISTORY);
}

function shortId() {
  return nodeCrypto.randomBytes(6).toString('hex');
}

function hashPrompt(prompt) {
  return nodeCrypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

function makePreview(prompt) {
  const safe = filterSensitive(prompt).content;
  // Single-line preview so JSONL stays one entry per line.
  const compact = safe.replace(/\s+/g, ' ').trim();
  return compact.length <= PREVIEW_CHARS ? compact : compact.slice(0, PREVIEW_CHARS) + '...';
}

function ensureHistoryFile(historyPath) {
  const dir = path.dirname(historyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Trim the file if it exceeds either threshold by keeping the most recent
// MAX_ENTRIES entries that fit under MAX_FILE_BYTES. Rewrites in-place.
function rotateIfNeeded(historyPath) {
  let stat;
  try {
    stat = fs.statSync(historyPath);
  } catch {
    return;
  }
  if (stat.size <= MAX_FILE_BYTES) {
    // Still need to check count if file is short of byte cap.
    const lines = readLines(historyPath);
    if (lines.length <= MAX_ENTRIES) return;
    rewriteWithLatest(historyPath, lines, MAX_ENTRIES);
    return;
  }
  const lines = readLines(historyPath);
  rewriteWithLatest(historyPath, lines, MAX_ENTRIES);
}

function readLines(historyPath) {
  const content = fs.readFileSync(historyPath, 'utf8');
  return content.split('\n').filter(line => line.trim().length > 0);
}

function rewriteWithLatest(historyPath, lines, keep) {
  const latest = lines.slice(-keep);
  // Defensive: if even the trimmed set is over the byte cap, drop oldest
  // entries one at a time until under cap.
  let buffer = latest.join('\n') + '\n';
  while (Buffer.byteLength(buffer, 'utf8') > MAX_FILE_BYTES && latest.length > 1) {
    latest.shift();
    buffer = latest.join('\n') + '\n';
  }
  fs.writeFileSync(historyPath, buffer);
}

// Whitelisted fields we accept on the public API. Anything else gets
// dropped so callers can't accidentally leak unrelated state into the
// history file.
const ALLOWED_FIELDS = new Set([
  'task', 'scenario', 'scenarioName', 'projects', 'relatedProjects',
  'matchMethod', 'confidence', 'promptPath', 'changedFiles',
  'detectionMethod', 'source'
]);

function sanitizeEntry(taskData) {
  const out = {};
  for (const key of Object.keys(taskData || {})) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    out[key] = taskData[key];
  }
  return out;
}

function addTask(rootDir, taskData = {}) {
  const historyPath = getHistoryPath(rootDir);
  ensureHistoryFile(historyPath);

  const sanitized = sanitizeEntry(taskData);
  const entry = {
    id: shortId(),
    timestamp: new Date().toISOString(),
    ...sanitized
  };

  // If the caller hands us a prompt, do NOT persist it: store hash, length,
  // and a redacted single-line preview. Full text stays in caller hands.
  if (typeof taskData.prompt === 'string' && taskData.prompt.length > 0) {
    entry.promptHash = hashPrompt(taskData.prompt);
    entry.promptLength = taskData.prompt.length;
    entry.promptPreview = makePreview(taskData.prompt);
  }

  fs.appendFileSync(historyPath, JSON.stringify(entry) + '\n');
  rotateIfNeeded(historyPath);
  return entry;
}

function getHistory(rootDir) {
  const historyPath = getHistoryPath(rootDir);
  if (!fs.existsSync(historyPath)) return [];

  const content = fs.readFileSync(historyPath, 'utf8');
  const entries = [];
  for (const line of content.trim().split('\n')) {
    if (!line) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Corrupt line — skip rather than fail the whole read.
    }
  }
  return entries;
}

function getRecentHistory(rootDir, limit = 20) {
  const all = getHistory(rootDir);
  return all.slice(-limit).reverse();
}

// Naive line diff used for prompt-comparison summaries. Returns counts and
// up to N changed lines on each side so the diff fits in a JSON payload.
// Intentionally simple — we don't ship a diff library for this MVP.
function diffPrompts(a = '', b = '', { maxLines = 40 } = {}) {
  const aLines = a.split(/\r?\n/);
  const bLines = b.split(/\r?\n/);
  const aSet = new Set(aLines);
  const bSet = new Set(bLines);

  const removed = aLines.filter(l => !bSet.has(l));
  const added = bLines.filter(l => !aSet.has(l));

  return {
    addedCount: added.length,
    removedCount: removed.length,
    aLength: a.length,
    bLength: b.length,
    addedSample: added.slice(0, maxLines),
    removedSample: removed.slice(0, maxLines)
  };
}

function findEntryById(rootDir, id) {
  const all = getHistory(rootDir);
  return all.find(e => e.id === id) || null;
}

function summarizeEntryDiff(entryA, entryB) {
  return {
    a: entryA && { id: entryA.id, timestamp: entryA.timestamp, scenario: entryA.scenario, promptHash: entryA.promptHash, promptLength: entryA.promptLength, promptPreview: entryA.promptPreview },
    b: entryB && { id: entryB.id, timestamp: entryB.timestamp, scenario: entryB.scenario, promptHash: entryB.promptHash, promptLength: entryB.promptLength, promptPreview: entryB.promptPreview },
    scenarioChanged: entryA?.scenario !== entryB?.scenario,
    promptHashChanged: entryA?.promptHash !== entryB?.promptHash,
    lengthDelta: (entryB?.promptLength || 0) - (entryA?.promptLength || 0)
  };
}

module.exports = {
  addTask,
  getHistory,
  getRecentHistory,
  diffPrompts,
  findEntryById,
  summarizeEntryDiff,
  // Exposed for unit tests; not part of the public API.
  _internals: { hashPrompt, makePreview, MAX_ENTRIES, MAX_FILE_BYTES, PREVIEW_CHARS }
};
