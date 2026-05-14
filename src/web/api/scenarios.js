const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadProjectConfig } = require('../../utils/config');
const { filterSensitive } = require('../../utils/sensitive-filter');
const { getScenarios, clearCache } = require('../../template/engine');
const { buildUsePrompt } = require('../../generator/prompt-builder');
const { matchScenario } = require('../../matcher/scenario-matcher');
const { listSections } = require('../../core/section');
const { updateCommand } = require('../../commands/update');
const { getHistory } = require('../../utils/task-history');
const { STATE_FILES } = require('../../utils/constants');

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
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/scenarios/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { template } = req.body || {};
      if (typeof template !== 'string') {
        return res.status(400).json({ error: 'template 必须是字符串' });
      }

      const scenariosPath = path.join(__dirname, '../../../templates/scenarios.json');
      const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));
      const scenario = scenarios.find(s => s.id === id);
      if (!scenario) {
        return res.status(404).json({ error: `未找到场景: ${id}` });
      }

      scenario.template = template;
      fs.writeFileSync(scenariosPath, JSON.stringify(scenarios, null, 2) + '\n');
      clearCache();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/status', (req, res) => {
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
          if (project) {
            const projectDir = path.resolve(rootDir, project.path);
            if (fs.existsSync(projectDir)) {
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
        const hasMissing = result.documents.some(doc => !doc.exists);
        const hasStale = result.documents.some(doc => doc.stale);
        if (hasMissing) {
          result.healthStatus = '缺失文档';
        } else if (hasStale) {
          result.healthStatus = '待更新';
        } else {
          result.healthStatus = '正常';
        }
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/docs/:name', (req, res) => {
    try {
      const fileName = path.basename(req.params.name);
      if (!fileName.endsWith('.md')) {
        return res.status(400).json({ error: '只支持 Markdown 文档' });
      }

      const docPath = path.join(rootDir, 'ai-docs', fileName);
      if (!fs.existsSync(docPath)) {
        return res.status(404).json({ error: '文档不存在' });
      }

      res.json({
        name: fileName,
        content: fs.readFileSync(docPath, 'utf8')
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/update', async (req, res) => {
    try {
      const result = await updateCommand(rootDir, req.body || {});
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/generate-prompt', (req, res) => {
    try {
      const { task, scenario } = req.body;
      const safeTask = filterSensitive(task || '').content;
      const config = loadProjectConfig(rootDir);

      const scenarioMatch = matchScenario(safeTask);
      const matchedScenarioId = scenario || scenarioMatch.scenarioId;
      const scenarios = getScenarios();
      const matchedScenario = scenarios.find(s => s.id === matchedScenarioId);

      let template = '';
      if (matchedScenario) {
        template = matchedScenario.template || '';
      }

      // 读取 OVERVIEW.md 作为上下文
      const overviewPath = path.join(rootDir, 'ai-docs', 'OVERVIEW.md');
      let overviewContent = '';
      if (fs.existsSync(overviewPath)) {
        overviewContent = fs.readFileSync(overviewPath, 'utf8');
      }

      // 读取相关子项目文档
      const relatedDocs = {};
      if (matchedScenario && matchedScenario.relatedProjects) {
        for (const alias of matchedScenario.relatedProjects) {
          const docPath = path.join(rootDir, 'ai-docs', `${alias}.md`);
          if (fs.existsSync(docPath)) {
            const content = fs.readFileSync(docPath, 'utf8');
            const lines = content.split('\n');
            relatedDocs[alias] = lines.slice(0, 30).join('\n');
          }
        }
      }

      const prompt = buildUsePrompt({
        taskDescription: safeTask,
        overviewContent,
        relatedDocs,
        template,
        language: 'zh'
      });

      res.json({
        success: true,
        scenario: matchedScenarioId,
        scenarioName: matchedScenario ? matchedScenario.name : '未知',
        prompt
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
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
