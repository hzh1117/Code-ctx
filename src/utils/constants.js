const TOKEN_THRESHOLDS = {
  ONE_SHOT: 60000,
  BATCH: 200000
};

const PROMPT_MAX_CHARS = 8000;

const STATE_FILES = {
  LAST_SCAN: '.last-scan.json',
  INIT_STATE: '.init-state.json',
  TASK_HISTORY: '.task-history.jsonl'
};

module.exports = { TOKEN_THRESHOLDS, PROMPT_MAX_CHARS, STATE_FILES };
