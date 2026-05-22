const https = require('https');
const http = require('http');
const net = require('net');
const dns = require('dns').promises;
const { AI_CLIENT } = require('../utils/constants');

const DEFAULT_TIMEOUT = AI_CLIENT.DEFAULT_TIMEOUT;
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

async function callOpenAIWithMessages(messages, options, retries = 0) {
  const {
    apiKey,
    baseUrl,
    model,
    maxTokens,
    timeout = DEFAULT_TIMEOUT,
    allowLocalBaseUrl,
    allowInsecureBaseUrl,
    dnsLookup
  } = options;

  const parsedBaseUrl = validateBaseUrl(baseUrl, { allowLocalBaseUrl, allowInsecureBaseUrl });
  await validateResolvedBaseUrl(parsedBaseUrl, { allowLocalBaseUrl, dnsLookup });
  const normalizedBaseUrl = parsedBaseUrl.toString();
  const url = new URL(`${trimTrailingSlashes(normalizedBaseUrl)}/chat/completions`);
  const protocol = url.protocol === 'https:' ? https : http;

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages
  });

  debugLog('OpenAI请求开始', {
    url: url.toString(),
    model,
    maxTokens,
    timeout,
    messagesCount: messages.length,
    retry: retries + 1
  });

  return new Promise((resolve, reject) => {
    let retried = false;
    const doRetry = (reason, res) => {
      if (retried) return;
      retried = true;
      debugLog('准备重试', { reason, retry: retries + 1 });
      if (retries < MAX_RETRIES) {
        const delay = res ? getRetryDelay(retries, res) : BASE_RETRY_DELAY * Math.pow(2, retries);
        console.log(`${reason}，${Math.round(delay / 1000)}秒后重试 (${retries + 1}/${MAX_RETRIES})...`);
        setTimeout(() => callOpenAIWithMessages(messages, options, retries + 1).then(resolve).catch(reject), delay);
      } else {
        reject(new Error(reason));
      }
    };

    const req = protocol.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout
    }, (res) => {
      debugLog('收到响应', { statusCode: res.statusCode, headers: res.headers });
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        debugResponse('OpenAI 响应', data);
        if (RETRYABLE_STATUS_CODES.includes(res.statusCode) && retries < MAX_RETRIES) {
          retried = true;
          const delay = getRetryDelay(retries, res);
          console.log(`服务器返回 ${res.statusCode}，${Math.round(delay / 1000)}秒后重试 (${retries + 1}/${MAX_RETRIES})...`);
          setTimeout(() => callOpenAIWithMessages(messages, options, retries + 1).then(resolve).catch(reject), delay);
          return;
        }
        try {
          const json = JSON.parse(data);
          if (json.error) {
            debugLog('API返回错误', json.error);
            reject(createApiError(res.statusCode, json, 'OpenAI API 返回错误'));
          } else if (!json.choices || !json.choices[0]) {
            debugLog('响应格式异常');
            reject(new Error(`[${res.statusCode}] OpenAI 响应格式异常`));
          } else {
            const content = json.choices[0].message && json.choices[0].message.content;
            if (typeof content !== 'string') {
              reject(new Error(`[${res.statusCode}] OpenAI 响应缺少文本内容`));
              return;
            }
            debugLog('请求成功', { contentLength: content.length });
            resolve(content);
          }
        } catch (e) {
          debugLog('解析响应失败', { error: e.message });
          reject(new Error(`[${res.statusCode}] OpenAI 响应 JSON 解析失败`));
        }
      });
    });

    req.on('timeout', () => {
      debugLog('请求超时', { timeout, retry: retries + 1 });
      req.destroy();
      if (retries < MAX_RETRIES) {
        doRetry(`请求超时 (${timeout}ms)`);
      } else {
        reject(new Error(`请求超时 (${timeout}ms)`));
      }
    });

    req.on('error', (err) => {
      debugLog('请求错误', { code: err.code, message: err.message, stack: err.stack });
      const isRetryable = RETRYABLE_ERRORS.includes(err.code) || err.message.includes('socket hang up');
      if (retries < MAX_RETRIES && isRetryable) {
        doRetry(`连接失败 (${err.code || err.message})`);
      } else if (!retried) {
        reject(err);
      }
    });

    req.write(body);
    req.end();
  });
}

async function callOpenAI(prompt, options, retries = 0) {
  return callOpenAIWithMessages([{ role: 'user', content: prompt }], options, retries);
}

async function callAnthropicWithMessages(messages, options, retries = 0) {
  const {
    apiKey,
    baseUrl,
    model,
    maxTokens,
    timeout = DEFAULT_TIMEOUT,
    allowLocalBaseUrl,
    allowInsecureBaseUrl,
    dnsLookup
  } = options;

  const parsedBaseUrl = validateBaseUrl(baseUrl, { allowLocalBaseUrl, allowInsecureBaseUrl });
  await validateResolvedBaseUrl(parsedBaseUrl, { allowLocalBaseUrl, dnsLookup });
  const normalizedBaseUrl = trimTrailingSlashes(parsedBaseUrl.toString());
  const anthropicPayload = normalizeAnthropicMessages(messages);

  // 处理不同的 baseUrl 格式
  let url;
  if (normalizedBaseUrl.includes('/v1')) {
    // 已经包含 /v1，直接拼接 /messages
    url = new URL(`${normalizedBaseUrl}/messages`);
  } else {
    // 默认拼接 /v1/messages
    url = new URL(`${normalizedBaseUrl}/v1/messages`);
  }

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
    messagesCount: messages.length,
    retry: retries + 1
  });

  return new Promise((resolve, reject) => {
    let retried = false;
    const doRetry = (reason, res) => {
      if (retried) return;
      retried = true;
      debugLog('准备重试', { reason, retry: retries + 1 });
      if (retries < MAX_RETRIES) {
        const delay = res ? getRetryDelay(retries, res) : BASE_RETRY_DELAY * Math.pow(2, retries);
        console.log(`${reason}，${Math.round(delay / 1000)}秒后重试 (${retries + 1}/${MAX_RETRIES})...`);
        setTimeout(() => callAnthropicWithMessages(messages, options, retries + 1).then(resolve).catch(reject), delay);
      } else {
        reject(new Error(reason));
      }
    };

    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      timeout
    }, (res) => {
      debugLog('收到响应', { statusCode: res.statusCode, headers: res.headers });
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        debugResponse('Anthropic 响应', data);
        if (RETRYABLE_STATUS_CODES.includes(res.statusCode) && retries < MAX_RETRIES) {
          retried = true;
          const delay = getRetryDelay(retries, res);
          console.log(`服务器返回 ${res.statusCode}，${Math.round(delay / 1000)}秒后重试 (${retries + 1}/${MAX_RETRIES})...`);
          setTimeout(() => callAnthropicWithMessages(messages, options, retries + 1).then(resolve).catch(reject), delay);
          return;
        }
        try {
          const json = JSON.parse(data);
          if (json.error) {
            debugLog('API返回错误', json.error);
            reject(createApiError(res.statusCode, json, 'Anthropic API 返回错误'));
          } else if (!json.content || !json.content[0]) {
            debugLog('响应格式异常');
            reject(new Error(`[${res.statusCode}] Anthropic 响应格式异常`));
          } else {
            const text = json.content
              .filter(block => block && typeof block.text === 'string')
              .map(block => block.text)
              .join('');
            if (!text) {
              reject(new Error(`[${res.statusCode}] Anthropic 响应缺少文本内容`));
              return;
            }
            debugLog('请求成功', { contentLength: text.length });
            resolve(text);
          }
        } catch (e) {
          debugLog('解析响应失败', { error: e.message });
          reject(new Error(`[${res.statusCode}] Anthropic 响应 JSON 解析失败`));
        }
      });
    });

    req.on('timeout', () => {
      debugLog('请求超时', { timeout, retry: retries + 1 });
      req.destroy();
      if (retries < MAX_RETRIES) {
        doRetry(`请求超时 (${timeout}ms)`);
      } else {
        reject(new Error(`请求超时 (${timeout}ms)`));
      }
    });

    req.on('error', (err) => {
      debugLog('请求错误', { code: err.code, message: err.message, stack: err.stack });
      const isRetryable = RETRYABLE_ERRORS.includes(err.code) || err.message.includes('socket hang up');
      if (retries < MAX_RETRIES && isRetryable) {
        doRetry(`连接失败 (${err.code || err.message})`);
      } else if (!retried) {
        reject(err);
      }
    });

    req.write(body);
    req.end();
  });
}

async function callAnthropic(prompt, options, retries = 0) {
  return callAnthropicWithMessages([{ role: 'user', content: prompt }], options, retries);
}

async function generateWithAI(prompt, options = {}) {
  const {
    apiKey,
    protocol = 'openai',
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-5.5',
    maxTokens = 4096,
    timeout = DEFAULT_TIMEOUT,
    allowLocalBaseUrl,
    allowInsecureBaseUrl,
    dnsLookup
  } = options;

  if (!apiKey) {
    throw new Error('需要配置 API key');
  }

  const callOptions = { apiKey, baseUrl, model, maxTokens, timeout, allowLocalBaseUrl, allowInsecureBaseUrl, dnsLookup };

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
    timeout = DEFAULT_TIMEOUT,
    allowLocalBaseUrl,
    allowInsecureBaseUrl,
    dnsLookup
  } = options;

  if (!apiKey) {
    throw new Error('需要配置 API key');
  }

  const callOptions = { apiKey, baseUrl, model, maxTokens, timeout, allowLocalBaseUrl, allowInsecureBaseUrl, dnsLookup };

  if (protocol === 'openai') {
    return callOpenAIWithMessages(messages, callOptions);
  } else if (protocol === 'anthropic') {
    return callAnthropicWithMessages(messages, callOptions);
  } else {
    throw new Error(`不支持的协议: ${protocol}`);
  }
}

async function generateWithContinuation(prompt, options = {}) {
  const {
    systemPrompt,
    onProgress,
    maxContinuations = 5
  } = options;

  const continuationPrompt = `${prompt}\n\n若回答因长度限制被截断，请在截断位置输出 <<<CONTINUE>>> 标记`;
  const baseMessages = [];
  if (systemPrompt) {
    baseMessages.push({ role: 'system', content: systemPrompt });
  }
  baseMessages.push({ role: 'user', content: continuationPrompt });

  let messages = [...baseMessages];
  let content = await generateFromMessages(messages, options);
  let combined = content.replace(/<<<CONTINUE>>>/g, '');
  let continuationCount = 0;

  while (content.includes('<<<CONTINUE>>>') && continuationCount < maxContinuations) {
    continuationCount++;
    const attempt = continuationCount + 1;
    if (onProgress) {
      onProgress({ attempt, maxAttempts: maxContinuations });
    }

    messages = [
      ...baseMessages,
      { role: 'assistant', content },
      { role: 'user', content: '请从 <<<CONTINUE>>> 处继续，不要重复' }
    ];
    content = await generateFromMessages(messages, options);
    combined += content.replace(/<<<CONTINUE>>>/g, '');
  }

  return combined;
}

module.exports = {
  generateWithAI,
  generateWithContinuation,
  callOpenAI,
  callAnthropic,
  validateBaseUrl,
  validateResolvedBaseUrl,
  normalizeAnthropicMessages
};
