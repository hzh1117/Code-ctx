const fs = require('fs');
const path = require('path');
const { detectProjects } = require('../scanner/project-detector');
const { scanProject } = require('../scanner/file-scanner');

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

  console.log('\n✓ 初始化完成！');
  console.log(`ai-docs/ 已创建`);
  console.log('\n下一步：');
  console.log('  开始开发前：  code-ctx use "你的任务描述"');
  console.log('  代码有大改动：code-ctx update');
  console.log('  检查文档健康：code-ctx doctor');

  return { projects, config };
}

module.exports = { initCommand };
