const { getHistory, getRecentHistory, findEntryById, summarizeEntryDiff } = require('../../../utils/task-history');

module.exports = function register(router, rootDir) {
  router.get('/history', (req, res) => {
    try {
      // Bound the response to a sensible default so a long history doesn't
      // blow up the Dashboard payload; the JSONL is also rotation-capped.
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      const items = getRecentHistory(rootDir, limit);
      res.json({ items, total: getHistory(rootDir).length });
    } catch (err) {
      console.error('History API error:', err.message);
      res.status(500).json({ error: '历史读取失败' });
    }
  });

  router.get('/history/diff', (req, res) => {
    try {
      const a = String(req.query.a || '');
      const b = String(req.query.b || '');
      if (!a || !b) {
        return res.status(400).json({ error: '需要提供 a 和 b 两个任务 ID' });
      }
      const entryA = findEntryById(rootDir, a);
      const entryB = findEntryById(rootDir, b);
      if (!entryA || !entryB) {
        return res.status(404).json({ error: '未找到对应的历史记录' });
      }
      res.json(summarizeEntryDiff(entryA, entryB));
    } catch (err) {
      console.error('History diff error:', err.message);
      res.status(500).json({ error: '历史 diff 失败' });
    }
  });
};
