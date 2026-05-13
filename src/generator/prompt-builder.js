const { renderTemplate, loadTemplate } = require('../template/engine');

const LABELS = {
  zh: {
    part1: '【第一部分：项目上下文】',
    readPrompt: '请先阅读以下项目文档，建立上下文，读完回复"已就绪"：',
    overview: '=== 系统总览 ===',
    projectRelation: '=== 项目关系 ===',
    part2: '【第二部分：任务模板】',
    taskHint: '（请根据以下任务描述执行开发）',
    otherDocs: '其他子项目文档摘要（供参考）：',
    projectName: '项目名称',
    projectType: '项目类型',
    projectPath: '项目路径',
    dirStructure: '目录结构',
    keyFiles: '关键文件'
  },
  en: {
    part1: '[Part 1: Project Context]',
    readPrompt: 'Please read the following project documents to establish context, reply "Ready" when done:',
    overview: '=== System Overview ===',
    projectRelation: '=== Project Relations ===',
    part2: '[Part 2: Task Template]',
    taskHint: '(Please implement based on the following task description)',
    otherDocs: 'Other sub-project document summaries (for reference):',
    projectName: 'Project Name',
    projectType: 'Project Type',
    projectPath: 'Project Path',
    dirStructure: 'Directory Structure',
    keyFiles: 'Key Files'
  }
};

function getLabels(language) {
  return LABELS[language] || LABELS.zh;
}

function buildUsePrompt({ taskDescription, projectContext, overviewContent, relatedDocs, template, language }) {
  const labels = getLabels(language);
  const parts = [];

  parts.push(labels.part1);
  parts.push(labels.readPrompt);
  parts.push('');

  if (overviewContent) {
    parts.push(labels.overview);
    parts.push(overviewContent);
    parts.push('');
  }

  if (projectContext) {
    parts.push(labels.projectRelation);
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

  parts.push(labels.part2);
  parts.push(labels.taskHint);
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

function buildInitPrompt({ project, scanResult, type, config, generatedDocs, projects, scanResults, otherDocs, language }) {
  const labels = getLabels(language);

  if (type === 'overview') {
    const configObj = config || {};
    const projectSummaries = (configObj.projects || []).map(p => {
      const doc = (generatedDocs || {})[p.alias] || '';
      const lines = doc.split('\n');
      const summary = lines.slice(0, 20).join('\n');
      return `### ${p.alias} (${p.label}, ${p.type})\n${summary}\n`;
    }).join('\n');

    const tpl = loadTemplate('scan-prompt-overview.md', language);
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
${labels.projectName}：${p.name}
${labels.projectType}：${p.type}
${labels.projectPath}：${p.path}

${labels.dirStructure}：
${result.tree || ''}

${labels.keyFiles}：
${(result.keyFiles || []).join('\n')}`;
    }).join('\n\n---\n\n');

    const tpl = loadTemplate('scan-prompt-one-shot.md', language);
    return renderTemplate(tpl, { projectSections });
  }

  const projectObj = project || {};
  const scanObj = scanResult || {};

  let otherDocsSection = '';
  if (otherDocs && Object.keys(otherDocs).length > 0) {
    otherDocsSection = labels.otherDocs;
    for (const [alias, doc] of Object.entries(otherDocs)) {
      const lines = doc.split('\n');
      const summary = lines.slice(0, 15).join('\n');
      otherDocsSection += `\n\n### ${alias}\n${summary}`;
    }
  }

  const tpl = loadTemplate('scan-prompt.md', language);
  return renderTemplate(tpl, {
    projectName: projectObj.name || '',
    projectType: projectObj.type || '',
    projectPath: projectObj.path || '',
    tree: scanObj.tree || '',
    keyFiles: (scanObj.keyFiles || []).join('\n'),
    otherDocsSection
  });
}

module.exports = { buildUsePrompt, buildInitPrompt, getLabels };
