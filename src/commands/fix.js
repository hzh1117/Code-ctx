const fs = require('fs');
const path = require('path');
const { scanProject } = require('../scanner/file-scanner');

async function fixCommand(rootDir, projectAlias, options = {}) {
  const configPath = path.join(rootDir, 'code-ctx.config.js');

  if (!fs.existsSync(configPath)) {
    throw new Error('配置文件不存在，请先运行 code-ctx init');
  }

  const config = require(configPath);
  const project = config.projects.find(p => p.alias === projectAlias);

  if (!project) {
    throw new Error(`未找到项目: ${projectAlias}`);
  }

  const projectDir = path.join(rootDir, project.path);
  const scanResult = scanProject(projectDir, project.type);

  const prompt = `请重新生成 ${project.name || project.alias} (${project.type}) 的文档。

项目结构：
${scanResult.tree}

关键文件：
${scanResult.keyFiles.join('\n')}

请生成完整的项目文档，包含：
1. 项目概述
2. 目录结构说明
3. 核心模块说明
4. 开发注意事项`;

  if (!options.dryRun) {
    const docPath = path.join(rootDir, config.outputDir || 'ai-docs', `${projectAlias}.md`);
    const docDir = path.dirname(docPath);
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }
    fs.writeFileSync(docPath, `# ${project.name || project.alias}\n\n> 自动生成中...`);
  }

  return { project: projectAlias, prompt };
}

module.exports = { fixCommand };
