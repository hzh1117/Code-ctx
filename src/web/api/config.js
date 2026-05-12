const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = function (rootDir) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const configPath = path.join(rootDir, 'code-ctx.config.js');
    if (fs.existsSync(configPath)) {
      delete require.cache[require.resolve(configPath)];
      const config = require(configPath);
      res.json(config);
    } else {
      res.json({ error: '配置文件不存在' });
    }
  });

  router.put('/', (req, res) => {
    const configPath = path.join(rootDir, 'code-ctx.config.js');
    const content = `module.exports = ${JSON.stringify(req.body, null, 2)};\n`;
    fs.writeFileSync(configPath, content);
    res.json({ success: true });
  });

  return router;
};
