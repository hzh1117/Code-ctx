const fs = require('fs');
const path = require('path');
const { detectProjects } = require('../scanner/project-detector');
const { scanProject } = require('../scanner/file-scanner');
const { getAIConfig } = require('../utils/config');
const { generateWithAI } = require('../ai/client');

async function initCommand(rootDir, options = {}) {
  console.log('🔍 扫描项目结构...');

  const projects = detectProjects(rootDir);
  console.log(`检测到 ${projects.length} 个子项目`);

  const outputDir = path.join(rootDir, 'ai-docs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const scanResults = {};
  for (const project of projects) {
    console.log(`扫描 ${project.name} (${project.type})...`);
    scanResults[project.alias] = scanProject(project.path, project.type);
  }

  const config = {
    projectName: path.basename(rootDir),
    outputDir: './ai-docs',
    aiMode: 'clipboard',
    projects: projects.map(p => ({
      alias: p.alias,
      path: `./${p.name}`,
      type: p.type,
      label: p.name
    })),
    excludeDirs: ['node_modules', '.git', 'dist', 'build', 'ai-docs'],
    gitTrack: true
  };

  const configPath = path.join(rootDir, 'code-ctx.config.js');
  fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(config, null, 2)};\n`);

  // 生成文档
  if (options.generateDocs !== false) {
    console.log('\n📝 生成项目文档...');
    
    try {
      const aiConfig = getAIConfig(rootDir);
      
      console.log('配置信息:');
      console.log('  协议:', aiConfig.protocol);
      console.log('  地址:', aiConfig.baseUrl);
      console.log('  模型:', aiConfig.model);
      console.log('  API Key:', aiConfig.apiKey ? '***' + aiConfig.apiKey.slice(-4) : '未配置');
      
      if (!aiConfig.apiKey) {
        console.log('\n⚠️ 未配置 API Key，请先在 .env 文件中配置');
        console.log('然后运行: code-ctx use "生成项目文档"');
      } else {
        // 生成 OVERVIEW.md
        console.log('\n生成 OVERVIEW.md...');
        const overviewPrompt = generateOverviewPrompt(config, scanResults);
        const overview = await generateWithAI(overviewPrompt, aiConfig);
        fs.writeFileSync(path.join(outputDir, 'OVERVIEW.md'), overview);
        
        // 生成各子项目文档
        for (const project of projects) {
          console.log(`生成 ${project.alias}.md...`);
          const projectPrompt = generateProjectPrompt(project, scanResults[project.alias]);
          const doc = await generateWithAI(projectPrompt, aiConfig);
          fs.writeFileSync(path.join(outputDir, `${project.alias}.md`), doc);
        }
        
        console.log('\n✓ 文档生成完成！');
      }
    } catch (err) {
      console.error('\n❌ 文档生成失败:', err.message);
      console.log('请检查 API 配置，然后运行: code-ctx use "生成项目文档"');
    }
  }

  console.log('\n✓ 初始化完成！');
  console.log(`ai-docs/ 已创建`);
  console.log('\n下一步：');
  console.log('  开始开发前：  code-ctx use "你的任务描述"');
  console.log('  代码有大改动：code-ctx update');
  console.log('  检查文档健康：code-ctx doctor');

  return { projects, config };
}

function generateOverviewPrompt(config, scanResults) {
  return `请为以下项目生成一个总览文档（OVERVIEW.md）。

项目名称：${config.projectName}
子项目列表：
${config.projects.map(p => `- ${p.alias}: ${p.label} (${p.type})`).join('\n')}

请生成以下内容：
1. 项目概述（一句话描述）
2. 子项目列表及其职责
3. 技术栈说明
4. 项目关系图（哪个前端调用哪个后端）

请用 Markdown 格式输出。`;
}

function generateProjectPrompt(project, scanResult) {
  return `请为以下子项目生成结构文档。

项目名称：${project.name}
项目类型：${project.type}
项目路径：${project.path}

目录结构：
${scanResult.tree}

请生成以下内容：
1. 项目概述
2. 目录结构说明
3. 核心模块说明
4. 开发注意事项

请用 Markdown 格式输出。`;
}

module.exports = { initCommand };
