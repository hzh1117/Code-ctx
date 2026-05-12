const fs = require('fs');
const path = require('path');

function addTask(rootDir, taskData) {
  const historyPath = path.join(rootDir, '.task-history.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    ...taskData
  };
  
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(historyPath, line);
}

function getHistory(rootDir) {
  const historyPath = path.join(rootDir, '.task-history.jsonl');
  
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  
  const content = fs.readFileSync(historyPath, 'utf8');
  return content.trim().split('\n')
    .filter(line => line)
    .map(line => JSON.parse(line));
}

module.exports = { addTask, getHistory };
