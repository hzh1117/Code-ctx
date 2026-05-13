function buildUsePrompt({ taskDescription, projectContext, overviewContent, relatedDocs, template }) {
  const parts = [];

  parts.push('【第一部分：项目上下文】');
  parts.push('请先阅读以下项目文档，建立上下文，读完回复"已就绪"：');
  parts.push('');

  if (overviewContent) {
    parts.push('=== 系统总览 ===');
    parts.push(overviewContent);
    parts.push('');
  }

  if (projectContext) {
    parts.push('=== 项目关系 ===');
    parts.push(projectContext);
    parts.push('');
  }

  if (relatedDocs && Object.keys(relatedDocs).length > 0) {
    for (const [name, content] of Object.entries(relatedDocs)) {
      parts.push(`=== ${name} ===`);
      parts.push(content);
      parts.push('');
    }
  }

  parts.push('【第二部分：任务模板】');
  parts.push('（请根据以下任务描述执行开发）');
  parts.push('');

  if (template) {
    const renderedTemplate = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const vars = { featureName: taskDescription, projectName: '', apiPrefix: '/api/' };
      return vars[key] !== undefined ? vars[key] : match;
    });
    parts.push(renderedTemplate);
  } else {
    parts.push(taskDescription || '');
  }

  return parts.join('\n');
}

function buildInitPrompt({ project, scanResult, type, config, generatedDocs }) {
  if (type === 'overview') {
    const configObj = config || {};
    const projectSummaries = (configObj.projects || []).map(p => {
      const doc = (generatedDocs || {})[p.alias] || '';
      const lines = doc.split('\n');
      const summary = lines.slice(0, 20).join('\n');
      return `### ${p.alias} (${p.label}, ${p.type})\n${summary}\n`;
    }).join('\n');

    return `请为以下项目生成一个总览文档（OVERVIEW.md）。

项目名称：${configObj.projectName || ''}
子项目列表：
${(configObj.projects || []).map(p => `- ${p.alias}: ${p.label} (${p.type})`).join('\n')}

已生成的子项目文档摘要：
${projectSummaries}

请生成以下内容：
1. 项目概述（一句话描述）
2. 子项目列表及其职责
3. 技术栈说明
4. 项目关系图（哪个前端调用哪个后端）

请用 Markdown 格式输出。`;
  }

  const projectObj = project || {};
  const scanObj = scanResult || {};

  return `请为以下子项目生成结构文档。

项目名称：${projectObj.name || ''}
项目类型：${projectObj.type || ''}
项目路径：${projectObj.path || ''}

目录结构：
${scanObj.tree || ''}

关键文件：
${(scanObj.keyFiles || []).join('\n')}

请生成以下内容：
1. 项目概述
2. 目录结构说明
3. 核心模块说明
4. 开发注意事项

请用 Markdown 格式输出。`;
}

module.exports = { buildUsePrompt, buildInitPrompt };
