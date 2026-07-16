class BaseAdapter {
  get type() {
    throw new Error('Adapter must implement type getter');
  }

  detect(_pkg, _files) {
    throw new Error('Adapter must implement detect()');
  }

  get detectionPriority() {
    return 100;
  }

  get scanPatterns() {
    return [];
  }

  /**
   * Path-keyword → priority map (lower number = higher priority).
   * Iteration order controls tie-breaks: the first matching keyword wins.
   * Override per adapter to express what's most important for that stack.
   */
  get priorityKeywords() {
    return {};
  }

  /**
   * Returns the priority for a file path. Lower = more important.
   * Default 100 means "unranked" (sorted after explicit priorities).
   */
  getFilePriority(normalizedPath) {
    for (const [keyword, priority] of Object.entries(this.priorityKeywords)) {
      if (normalizedPath.includes(keyword.toLowerCase())) {
        return priority;
      }
    }
    return 100;
  }

  getPromptHints() {
    return '';
  }

  extractKeyFiles(_dir) {
    return [];
  }
}

function assertValidAdapter(adapter, label = 'Adapter') {
  if (!(adapter instanceof BaseAdapter)) {
    throw new Error(`${label} must extend BaseAdapter`);
  }

  let type;
  try {
    type = adapter.type;
  } catch (error) {
    throw new Error(`${label} type is invalid: ${error.message}`);
  }
  if (typeof type !== 'string' || type.trim().length === 0) {
    throw new Error(`${label} must provide a non-empty type`);
  }
  if (typeof adapter.detect !== 'function') {
    throw new Error(`${label} must implement detect()`);
  }
  if (!Array.isArray(adapter.scanPatterns)) {
    throw new Error(`${label} scanPatterns must be an array`);
  }
  return adapter;
}

module.exports = { BaseAdapter, assertValidAdapter };
