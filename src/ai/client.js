const https = require('https');
const http = require('http');

const DEFAULT_TIMEOUT = 180000; // 180 秒超时
const MAX_RETRIES = 3; // 最多重试 3 次
const RETRYABLE_ERRORS = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND'];
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const BASE_RETRY_DELAY = 2000;

function getRetryDelay(retries, res) {
  const retryAfter = res?.headers?.['retry-after'];
  if (retryAfter) {
    const parsed = parseInt(retryAfter, 10);
    if (!isNaN(parsed)) return parsed * 1000;
  }
  return BASE_RETRY_DELAY * Math.pow(2, retries) + Math.random() * 1000;
}

async function callOpenAI(prompt, options, retries = 0) {
  const { apiKey, baseUrl, model, maxTokens, timeout = DEFAULT_TIMEOUT } = options;

  const url = new URL(`${baseUrl}/chat/completions`);
  const protocol = url.protocol === 'https:' ? https : http;

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  });

  return new Promise((resolve, reject) => {
    let retried = false;
    const doRetry = (reason, res) => {
      if (retried) return;
      retried = true;
      if (retries < MAX_RETRIES) {
        const delay = res ? getRetryDelay(retries, res) : BASE_RETRY_DELAY * Math.pow(2, retries);
        console.log(`${reason}，${Math.round(delay / 1000)}秒后重试 (${retries + 1}/${MAX_RETRIES})...`);
        setTimeout(() => callOpenAI(prompt, options, retries + 1).then(resolve).catch(reject), delay);
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
          setTimeout(() => callOpenAI(prompt, options, retries + 1).then(resolve).catch(reject), delay);
          return;
        }
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
          } else {
            resolve(json.choices[0].message.content);
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${data}`));
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
  const { apiKey, baseUrl, model, maxTokens, timeout = DEFAULT_TIMEOUT } = options;

  // 处理不同的 baseUrl 格式
  let url;
  if (baseUrl.includes('/v1')) {
    // 已经包含 /v1，直接拼接 /messages
    url = new URL(`${baseUrl}/messages`);
  } else if (baseUrl.endsWith('/')) {
    // 以 / 结尾，拼接 v1/messages
    url = new URL(`${baseUrl}v1/messages`);
  } else {
    // 默认拼接 /v1/messages
    url = new URL(`${baseUrl}/v1/messages`);
  }

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  });

  return new Promise((resolve, reject) => {
    let retried = false;
    const doRetry = (reason, res) => {
      if (retried) return;
      retried = true;
      if (retries < MAX_RETRIES) {
        const delay = res ? getRetryDelay(retries, res) : BASE_RETRY_DELAY * Math.pow(2, retries);
        console.log(`${reason}，${Math.round(delay / 1000)}秒后重试 (${retries + 1}/${MAX_RETRIES})...`);
        setTimeout(() => callAnthropic(prompt, options, retries + 1).then(resolve).catch(reject), delay);
      } else {
        reject(new Error(reason));
      }
    };

    const req = https.request(url, {
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
          setTimeout(() => callAnthropic(prompt, options, retries + 1).then(resolve).catch(reject), delay);
          return;
        }
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
          } else {
            resolve(json.content[0].text);
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${data}`));
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

module.exports = { generateWithAI, callOpenAI, callAnthropic };
