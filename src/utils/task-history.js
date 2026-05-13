const fs = require('fs');
const path = require('path');
const { loadProjectConfig } = require('./config');
const { STATE_FILES } = require('./constants');

function getHistoryPath(rootDir) {
  const config = loadProjectConfig(rootDir);
  const outputDir = config.outputDir || 'ai-docs';
  return path.join(rootDir, outputDir, STATE_FILES.TASK_HISTORY);
}

function addTask(rootDir, taskData) {
  const historyPath = getHistoryPath(rootDir);
  const dir = path.dirname(historyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    ...taskData
  };

  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(historyPath, line);
}

function getHistory(rootDir) {
  const historyPath = getHistoryPath(rootDir);

  if (!fs.existsSync(historyPath)) {
    return [];
  }

  const content = fs.readFileSync(historyPath, 'utf8');
  const entries = [];
  for (const line of content.trim().split('\n')) {
    if (!line) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // 跳过损坏行
    }
  }
  return entries;
}

module.exports = { addTask, getHistory };
