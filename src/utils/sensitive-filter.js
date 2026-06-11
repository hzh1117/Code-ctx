const fs = require('fs');
const path = require('path');
const { readFileUTF8 } = require('./file-reader');
const pluginState = require('../plugins/state');

const DEFAULT_PATTERNS = [
  { pattern: /(^|[^?&\w-])(password\s*[:=]\s*)["']?[^"'\s&]+/gi, replacement: '$1$2[FILTERED]' },
  { pattern: /(^|[^?&\w-])(secret\s*[:=]\s*)["']?[^"'\s&]+/gi, replacement: '$1$2[FILTERED]' },
  { pattern: /(^|[^?&\w-])(token\s*[:=]\s*)["']?[^"'\s&]+/gi, replacement: '$1$2[FILTERED]' },
  { pattern: /(^|[^?&\w-])(api[_-]?key\s*[:=]\s*)["']?[^"'\s&]+/gi, replacement: '$1$2[FILTERED]' },
  { pattern: /(^|[^?&\w-])(private[_-]?key\s*[:=]\s*)["']?[^"'\s&]+/gi, replacement: '$1$2[FILTERED]' },
  { pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, replacement: '[FILTERED]' },
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[FILTERED]' },
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}/gi, replacement: 'Bearer [FILTERED]' },
  { pattern: /([?&](?:key|token|secret|api_key|access_token)=)([^&\s]{8,})/gi, replacement: '$1[FILTERED]' },
  { pattern: /(mongodb|mysql|postgres|redis):\/\/[^@]+@[^\s]+/gi, replacement: '$1://[FILTERED]' },
  { pattern: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----[\s\S]*?-----END\s+\1\s+PRIVATE\s+KEY-----/g, replacement: '[FILTERED SSH PRIVATE KEY]' }
];

const DETECTION_PATTERNS = [
  { regex: /password\s*[:=]\s*["']?[^"'\s]+/i, name: 'password' },
  { regex: /secret\s*[:=]\s*["']?[^"'\s]+/i, name: 'secret' },
  { regex: /token\s*[:=]\s*["']?[^"'\s]+/i, name: 'token' },
  { regex: /api[_-]?key\s*[:=]\s*["']?[^"'\s]+/i, name: 'api_key' },
  { regex: /private[_-]?key\s*[:=]\s*["']?[^"'\s]+/i, name: 'private_key' },
  { regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, name: 'jwt_token' },
  { regex: /AKIA[0-9A-Z]{16}/, name: 'aws_access_key' },
  { regex: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}/i, name: 'bearer_token' },
  { regex: /[?&](key|token|secret|api_key|access_token)=([^&\s]{8,})/i, name: 'url_key_param' },
  { regex: /(mongodb|mysql|postgres|redis):\/\/[^@]+@[^\s]+/i, name: 'connection_string' },
  { regex: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----/i, name: 'ssh_private_key' }
];

// Pre-compile the global-flag variant of each default pattern once so
// every filterSensitive call reuses the same RegExp instance instead of
// constructing a new one per pattern per call.
const DEFAULT_PATTERNS_PRECOMPILED = DEFAULT_PATTERNS.map(({ pattern, replacement }) => {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  // Always create a new RegExp to avoid sharing lastIndex state with the
  // original pattern object (matchAll/replace advance lastIndex on g-flag regexes).
  const globalRegex = new RegExp(pattern.source, flags);
  return { pattern, replacement, globalRegex };
});

function precompileCustom(pattern, replacement) {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  // Always create a new RegExp to avoid sharing lastIndex state with the caller's pattern.
  const globalRegex = new RegExp(pattern.source, flags);
  return { pattern, replacement, globalRegex };
}

function filterSensitive(content, customPatterns = []) {
  let result = content;
  let count = 0;
  const pluginPatterns = pluginState.getState().sensitivePatterns;
  const merged = (customPatterns.length === 0 && pluginPatterns.length === 0)
    ? DEFAULT_PATTERNS_PRECOMPILED
    : [
        ...DEFAULT_PATTERNS_PRECOMPILED,
        ...customPatterns.map(p => precompileCustom(p.pattern, p.replacement)),
        ...pluginPatterns.map(p => precompileCustom(p.pattern, p.replacement))
      ];

  for (const { pattern, replacement, globalRegex } of merged) {
    for (const _ of content.matchAll(globalRegex)) {
      count++;
    }
    result = result.replace(pattern, replacement);
  }

  return { content: result, count };
}

function scanDirectory(dir) {
  const warnings = [];
  if (!fs.existsSync(dir)) return warnings;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const pluginDetections = pluginState.getState().sensitiveDetectionPatterns;
  const allDetections = pluginDetections.length === 0
    ? DETECTION_PATTERNS
    : [...DETECTION_PATTERNS, ...pluginDetections];

  for (const file of files) {
    try {
      const content = readFileUTF8(path.join(dir, file));
      for (const { regex, name } of allDetections) {
        // Reset lastIndex to prevent alternating true/false for g-flag patterns
        regex.lastIndex = 0;
        if (regex.test(content)) {
          warnings.push({ file, field: name });
        }
      }
    } catch {
      continue;
    }
  }
  return warnings;
}

module.exports = { filterSensitive, DETECTION_PATTERNS, scanDirectory };
