const http = require('http');

/**
 * Send a JSON request and parse the JSON response.
 * @param {http.Server} server - Listening server instance
 * @param {string} pathname - Request path
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {*} [options.body] - Will be JSON-stringified
 * @returns {Promise<{status: number, body: *, headers: object}>}
 */
function requestJson(server, pathname, options = {}) {
  const { port } = server.address();
  const body = options.body != null ? JSON.stringify(options.body) : null;
  const baseHeaders = body
    ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    : {};
  const headers = options.headers ? { ...baseHeaders, ...options.headers } : baseHeaders;
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Send a raw string body (not JSON-stringified) and parse the JSON response.
 * Used for testing prototype pollution via crafted JSON payloads.
 */
function requestRaw(server, pathname, rawBody, method = 'PUT') {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(rawBody)
      }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.write(rawBody);
    req.end();
  });
}

/**
 * Send a GET request and return the raw text body plus content-type.
 * Used for static file serving tests.
 */
function requestText(server, pathname) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port,
      path: pathname
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, contentType: res.headers['content-type'], body, headers: res.headers });
      });
    });
    req.on('error', reject);
  });
}

module.exports = { requestJson, requestRaw, requestText };
