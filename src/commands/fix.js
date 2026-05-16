const fs = require('fs');
const path = require('path');
const { scanProject } = require('../scanner/file-scanner');
const { getAIConfig, loadConfigWithVM } = require('../utils/config');
const { generateWithAI } = require('../ai/client');
const { filterSensitive } = require('../utils/sensitive-filter');
const { buildInitPrompt } = require('../generator/prompt-builder');

async function fixCommand(rootDir, projectAlias, options = {}) {
  const configPath = path.join(rootDir, 'code-ctx.config.js');

  if (!fs.existsSync(configPath)) {
    throw new Error('配置文件不存在，请先运行 code-ctx init');
  }

  const config = loadConfigWithVM(configPath);
  const project = (config.projects || []).find(p => p.alias === projectAlias);

  if (!project) {
    throw new Error(`未找到项目: ${projectAlias}`);
  }

  const projectDir = path.join(rootDir, project.path);
  const scanResult = scanProject(projectDir, project.type);

  const prompt = buildInitPrompt({
    project,
    scanResult
  });

  if (options.dryRun) {
    return { project: projectAlias, prompt };
  }

  const aiConfig = getAIConfig(rootDir);
  if (aiConfig.apiKey) {
    console.log(`正在重新生成 ${projectAlias}.md...`);
    try {
      const doc = await generateWithAI(prompt, aiConfig);
      const safeDoc = filterSensitive(doc).content;

      const docDir = path.join(rootDir, config.outputDir || 'ai-docs');
      if (!fs.existsSync(docDir)) {
        fs.mkdirSync(docDir, { recursive: true });
      }
      fs.writeFileSync(path.join(docDir, `${projectAlias}.md`), safeDoc);
      console.log(`✓ ${projectAlias}.md 已重新生成`);
      return { project: projectAlias, generated: true };
    } catch (err) {
      console.error(`⚠️ AI 生成失败: ${err.message}`);
      console.log('prompt 已生成，请手动粘贴给 AI：');
      console.log(prompt);
      return { project: projectAlias, prompt, generated: false, error: err.message };
    }
  } else {
    console.log('未配置 API Key，生成 prompt 供手动使用：');
    console.log(prompt);
    return { project: projectAlias, prompt, generated: false };
  }
}

module.exports = { fixCommand };
