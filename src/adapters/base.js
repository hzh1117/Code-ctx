class BaseAdapter {
  get type() {
    throw new Error('Adapter must implement type getter');
  }

  detect(pkg, files) {
    throw new Error('Adapter must implement detect()');
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

  extractKeyFiles(dir) {
    return [];
  }
}

module.exports = { BaseAdapter };
