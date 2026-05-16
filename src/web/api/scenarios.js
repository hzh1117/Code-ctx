const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadProjectConfig } = require('../../utils/config');
const { filterSensitive } = require('../../utils/sensitive-filter');
const { getScenarios, clearCache } = require('../../template/engine');
const { isWithinDir } = require('../../utils/file-reader');
const { buildContext, useCommand } = require('../../commands/use');
const { listSections } = require('../../core/section');
const { updateCommand } = require('../../commands/update');
const { runDoctor } = require('../../commands/doctor');
const { getHistory } = require('../../utils/task-history');
const { STATE_FILES } = require('../../utils/constants');

const MAX_TEMPLATE_LENGTH = 10000;
const VALID_SCENARIO_ID_PATTERN = /^[A-H]$/;

module.exports = function(rootDir) {
  const router = express.Router();

  router.get('/scenarios', (req, res) => {
    try {
      const scenarios = getScenarios();
      const scenarioList = scenarios.map(s => ({
        id: s.id,
        key: s.id,
        name: s.name,
        description: s.description || '',
        relatedProjects: s.relatedProjects || [],
        template: s.template || ''
      }));
      res.json(scenarioList);
    } catch (err) {
      console.error('Scenarios load error:', err.message);
      res.status(500).json({ error: '场景加载失败' });
    }
  });

  router.put('/scenarios/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { template } = req.body || {};

      if (typeof template !== 'string') {
        return res.status(400).json({ error: 'template 必须是字符串' });
      }
      if (template.length > MAX_TEMPLATE_LENGTH) {
        return res.status(400).json({ error: `template 长度不能超过 ${MAX_TEMPLATE_LENGTH} 字符` });
      }

      const scenariosPath = path.join(__dirname, '../../../templates/scenarios.json');
      const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));

      // Validate id: must be A-H or exist in scenarios
      const isValidId = VALID_SCENARIO_ID_PATTERN.test(id) || scenarios.some(s => s.id === id);
      if (!isValidId) {
        return res.status(400).json({ error: `无效的场景 ID: ${id}` });
      }

      const scenario = scenarios.find(s => s.id === id);
      if (!scenario) {
        return res.status(404).json({ error: `未找到场景: ${id}` });
      }

      scenario.template = template;
      fs.writeFileSync(scenariosPath, JSON.stringify(scenarios, null, 2) + '\n');
      clearCache();
      res.json({ success: true });
    } catch (err) {
      console.error('Scenario update error:', err.message);
      res.status(500).json({ error: '场景更新失败' });
    }
  });

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

        const files = fs.readdirSync(aiDocsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        const lastScanPath = path.join(aiDocsDir, STATE_FILES.LAST_SCAN);
        if (fs.existsSync(lastScanPath)) {
          try {
            const lastScan = JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
            result.lastScanTime = lastScan.timestamp || null;
          } catch {}
        }

        const history = getHistory(rootDir);
        result.historyCount = history.length;
        result.recentHistory = history.slice().reverse().slice(0, 5);

        // 已存在的文档
        result.documents = mdFiles.map(file => {
          const filePath = path.join(aiDocsDir, file);
          const stats = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, 'utf8');
          return {
            name: file,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            mtime: stats.mtime.toISOString(),
            sections: listSections(content),
            exists: true,
            stale: false
          };
        });

        // 标记过期状态：对比文档修改时间与项目文件
        for (const doc of result.documents) {
          const docMtime = new Date(doc.lastModified).getTime();

          // 检查对应的子项目目录是否有更新的文件
          const alias = doc.name.replace('.md', '');
          const project = projectsArray.find(p => p.alias === alias);
          // Skip stale check when project.path is missing — cannot determine project directory
          if (project && project.path) {
            const projectDir = path.resolve(rootDir, project.path);
            if (isWithinDir(projectDir, rootDir) && fs.existsSync(projectDir)) {
              const latestMtime = getLatestMtime(projectDir);
              if (latestMtime > docMtime) {
                doc.stale = true;
              }
            }
          }
        }

        // 添加缺失的文档
        for (const expected of expectedDocs) {
          if (!mdFiles.includes(expected)) {
            result.documents.push({
              name: expected,
              size: 0,
              lastModified: null,
              mtime: null,
              sections: [],
              exists: false,
              stale: false
            });
          }
        }

        result.docCount = result.documents.filter(doc => doc.exists).length;
      }

      const doctorReport = await runDoctor({ rootDir, silent: true });
      result.doctor = {
        issueCount: doctorReport.issues.length,
        warningCount: doctorReport.warnings.length
      };
      if (doctorReport.issues.length > 0) {
        result.healthStatus = '异常';
      } else if (doctorReport.warnings.length > 0 || result.documents.some(doc => doc.stale)) {
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

  router.post('/update', async (req, res) => {
    try {
      const { dryRun } = req.body || {};
      const result = await updateCommand(rootDir, { dryRun: !!dryRun });
      res.json({ success: true, result });
    } catch (err) {
      console.error('Update error:', err.message);
      res.status(500).json({ success: false, error: '更新失败' });
    }
  });

  router.post('/generate-prompt', async (req, res) => {
    try {
      const { task, scenario } = req.body;
      const safeTask = filterSensitive(task || '').content;

      const result = await useCommand({
        taskDescription: safeTask,
        scenario,
        rootDir,
        noAiMatch: true,
        language: 'zh'
      });

      if (result.lowConfidenceScenarios) {
        return res.json({ success: false, ...result });
      }

      const prompt = await buildContext(safeTask, result.matchedScenario, {
        rootDir,
        noAiMatch: true,
        language: 'zh'
      });

      res.json({
        success: true,
        scenario: result.matchedScenario,
        scenarioName: result.scenarioName,
        prompt
      });
    } catch (err) {
      console.error('Generate prompt error:', err.message);
      res.status(500).json({ error: 'Prompt 生成失败' });
    }
  });

  return router;
};

function getLatestMtime(dirPath) {
  let latest = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
        const subMtime = getLatestMtime(fullPath);
        if (subMtime > latest) latest = subMtime;
      } else {
        const stats = fs.statSync(fullPath);
        if (stats.mtimeMs > latest) latest = stats.mtimeMs;
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'EACCES') {
      console.error('getLatestMtime error:', err.message);
    }
  }
  return latest;
}
