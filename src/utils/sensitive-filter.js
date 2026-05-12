const DEFAULT_PATTERNS = [
  { pattern: /(password\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[REDACTED]' },
  { pattern: /(secret\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[REDACTED]' },
  { pattern: /(token\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[REDACTED]' },
  { pattern: /(api[_-]?key\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[REDACTED]' },
  { pattern: /(private[_-]?key\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[REDACTED]' }
];

function filterSensitive(content, customPatterns = []) {
  let result = content;
  const patterns = [...DEFAULT_PATTERNS, ...customPatterns];

  for (const { pattern, replacement } of patterns) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

module.exports = { filterSensitive };
