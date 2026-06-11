const fs = require('fs');
const path = require('path');
const { loadProjectConfig } = require('../../../utils/config');
const { isWithinDir } = require('../../../utils/file-reader');
const { runDoctor } = require('../../../commands/doctor');
const { getHistory } = require('../../../utils/task-history');
const { STATE_FILES } = require('../../../utils/constants');
const { scoreDocs } = require('../../../utils/doc-quality');
const { buildDocumentsList } = require('../helpers');

module.exports = function register(router, rootDir) {
  router.get('/status', async (req, res) => {
    try {
      const aiDocsDir = path.join(rootDir, 'ai-docs');
      const result = {
        exists: fs.existsSync(aiDocsDir),
        documents: [],
        docCount: 0,
        lastScanTime: null,
        historyCount: 0,
        healthStatus: '未初始化',
        recentHistory: []
      };

      if (result.exists) {
        const config = loadProjectConfig(rootDir);
        const rawProjects = config.projects || [];
        const projectsArray = Array.isArray(rawProjects)
          ? rawProjects
          : Object.entries(rawProjects).map(([alias, proj]) => ({ alias, ...proj }));

        const expectedDocs = projectsArray.map(p => `${p.alias}.md`);
        expectedDocs.push('OVERVIEW.md');

        const lastScanPath = path.join(aiDocsDir, STATE_FILES.LAST_SCAN);
        if (fs.existsSync(lastScanPath)) {
          try {
            const lastScan = JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
            result.lastScanTime = lastScan.timestamp || null;
          } catch (err) {
            console.debug(`[status] read lastScan skipped: ${err.message}`);
          }
        }

        const history = getHistory(rootDir);
        result.historyCount = history.length;
        result.recentHistory = history.slice().reverse().slice(0, 5);

        result.documents = buildDocumentsList(aiDocsDir, projectsArray, expectedDocs, rootDir, isWithinDir);
        result.docCount = result.documents.filter(doc => doc.exists).length;
      }

      const doctorReport = await runDoctor({ rootDir, silent: true });
      result.doctor = {
        issueCount: doctorReport.issues.length,
        warningCount: doctorReport.warnings.length
      };

      result.docQuality = doctorReport.quality || scoreDocs(rootDir);

      if (doctorReport.issues.length > 0 || result.docQuality.overall === 'HIGH_RISK') {
        result.healthStatus = '异常';
      } else if (doctorReport.warnings.length > 0 || result.documents.some(doc => doc.stale) || result.docQuality.overall === 'WARN') {
        result.healthStatus = '警告';
      } else if (result.exists) {
        result.healthStatus = '正常';
      }

      res.json(result);
    } catch (err) {
      console.error('Status error:', err.message);
      res.status(500).json({ error: '状态查询失败' });
    }
  });
};
