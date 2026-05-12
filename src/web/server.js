const express = require('express');
const path = require('path');

function createServer(rootDir) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api/config', require('./api/config')(rootDir));
  app.use('/api/projects', require('./api/projects')(rootDir));
  app.use('/api/ai', require('./api/ai')(rootDir));

  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
