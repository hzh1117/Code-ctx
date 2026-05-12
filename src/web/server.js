const express = require('express');
const path = require('path');
const fs = require('fs');

function createServer(rootDir) {
  const app = express();

  app.use(express.json());
  
  // 静态文件目录：优先使用构建后的 dist，否则使用 src/web/public
  const distDir = path.join(rootDir, 'web', 'dist');
  const publicDir = path.join(__dirname, 'public');
  const staticDir = fs.existsSync(distDir) ? distDir : publicDir;
  
  app.use(express.static(staticDir));

  app.use('/api/config', require('./api/config')(rootDir));
  app.use('/api/projects', require('./api/projects')(rootDir));
  app.use('/api/ai', require('./api/ai')(rootDir));
  app.use('/api', require('./api/prompt')(rootDir));

  app.get('/{*path}', (req, res) => {
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('请先构建前端：cd web && npm run build');
    }
  });

  return app;
}

function startServer(rootDir, port = 3456) {
  const app = createServer(rootDir);
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Dashboard 运行在 http://localhost:${port}`);
      resolve(server);
    });
  });
}

module.exports = { createServer, startServer };
