const https = require('https');
const http = require('http');
const { AI_CLIENT } = require('../utils/constants');

const DEFAULT_TIMEOUT = AI_CLIENT.DEFAULT_TIMEOUT;
const MAX_RETRIES = AI_CLIENT.MAX_RETRIES;
const RETRYABLE_ERRORS = AI_CLIENT.RETRYABLE_ERRORS;
const RETRYABLE_STATUS_CODES = AI_CLIENT.RETRYABLE_STATUS_CODES;
const BASE_RETRY_DELAY = AI_CLIENT.BASE_RETRY_DELAY;

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, '');
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
  const { apiKey, baseUrl, model, maxTokens, timeout = DEFAULT_TIMEOUT } = options;

  const normalizedBaseUrl = trimTrailingSlashes(baseUrl);
  const url = new URL(`${normalizedBaseUrl}/chat/completions`);
  const protocol = url.protocol === 'https:' ? https : http;

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages
  });

  return new Promise((resolve, reject) => {
    let retried = false;
    const doRetry = (reason, res) => {
      if (retried) return;
      retried = true;
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
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
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
            reject(new Error(`[${res.statusCode}] ${json.error.message}`));
          } else if (!json.choices || !json.choices[0]) {
            reject(new Error(`[${res.statusCode}] 响应格式异常: ${data.substring(0, 200)}`));
          } else {
            resolve(json.choices[0].message.content);
          }
        } catch (e) {
          reject(new Error(`[${res.statusCode}] 解析响应失败: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      if (retries < MAX_RETRIES) {
        doRetry(`请求超时 (${timeout}ms)`);
      } else {
        reject(new Error(`请求超时 (${timeout}ms)`));
      }
    });

    req.on('error', (err) => {
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
  const { apiKey, baseUrl, model, maxTokens, timeout = DEFAULT_TIMEOUT } = options;

  const normalizedBaseUrl = trimTrailingSlashes(baseUrl);

  // 处理不同的 baseUrl 格式
  let url;
  if (normalizedBaseUrl.includes('/v1')) {
    // 已经包含 /v1，直接拼接 /messages
    url = new URL(`${normalizedBaseUrl}/messages`);
  } else {
    // 默认拼接 /v1/messages
    url = new URL(`${normalizedBaseUrl}/v1/messages`);
  }

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages
  });

  return new Promise((resolve, reject) => {
    let retried = false;
    const doRetry = (reason, res) => {
      if (retried) return;
      retried = true;
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
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
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
            reject(new Error(`[${res.statusCode}] ${json.error.message}`));
          } else if (!json.content || !json.content[0]) {
            reject(new Error(`[${res.statusCode}] 响应格式异常: ${data.substring(0, 200)}`));
          } else {
            resolve(json.content[0].text);
          }
        } catch (e) {
          reject(new Error(`[${res.statusCode}] 解析响应失败: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      if (retries < MAX_RETRIES) {
        doRetry(`请求超时 (${timeout}ms)`);
      } else {
        reject(new Error(`请求超时 (${timeout}ms)`));
      }
    });

    req.on('error', (err) => {
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
    model = 'gpt-4',
    maxTokens = 4096,
    timeout = DEFAULT_TIMEOUT
  } = options;

  if (!apiKey) {
    throw new Error('需要配置 API key');
  }

  const callOptions = { apiKey, baseUrl, model, maxTokens, timeout };

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
    model = 'gpt-4',
    maxTokens = 4096,
    timeout = DEFAULT_TIMEOUT
  } = options;

  if (!apiKey) {
    throw new Error('需要配置 API key');
  }

  const callOptions = { apiKey, baseUrl, model, maxTokens, timeout };

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
  callAnthropic
};
