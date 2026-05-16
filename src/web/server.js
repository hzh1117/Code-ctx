const express = require('express');
const path = require('path');
const fs = require('fs');
const { securityHeaders, localhostOnly, tokenAuth } = require('./middleware/security');

function createServer(rootDir) {
  const app = express();

  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));

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

  // Error handling middleware (must be last)
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: '请求体过大' });
    }
    console.error('Server error:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  });

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
