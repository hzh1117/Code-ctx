const fs = require('fs');
const http = require('http');
const path = require('path');
const { createServer } = require('../../src/web/server');

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
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, contentType: res.headers['content-type'], body });
      });
    });
    req.on('error', reject);
  });
}

describe('web static server', () => {
  const distDir = path.join(__dirname, '../../web/dist');
  const indexPath = path.join(distDir, 'index.html');
  let originalIndex = null;
  let hadIndex = false;
  let server;

  beforeEach((done) => {
    delete process.env.DASHBOARD_TOKEN;
    fs.mkdirSync(distDir, { recursive: true });
    hadIndex = fs.existsSync(indexPath);
    if (hadIndex) {
      originalIndex = fs.readFileSync(indexPath, 'utf8');
    }
    fs.writeFileSync(indexPath, '<!doctype html><div id="app">dashboard</div>');

    const app = createServer(__dirname);
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
    server.close(done);
    if (hadIndex) {
      fs.writeFileSync(indexPath, originalIndex);
    } else if (fs.existsSync(indexPath)) {
      fs.rmSync(indexPath, { force: true });
    }
  });

  test('serves built dashboard index from root path', async () => {
    const res = await requestText(server, '/');

    expect(res.status).toBe(200);
    expect(res.body).toContain('<div id="app">dashboard</div>');
  });

  test('falls back to index.html for SPA routes', async () => {
    const res = await requestText(server, '/projects');

    expect(res.status).toBe(200);
    expect(res.body).toContain('<div id="app">dashboard</div>');
  });
});
