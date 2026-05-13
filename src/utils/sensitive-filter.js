const DEFAULT_PATTERNS = [
  { pattern: /(password\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[FILTERED]' },
  { pattern: /(secret\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[FILTERED]' },
  { pattern: /(token\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[FILTERED]' },
  { pattern: /(api[_-]?key\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[FILTERED]' },
  { pattern: /(private[_-]?key\s*[:=]\s*)["']?[^"'\s]+/gi, replacement: '$1[FILTERED]' },
  { pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, replacement: '[FILTERED]' },
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[FILTERED]' },
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+\/]{20,}/gi, replacement: 'Bearer [FILTERED]' },
  { pattern: /[?&](key|token|secret|api_key|access_token)=([^&\s]{8,})/gi, replacement: (match, p1) => match[0] + p1 + '=[FILTERED]' },
  { pattern: /(mongodb|mysql|postgres|redis):\/\/[^@]+@[^\s]+/gi, replacement: '$1://[FILTERED]' }
];

const DETECTION_PATTERNS = [
  { regex: /password\s*[:=]\s*["']?[^"'\s]+/i, name: 'password' },
  { regex: /secret\s*[:=]\s*["']?[^"'\s]+/i, name: 'secret' },
  { regex: /token\s*[:=]\s*["']?[^"'\s]+/i, name: 'token' },
  { regex: /api[_-]?key\s*[:=]\s*["']?[^"'\s]+/i, name: 'api_key' },
  { regex: /private[_-]?key\s*[:=]\s*["']?[^"'\s]+/i, name: 'private_key' },
  { regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, name: 'jwt_token' },
  { regex: /AKIA[0-9A-Z]{16}/, name: 'aws_access_key' },
  { regex: /Bearer\s+[A-Za-z0-9\-._~+\/]{20,}/i, name: 'bearer_token' },
  { regex: /[?&](key|token|secret|api_key|access_token)=([^&\s]{8,})/i, name: 'url_key_param' },
  { regex: /(mongodb|mysql|postgres|redis):\/\/[^@]+@[^\s]+/i, name: 'connection_string' }
];

function filterSensitive(content, customPatterns = []) {
  let result = content;
  let count = 0;
  const patterns = [...DEFAULT_PATTERNS, ...customPatterns];

  for (const { pattern, replacement } of patterns) {
    const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
    const globalRegex = new RegExp(pattern.source, flags);
    for (const _ of content.matchAll(globalRegex)) {
      count++;
    }
    result = result.replace(pattern, replacement);
  }

  return { content: result, count };
}

module.exports = { filterSensitive, DETECTION_PATTERNS };
