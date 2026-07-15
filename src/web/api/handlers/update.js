const { updateCommand } = require('../../../commands/update');

module.exports = function register(router, rootDir) {
  router.post('/update', async (req, res) => {
    try {
      const result = await updateCommand(rootDir, { dryRun: true });
      res.json({ success: true, result });
    } catch (err) {
      console.error('Update error:', err.message);
      res.status(500).json({ success: false, error: '更新失败' });
    }
  });
};
