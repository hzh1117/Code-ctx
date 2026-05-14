const express = require('express');
const path = require('path');
const fs = require('fs');
const { localhostOnly, tokenAuth } = require('./middleware/security');

function createServer(rootDir) {
  const app = express();

  app.use(express.json());

  // Security middleware
  app.use('/api', localhostOnly);
  app.use('/api', tokenAuth);

  // API 路由
  app.use('/api/config', require('./api/config')(rootDir));
  app.use('/api/projects', require('./api/projects')(rootDir));
  app.use('/api/ai', require('./api/ai')(rootDir));
  app.use('/api', require('./api/scenarios')(rootDir));

  const distPath = path.join(__dirname, '../../web/dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

function startServer(rootDir, port = 3456) {
  const app = createServer(rootDir);
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`API 服务器运行在 http://localhost:${port}`);
      resolve(server);
    });
  });
}

module.exports = { createServer, startServer };
