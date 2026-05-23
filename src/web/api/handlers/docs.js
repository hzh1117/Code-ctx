const fs = require('fs');
const path = require('path');

module.exports = function register(router, rootDir) {
  router.get('/docs/:name', (req, res) => {
    try {
      const fileName = path.basename(req.params.name);
      if (!fileName.endsWith('.md')) {
        return res.status(400).json({ error: '只支持 Markdown 文档' });
      }

      const allowedDir = path.resolve(rootDir, 'ai-docs');
      const docPath = path.resolve(allowedDir, fileName);
      if (!docPath.startsWith(allowedDir + path.sep) && docPath !== allowedDir) {
        return res.status(403).json({ error: '禁止访问该路径' });
      }

      if (!fs.existsSync(docPath)) {
        return res.status(404).json({ error: '文档不存在' });
      }

      res.json({
        name: fileName,
        content: fs.readFileSync(docPath, 'utf8')
      });
    } catch (err) {
      console.error('Doc read error:', err.message);
      res.status(500).json({ error: '文档读取失败' });
    }
  });
};
