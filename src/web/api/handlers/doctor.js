const fs = require('fs');
const path = require('path');
const { inspectProjectConfig } = require('../../../utils/config');
const { runDoctor } = require('../../../commands/doctor');
const { scoreDocs } = require('../../../utils/doc-quality');
const { getState: getPluginState } = require('../../../plugins/state');
const { scanDirectory: scanSensitive } = require('../../../utils/sensitive-filter');
const { deriveOverall } = require('../helpers');

module.exports = function register(router, rootDir) {
  router.get('/doctor', async (req, res) => {
    try {
      const report = await runDoctor({ rootDir, silent: true });
      const aiDocsDir = path.join(rootDir, 'ai-docs');
      const sensitive = fs.existsSync(aiDocsDir) ? scanSensitive(aiDocsDir) : [];

      const configInspection = inspectProjectConfig(rootDir);
      const schemaErrors = [...configInspection.errors, ...configInspection.warnings];
      const pluginState = getPluginState();

      res.json({
        overall: deriveOverall(report, schemaErrors, sensitive),
        issues: report.issues || [],
        warnings: report.warnings || [],
        info: report.info || {},
        docQuality: report.quality || scoreDocs(rootDir),
        sensitive,
        schemaErrors,
        plugins: {
          loaded: pluginState.plugins,
          errors: pluginState.errors
        }
      });
    } catch (err) {
      console.error('Doctor API error:', err.message);
      res.status(500).json({ error: 'doctor 接口失败' });
    }
  });
};
