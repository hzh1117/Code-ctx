const https = require('https');
const http = require('http');
const net = require('net');
const dns = require('dns').promises;
const { AI_CLIENT } = require('../utils/constants');
const { evaluateContextBudget } = require('../utils/token-estimator');
const { redactOutboundMessages } = require('./privacy-gateway');
const {
  createAbortError,
  createDeadlineError,
  createRequestTimeoutError,
  isAICancellationError
} = require('./errors');

const DEFAULT_TIMEOUT = AI_CLIENT.DEFAULT_TIMEOUT;
const DEFAULT_DEADLINE = AI_CLIENT.DEFAULT_DEADLINE;
const MAX_RETRIES = AI_CLIENT.MAX_RETRIES;
const RETRYABLE_ERRORS = AI_CLIENT.RETRYABLE_ERRORS;
const RETRYABLE_STATUS_CODES = AI_CLIENT.RETRYABLE_STATUS_CODES;
const BASE_RETRY_DELAY = AI_CLIENT.BASE_RETRY_DELAY;

const DEBUG = process.env.AI_DEBUG === 'true';
const DEBUG_RESPONSE = process.env.AI_DEBUG_RESPONSE === 'true';
const METADATA_HOSTS = new Set([
  'metadata.google.internal',
  'metadata',
  'instance-data',
  '169.254.169.254'
]);

function debugLog(...args) {
  if (DEBUG) {
    console.log('[AI-DEBUG]', new Date().toISOString(), ...args);
  }
}

function debugResponse(label, data) {
  if (DEBUG || DEBUG_RESPONSE) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[AI-RESPONSE] ${label}`);
    console.log(`${'='.repeat(60)}`);
    try {
      const json = JSON.parse(data);
      const summary = {
        keys: Object.keys(json),
        contentBlocks: Array.isArray(json.content) ? json.content.length : undefined,
        choices: Array.isArray(json.choices) ? json.choices.length : undefined,
        usage: json.usage,
        error: json.error ? {
          type: json.error.type,
          code: json.error.code,
          status: json.error.status,
          messageLength: typeof json.error.message === 'string' ? json.error.message.length : undefined
        } : undefined,
        rawLength: data.length
      };
      console.log(JSON.stringify(summary, null, 2));
    } catch {
      console.log(JSON.stringify({ rawLength: data.length, parseableJson: false }, null, 2));
    }
    console.log(`${'='.repeat(60)}\n`);
  }
}

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, '');
}

function normalizeHostname(hostname) {
  return String(hostname || '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
}

function isBlockedIPv4(hostname) {
  const parts = hostname.split('.').map(part => Number(part));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isBlockedIPv6(hostname) {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    normalized.startsWith('::ffff:169.254.')
  );
}

function isLocalOrPrivateHost(hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return true;
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
  if (METADATA_HOSTS.has(normalized)) return true;

  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) return isBlockedIPv4(normalized);
  if (ipVersion === 6) return isBlockedIPv6(normalized);

  return false;
}

function validateBaseUrl(baseUrl, options = {}) {
  const {
    allowLocalBaseUrl = false,
    allowInsecureBaseUrl = false
  } = options;

  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('AI baseUrl 不能为空');
  }

  let parsed;
  try {
    parsed = new URL(trimTrailingSlashes(baseUrl.trim()));
  } catch {
    throw new Error('AI baseUrl 不是有效 URL');
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('AI baseUrl 仅支持 http 或 https 协议');
  }

  if (parsed.protocol === 'http:' && !allowInsecureBaseUrl) {
    throw new Error('AI baseUrl 必须使用 https；如需本地调试，请显式开启不安全 HTTP');
  }

  if (isLocalOrPrivateHost(parsed.hostname) && !allowLocalBaseUrl) {
    throw new Error('AI baseUrl 不能指向 localhost、内网或 metadata 地址');
  }

  return parsed;
}

async function validateResolvedBaseUrl(parsedUrl, options = {}) {
  const {
    allowLocalBaseUrl = false,
    dnsLookup = dns.lookup
  } = options;

  if (allowLocalBaseUrl) return;

  const hostname = normalizeHostname(parsedUrl.hostname);
  if (!hostname || net.isIP(hostname)) return;

  let records;
  try {
    records = await dnsLookup(hostname, { all: true });
  } catch {
    throw new Error(`AI baseUrl DNS 解析失败: ${hostname}`);
  }

  const addresses = Array.isArray(records) ? records : [records];
  const hasBlockedAddress = addresses.some(record => {
    const address = typeof record === 'string' ? record : record && record.address;
    return address && isLocalOrPrivateHost(address);
  });

  if (hasBlockedAddress) {
    throw new Error('AI baseUrl DNS 解析结果不能指向 localhost、内网或 metadata 地址');
  }
}

function createApiError(statusCode, json, fallbackMessage) {
  const status = statusCode || 'unknown';
  const error = json && json.error ? json.error : null;
  const message = error && typeof error.message === 'string' && error.message.trim()
    ? error.message.trim()
    : fallbackMessage;
  const type = error && (error.type || error.code) ? ` (${error.type || error.code})` : '';
  return new Error(`[${status}] ${message}${type}`);
}

function normalizeAnthropicMessages(messages) {
  const system = [];
  const normalizedMessages = [];

  for (const message of messages || []) {
    if (!message || !message.role) continue;
    if (message.role === 'system') {
      if (typeof message.content === 'string') {
        system.push(message.content);
      } else if (Array.isArray(message.content)) {
        const text = message.content
          .filter(block => block && block.type === 'text' && typeof block.text === 'string')
          .map(block => block.text)
          .join('\n');
        if (text) system.push(text);
      }
      continue;
    }

    if (message.role === 'user' || message.role === 'assistant') {
      normalizedMessages.push(message);
    }
  }

  return {
    system: system.join('\n\n'),
    messages: normalizedMessages
  };
}

function getRetryDelay(retries, res) {
  const retryAfter = res?.headers?.['retry-after'];
  if (retryAfter) {
    const parsed = parseInt(retryAfter, 10);
    if (!isNaN(parsed)) return parsed * 1000;
  }
  return BASE_RETRY_DELAY * Math.pow(2, retries) + Math.random() * 1000;
}

// Shared HTTP transport for both providers. Resolves with the raw response
// body + status code so each provider can apply its own JSON shape checks
// (json.choices[0].message.content vs json.content[0].text). Handles:
//   - retryable status codes (429/500-504) with exponential backoff /
//     Retry-After header parsing
//   - request timeout via socket destroy + retry
//   - retryable connection errors (ETIMEDOUT / ECONNRESET / etc.)
//   - debug logging of summary metadata (never response body or headers)
//
// SSRF validation MUST be performed by the caller before invoking this
// helper (validateBaseUrl + validateResolvedBaseUrl), so a recursive retry
// doesn't re-resolve DNS each pass.
async function postJsonWithRetry({
  url, headers, body, timeout, debugLabel, retries = 0,
  maxRetries = MAX_RETRIES, signal, deadlineAt
}) {
  let attempt = retries;
  while (true) {
    throwIfCancelled(signal, deadlineAt);
    try {
      const result = await postJsonOnce({
        url, headers, body, timeout, debugLabel, signal, deadlineAt
      });
      if (!RETRYABLE_STATUS_CODES.includes(result.statusCode) || attempt >= maxRetries) {
        return { statusCode: result.statusCode, body: result.body };
      }

      const reason = `服务器返回 ${result.statusCode}`;
      const delay = getRetryDelay(attempt, result.response);
      console.log(`${reason}，${Math.round(delay / 1000)}秒后重试 (${attempt + 1}/${maxRetries})...`);
      await waitForRetry(delay, signal, deadlineAt);
      attempt++;
    } catch (err) {
      if (err.code === 'AI_REQUEST_ABORTED' || err.code === 'AI_OPERATION_DEADLINE') throw err;
      const retryable = err.code === 'AI_REQUEST_TIMEOUT' ||
        RETRYABLE_ERRORS.includes(err.code) ||
        err.message.includes('socket hang up');
      if (!retryable || attempt >= maxRetries) throw err;

      const reason = err.code === 'AI_REQUEST_TIMEOUT'
        ? err.message
        : `连接失败 (${err.code || err.message})`;
      const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
      console.log(`${reason}，${Math.round(delay / 1000)}秒后重试 (${attempt + 1}/${maxRetries})...`);
      await waitForRetry(delay, signal, deadlineAt);
      attempt++;
    }
  }
}

function parseJsonOrThrow(rawBody, statusCode, providerLabel) {
  try {
    return JSON.parse(rawBody);
  } catch (e) {
    debugLog('解析响应失败', { error: e.message });
    throw new Error(`[${statusCode}] ${providerLabel} 响应 JSON 解析失败`);
  }
}

async function callOpenAIWithMessages(messages, options) {
  const {
    apiKey,
    baseUrl,
    model,
    maxTokens,
    timeout = DEFAULT_TIMEOUT,
    allowLocalBaseUrl,
    allowInsecureBaseUrl,
    dnsLookup,
    signal,
    maxRetries
  } = options;
  const deadlineAt = resolveDeadlineAt(options);

  throwIfCancelled(signal, deadlineAt);
  const safeMessages = redactOutboundMessages(messages, options.onRedactionAudit).messages;
  assertMessagesWithinBudget(safeMessages, options);
  const parsedBaseUrl = validateBaseUrl(baseUrl, { allowLocalBaseUrl, allowInsecureBaseUrl });
  await awaitWithCancellation(
    validateResolvedBaseUrl(parsedBaseUrl, { allowLocalBaseUrl, dnsLookup }),
    signal,
    deadlineAt
  );
  const url = new URL(`${trimTrailingSlashes(parsedBaseUrl.toString())}/chat/completions`);
  const body = JSON.stringify({ model, max_tokens: maxTokens, messages: safeMessages });

  debugLog('OpenAI请求开始', {
    url: url.toString(),
    model,
    maxTokens,
    timeout,
    messagesCount: safeMessages.length,
    retry: 1
  });

  const { statusCode, body: rawBody } = await postJsonWithRetry({
    url,
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body,
    timeout,
    debugLabel: 'OpenAI 响应',
    signal,
    deadlineAt,
    maxRetries
  });

  const json = parseJsonOrThrow(rawBody, statusCode, 'OpenAI');
  if (json.error) {
    debugLog('API返回错误', json.error);
    throw createApiError(statusCode, json, 'OpenAI API 返回错误');
  }
  if (!json.choices || !json.choices[0]) {
    debugLog('响应格式异常');
    throw new Error(`[${statusCode}] OpenAI 响应格式异常`);
  }
  const content = json.choices[0].message && json.choices[0].message.content;
  if (typeof content !== 'string') {
    throw new Error(`[${statusCode}] OpenAI 响应缺少文本内容`);
  }
  debugLog('请求成功', { contentLength: content.length });
  const result = {
    content,
    stopReason: json.choices[0].finish_reason || null,
    truncated: json.choices[0].finish_reason === 'length'
  };
  return options.returnMetadata ? result : content;
}

async function callOpenAI(prompt, options) {
  return callOpenAIWithMessages([{ role: 'user', content: prompt }], options);
}

async function callAnthropicWithMessages(messages, options) {
  const {
    apiKey,
    baseUrl,
    model,
    maxTokens,
    timeout = DEFAULT_TIMEOUT,
    allowLocalBaseUrl,
    allowInsecureBaseUrl,
    dnsLookup,
    signal,
    maxRetries
  } = options;
  const deadlineAt = resolveDeadlineAt(options);

  throwIfCancelled(signal, deadlineAt);
  const safeMessages = redactOutboundMessages(messages, options.onRedactionAudit).messages;
  assertMessagesWithinBudget(safeMessages, options);
  const parsedBaseUrl = validateBaseUrl(baseUrl, { allowLocalBaseUrl, allowInsecureBaseUrl });
  await awaitWithCancellation(
    validateResolvedBaseUrl(parsedBaseUrl, { allowLocalBaseUrl, dnsLookup }),
    signal,
    deadlineAt
  );
  const normalizedBaseUrl = trimTrailingSlashes(parsedBaseUrl.toString());
  const anthropicPayload = normalizeAnthropicMessages(safeMessages);

  // 处理不同的 baseUrl 格式：已含 /v1 直接拼 /messages，否则补默认 /v1/messages
  const url = normalizedBaseUrl.includes('/v1')
    ? new URL(`${normalizedBaseUrl}/messages`)
    : new URL(`${normalizedBaseUrl}/v1/messages`);

  const requestBody = {
    model,
    max_tokens: maxTokens,
    messages: anthropicPayload.messages
  };
  if (anthropicPayload.system) {
    requestBody.system = anthropicPayload.system;
  }
  const body = JSON.stringify(requestBody);

  debugLog('Anthropic请求开始', {
    url: url.toString(),
    model,
    maxTokens,
    timeout,
    messagesCount: safeMessages.length,
    retry: 1
  });

  const { statusCode, body: rawBody } = await postJsonWithRetry({
    url,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body,
    timeout,
    debugLabel: 'Anthropic 响应',
    signal,
    deadlineAt,
    maxRetries
  });

  const json = parseJsonOrThrow(rawBody, statusCode, 'Anthropic');
  if (json.error) {
    debugLog('API返回错误', json.error);
    throw createApiError(statusCode, json, 'Anthropic API 返回错误');
  }
  if (!json.content || !json.content[0]) {
    debugLog('响应格式异常');
    throw new Error(`[${statusCode}] Anthropic 响应格式异常`);
  }
  const text = json.content
    .filter(block => block && typeof block.text === 'string')
    .map(block => block.text)
    .join('');
  if (!text) {
    throw new Error(`[${statusCode}] Anthropic 响应缺少文本内容`);
  }
  debugLog('请求成功', { contentLength: text.length });
  const result = {
    content: text,
    stopReason: json.stop_reason || null,
    truncated: json.stop_reason === 'max_tokens'
  };
  return options.returnMetadata ? result : text;
}

async function callAnthropic(prompt, options) {
  return callAnthropicWithMessages([{ role: 'user', content: prompt }], options);
}

async function generateWithAI(prompt, options = {}) {
  const {
    apiKey,
    protocol = 'openai',
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-5.5',
    maxTokens = 4096,
    maxInputTokens,
    timeout = DEFAULT_TIMEOUT,
    allowLocalBaseUrl,
    allowInsecureBaseUrl,
    dnsLookup,
    onRedactionAudit,
    signal,
    deadlineMs,
    maxRetries
  } = options;

  if (!apiKey) {
    throw new Error('需要配置 API key');
  }

  const callOptions = {
    apiKey, baseUrl, model, maxTokens, maxInputTokens, timeout,
    allowLocalBaseUrl, allowInsecureBaseUrl, dnsLookup, onRedactionAudit,
    signal, deadlineMs, deadlineAt: resolveDeadlineAt(options), maxRetries
  };

  if (protocol === 'openai') {
    return callOpenAI(prompt, callOptions);
  } else if (protocol === 'anthropic') {
    return callAnthropic(prompt, callOptions);
  } else {
    throw new Error(`不支持的协议: ${protocol}`);
  }
}

async function generateFromMessages(messages, options = {}) {
  const {
    apiKey,
    protocol = 'openai',
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-5.5',
    maxTokens = 4096,
    maxInputTokens,
    timeout = DEFAULT_TIMEOUT,
    allowLocalBaseUrl,
    allowInsecureBaseUrl,
    dnsLookup,
    onRedactionAudit,
    signal,
    deadlineMs,
    deadlineAt,
    maxRetries
  } = options;

  if (!apiKey) {
    throw new Error('需要配置 API key');
  }

  const callOptions = {
    apiKey, baseUrl, model, maxTokens, maxInputTokens, timeout,
    allowLocalBaseUrl, allowInsecureBaseUrl, dnsLookup, onRedactionAudit,
    signal, deadlineMs, deadlineAt, maxRetries,
    returnMetadata: true
  };

  if (protocol === 'openai') {
    return callOpenAIWithMessages(messages, callOptions);
  } else if (protocol === 'anthropic') {
    return callAnthropicWithMessages(messages, callOptions);
  } else {
    throw new Error(`不支持的协议: ${protocol}`);
  }
}

function resolveDeadlineAt(options = {}) {
  if (Number.isFinite(options.deadlineAt)) return options.deadlineAt;
  const deadlineMs = options.deadlineMs === undefined ? DEFAULT_DEADLINE : options.deadlineMs;
  return Number.isFinite(deadlineMs) && deadlineMs > 0
    ? Date.now() + deadlineMs
    : Infinity;
}

function throwIfCancelled(signal, deadlineAt) {
  if (signal?.aborted) throw createAbortError();
  if (Number.isFinite(deadlineAt) && Date.now() >= deadlineAt) throw createDeadlineError();
}

function awaitWithCancellation(promise, signal, deadlineAt) {
  throwIfCancelled(signal, deadlineAt);
  if (!signal && !Number.isFinite(deadlineAt)) return promise;

  return new Promise((resolve, reject) => {
    let settled = false;
    let deadlineTimer;
    const cleanup = () => {
      if (deadlineTimer) clearTimeout(deadlineTimer);
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onAbort = () => finish(reject, createAbortError());

    signal?.addEventListener('abort', onAbort, { once: true });
    if (Number.isFinite(deadlineAt)) {
      deadlineTimer = setTimeout(
        () => finish(reject, createDeadlineError()),
        Math.max(0, deadlineAt - Date.now())
      );
    }
    Promise.resolve(promise).then(
      value => finish(resolve, value),
      error => finish(reject, error)
    );
  });
}

function waitForRetry(delay, signal, deadlineAt) {
  throwIfCancelled(signal, deadlineAt);
  return new Promise((resolve, reject) => {
    let settled = false;
    const remaining = Number.isFinite(deadlineAt) ? deadlineAt - Date.now() : Infinity;
    const wait = Math.min(delay, remaining);
    let timer;

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onAbort = () => finish(reject, createAbortError());
    timer = setTimeout(() => {
      if (Number.isFinite(deadlineAt) && Date.now() >= deadlineAt) {
        finish(reject, createDeadlineError());
      } else {
        finish(resolve);
      }
    }, Math.max(0, wait));

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function postJsonOnce({ url, headers, body, timeout, debugLabel, signal, deadlineAt }) {
  const protocol = url.protocol === 'https:' ? https : http;
  throwIfCancelled(signal, deadlineAt);

  return new Promise((resolve, reject) => {
    let settled = false;
    let deadlineTimer;
    let req;

    const cleanup = () => {
      if (deadlineTimer) clearTimeout(deadlineTimer);
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onAbort = () => {
      const error = createAbortError();
      if (req) req.destroy(error);
      finish(reject, error);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    if (Number.isFinite(deadlineAt)) {
      const remaining = deadlineAt - Date.now();
      if (remaining <= 0) {
        finish(reject, createDeadlineError());
        return;
      }
      deadlineTimer = setTimeout(() => {
        const error = createDeadlineError();
        if (req) req.destroy(error);
        finish(reject, error);
      }, remaining);
    }

    req = protocol.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        timeout
      },
      (res) => {
        debugLog('收到响应', { statusCode: res.statusCode, headers: res.headers });
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          debugResponse(debugLabel, data);
          finish(resolve, { statusCode: res.statusCode, body: data, response: res });
        });
        res.on('error', err => finish(reject, err));
      }
    );

    req.on('timeout', () => {
      const error = createRequestTimeoutError(timeout);
      debugLog('请求超时', { timeout });
      req.destroy(error);
      finish(reject, error);
    });
    req.on('error', err => finish(reject, err));
    req.write(body);
    req.end();
  });
}

function assertMessagesWithinBudget(messages, options) {
  const budget = evaluateContextBudget(JSON.stringify(messages), {
    maxInputTokens: options.maxInputTokens,
    maxOutputTokens: options.maxTokens,
    safetyMargin: options.safetyMargin
  });
  if (budget.status === 'over') {
    throw new Error(
      `AI 输入 Prompt 超出预算: 预计 ${budget.input.estimate} tokens，安全上限 ${budget.input.safeLimit} tokens`
    );
  }
  return budget;
}

function inspectOutputStructure(content) {
  const reasons = [];
  if (content.includes('<<<CONTINUE>>>')) reasons.push('continuation-marker');

  const fenceCount = (content.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) reasons.push('unclosed-code-fence');

  const openedSections = [...content.matchAll(/<!--\s*section:([\w-]+)\s*-->/g)].map(match => match[1]);
  const closedSections = [...content.matchAll(/<!--\s*\/section:([\w-]+)\s*-->/g)].map(match => match[1]);
  const sectionBalance = new Map();
  for (const name of openedSections) sectionBalance.set(name, (sectionBalance.get(name) || 0) + 1);
  for (const name of closedSections) sectionBalance.set(name, (sectionBalance.get(name) || 0) - 1);
  if ([...sectionBalance.values()].some(balance => balance !== 0)) {
    reasons.push('unbalanced-sections');
  }

  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
    } catch {
      reasons.push('invalid-json-structure');
    }
  }

  return { complete: reasons.length === 0, reasons };
}

function continuationReasons(response, combined) {
  const structure = inspectOutputStructure(combined);
  const reasons = [...structure.reasons];
  if (response.content.includes('<<<CONTINUE>>>')) reasons.push('continuation-marker');
  if (response.truncated) reasons.unshift(`provider:${response.stopReason || 'length'}`);
  return [...new Set(reasons)];
}

async function generateWithContinuation(prompt, options = {}) {
  const {
    systemPrompt,
    onProgress,
    maxContinuations = 5
  } = options;

  const operationOptions = { ...options, deadlineAt: resolveDeadlineAt(options) };
  const continuationPrompt = `${prompt}\n\n若回答因长度限制被截断，请在截断位置输出 <<<CONTINUE>>> 标记`;
  const baseMessages = [];
  if (systemPrompt) {
    baseMessages.push({ role: 'system', content: systemPrompt });
  }
  baseMessages.push({ role: 'user', content: continuationPrompt });

  let messages = [...baseMessages];
  let response = await generateFromMessages(messages, operationOptions);
  let content = response.content;
  let combined = content.replace(/<<<CONTINUE>>>/g, '');
  let continuationCount = 0;
  let reasons = continuationReasons(response, content);

  while (reasons.length > 0) {
    if (continuationCount >= maxContinuations) {
      throw new Error(
        `AI 输出在 ${continuationCount} 次续写后仍被截断或结构不完整: ${reasons.join(', ')}`
      );
    }
    continuationCount++;
    const attempt = continuationCount + 1;
    if (onProgress) {
      onProgress({ attempt, maxAttempts: maxContinuations });
    }

    messages = [
      ...messages,
      { role: 'assistant', content },
      { role: 'user', content: `请从上次中断处继续，不要重复。待完成原因: ${reasons.join(', ')}` }
    ];
    response = await generateFromMessages(messages, operationOptions);
    content = response.content;
    combined += content.replace(/<<<CONTINUE>>>/g, '');
    reasons = continuationReasons(response, combined);
  }

  return combined;
}

/**
 * Streaming variant of generateWithAI. Returns a readable event interface:
 *   const stream = generateWithAIStream(prompt, options);
 *   stream.on('token', (chunk) => process.stdout.write(chunk));
 *   stream.on('done', (fullText) => { ... });
 *   stream.on('error', (err) => { ... });
 *
 * Internally uses chunked transfer-encoding parsing on the HTTP response
 * to emit partial tokens as they arrive.
 */
function generateWithAIStream(prompt, options = {}) {
  const EventEmitter = require('events');
  const emitter = new EventEmitter();

  const {
    apiKey,
    protocol = 'openai',
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-5.5',
    maxTokens = 4096,
    maxInputTokens,
    timeout = DEFAULT_TIMEOUT,
    allowLocalBaseUrl,
    allowInsecureBaseUrl,
    dnsLookup,
    onRedactionAudit,
    signal,
    deadlineMs
  } = options;

  if (!apiKey) {
    process.nextTick(() => emitter.emit('error', new Error('需要配置 API key')));
    return emitter;
  }

  const doStream = async () => {
    try {
      let parsedBaseUrl, url, headers, body;
      const deadlineAt = resolveDeadlineAt({ ...options, deadlineMs });
      throwIfCancelled(signal, deadlineAt);
      const safeMessages = redactOutboundMessages(
        [{ role: 'user', content: prompt }],
        onRedactionAudit
      ).messages;
      assertMessagesWithinBudget(safeMessages, {
        maxInputTokens,
        maxTokens
      });

      if (protocol === 'openai') {
        parsedBaseUrl = validateBaseUrl(baseUrl, { allowLocalBaseUrl, allowInsecureBaseUrl });
        await awaitWithCancellation(
          validateResolvedBaseUrl(parsedBaseUrl, { allowLocalBaseUrl, dnsLookup }),
          signal,
          deadlineAt
        );
        url = new URL(`${trimTrailingSlashes(parsedBaseUrl.toString())}/chat/completions`);
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        body = JSON.stringify({ model, max_tokens: maxTokens, messages: safeMessages, stream: true });
      } else if (protocol === 'anthropic') {
        parsedBaseUrl = validateBaseUrl(baseUrl, { allowLocalBaseUrl, allowInsecureBaseUrl });
        await awaitWithCancellation(
          validateResolvedBaseUrl(parsedBaseUrl, { allowLocalBaseUrl, dnsLookup }),
          signal,
          deadlineAt
        );
        const normalizedBaseUrl = trimTrailingSlashes(parsedBaseUrl.toString());
        url = normalizedBaseUrl.includes('/v1')
          ? new URL(`${normalizedBaseUrl}/messages`)
          : new URL(`${normalizedBaseUrl}/v1/messages`);
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        };
        body = JSON.stringify({ model, max_tokens: maxTokens, messages: safeMessages, stream: true });
      } else {
        throw new Error(`不支持的协议: ${protocol}`);
      }

      const httpsModule = require('https');
      const httpModule = require('http');
      const protocolModule = url.protocol === 'https:' ? httpsModule : httpModule;
      let settled = false;
      let deadlineTimer;
      let req;
      const cleanup = () => {
        if (deadlineTimer) clearTimeout(deadlineTimer);
        signal?.removeEventListener('abort', onAbort);
      };
      const emitError = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        emitter.emit('error', error);
      };
      const onAbort = () => {
        const error = createAbortError();
        if (req) req.destroy(error);
        emitError(error);
      };

      req = protocolModule.request(url, {
        method: 'POST',
        headers,
        timeout
      }, (res) => {
        if (res.statusCode >= 400) {
          let errData = '';
          res.on('data', chunk => errData += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(errData);
              emitError(createApiError(res.statusCode, json, 'AI API 返回错误'));
            } catch {
              emitError(new Error(`[${res.statusCode}] AI API 返回错误`));
            }
          });
          return;
        }

        let fullText = '';
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const json = JSON.parse(data);
              let token = '';
              if (protocol === 'openai') {
                token = json.choices?.[0]?.delta?.content || '';
              } else {
                // Anthropic streaming: content_block_delta events
                if (json.type === 'content_block_delta') {
                  token = json.delta?.text || '';
                }
              }
              if (token) {
                fullText += token;
                emitter.emit('token', token);
              }
            } catch {
              // ignore parse errors in stream chunks
            }
          }
        });

        res.on('end', () => {
          // Process any remaining buffer
          if (buffer.trim()) {
            const trimmed = buffer.trim();
            if (trimmed.startsWith('data:') && trimmed.slice(5).trim() !== '[DONE]') {
              try {
                const json = JSON.parse(trimmed.slice(5).trim());
                let token = '';
                if (protocol === 'openai') {
                  token = json.choices?.[0]?.delta?.content || '';
                } else if (json.type === 'content_block_delta') {
                  token = json.delta?.text || '';
                }
                if (token) {
                  fullText += token;
                  emitter.emit('token', token);
                }
              } catch {
                // ignore
              }
            }
          }
          if (!settled) {
            settled = true;
            cleanup();
            emitter.emit('done', fullText);
          }
        });
      });

      signal?.addEventListener('abort', onAbort, { once: true });
      if (Number.isFinite(deadlineAt)) {
        deadlineTimer = setTimeout(() => {
          const error = createDeadlineError();
          req.destroy(error);
          emitError(error);
        }, Math.max(0, deadlineAt - Date.now()));
      }
      req.on('error', emitError);
      req.on('timeout', () => {
        const error = createRequestTimeoutError(timeout);
        req.destroy(error);
        emitError(error);
      });

      req.write(body);
      req.end();
    } catch (err) {
      process.nextTick(() => emitter.emit('error', err));
    }
  };

  doStream();
  return emitter;
}

module.exports = {
  generateWithAI,
  generateWithAIStream,
  generateWithContinuation,
  callOpenAI,
  callAnthropic,
  validateBaseUrl,
  validateResolvedBaseUrl,
  normalizeAnthropicMessages,
  inspectOutputStructure,
  assertMessagesWithinBudget,
  isAICancellationError
};
