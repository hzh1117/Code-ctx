const { renderTemplate, loadTemplate } = require('../template/engine');

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

function buildInitPrompt({ project, scanResult, type, config, generatedDocs, projects, scanResults, otherDocs }) {
  if (type === 'overview') {
    const configObj = config || {};
    const projectSummaries = (configObj.projects || []).map(p => {
      const doc = (generatedDocs || {})[p.alias] || '';
      const lines = doc.split('\n');
      const summary = lines.slice(0, 20).join('\n');
      return `### ${p.alias} (${p.label}, ${p.type})\n${summary}\n`;
    }).join('\n');

    const tpl = loadTemplate('scan-prompt-overview.md');
    return renderTemplate(tpl, {
      projectName: configObj.projectName || '',
      projectList: (configObj.projects || []).map(p => `- ${p.alias}: ${p.label} (${p.type})`).join('\n'),
      projectSummaries
    });
  }

  if (type === 'one-shot') {
    const projectList = projects || [];
    const results = scanResults || {};
    const projectSections = projectList.map(p => {
      const result = results[p.alias] || {};
      return `## ${p.alias}
项目名称：${p.name}
项目类型：${p.type}
项目路径：${p.path}

目录结构：
${result.tree || ''}

关键文件：
${(result.keyFiles || []).join('\n')}`;
    }).join('\n\n---\n\n');

    const tpl = loadTemplate('scan-prompt-one-shot.md');
    return renderTemplate(tpl, { projectSections });
  }

  const projectObj = project || {};
  const scanObj = scanResult || {};

  let otherDocsSection = '';
  if (otherDocs && Object.keys(otherDocs).length > 0) {
    otherDocsSection = '其他子项目文档摘要（供参考）：';
    for (const [alias, doc] of Object.entries(otherDocs)) {
      const lines = doc.split('\n');
      const summary = lines.slice(0, 15).join('\n');
      otherDocsSection += `\n\n### ${alias}\n${summary}`;
    }
  }

  const tpl = loadTemplate('scan-prompt.md');
  return renderTemplate(tpl, {
    projectName: projectObj.name || '',
    projectType: projectObj.type || '',
    projectPath: projectObj.path || '',
    tree: scanObj.tree || '',
    keyFiles: (scanObj.keyFiles || []).join('\n'),
    otherDocsSection
  });
}

module.exports = { buildUsePrompt, buildInitPrompt };
