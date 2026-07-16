const { filterSensitive } = require('../utils/sensitive-filter');

const ABSOLUTE_PATH_PATTERNS = [
  /(?:[A-Za-z]:[\\/]|\\\\)[^\s<>"'`]+/g,
  /(?<![:\w])\/(?:Users|home|root|tmp|var|etc|opt|srv|mnt|private|workspace|app)(?:\/[^\s<>"'`]+)+/gi
];

function redactText(value) {
  const filtered = filterSensitive(value);
  let content = filtered.content;
  let pathCount = 0;

  for (const pattern of ABSOLUTE_PATH_PATTERNS) {
    content = content.replace(pattern, () => {
      pathCount++;
      return '[REDACTED_PATH]';
    });
  }

  const fields = [];
  if (filtered.count > 0) fields.push({ type: 'sensitive-value', count: filtered.count });
  if (pathCount > 0) fields.push({ type: 'absolute-path', count: pathCount });
  return { content, fields };
}

function redactContent(content) {
  if (typeof content === 'string') {
    const redacted = redactText(content);
    return { content: redacted.content, fields: redacted.fields };
  }

  if (!Array.isArray(content)) return { content, fields: [] };

  const fields = new Map();
  const safeBlocks = content.map(block => {
    if (!block || typeof block !== 'object' || typeof block.text !== 'string') return block;
    const redacted = redactText(block.text);
    for (const field of redacted.fields) {
      fields.set(field.type, (fields.get(field.type) || 0) + field.count);
    }
    return { ...block, text: redacted.content };
  });

  return {
    content: safeBlocks,
    fields: [...fields].map(([type, count]) => ({ type, count }))
  };
}

function redactOutboundMessages(messages, onRedactionAudit) {
  const audit = { totalRedactions: 0, messages: [] };
  const safeMessages = (messages || []).map((message, index) => {
    if (!message || typeof message !== 'object') return message;
    const redacted = redactContent(message.content);
    const count = redacted.fields.reduce((sum, field) => sum + field.count, 0);
    if (count > 0) {
      audit.totalRedactions += count;
      audit.messages.push({
        index,
        role: typeof message.role === 'string' ? message.role : 'unknown',
        fields: redacted.fields
      });
    }
    return { ...message, content: redacted.content };
  });

  if (typeof onRedactionAudit === 'function') onRedactionAudit(audit);
  return { messages: safeMessages, audit };
}

module.exports = { redactOutboundMessages };
