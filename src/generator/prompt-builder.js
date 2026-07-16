const { renderTemplate, loadTemplate } = require('../template/engine');
const { CONTEXT_LIMITS } = require('../utils/constants');
const path = require('path');
const { extractSection } = require('../core/section');

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
    keyFiles: '关键文件',
    sourceEvidence: '源码证据',
    adapterHints: '技术栈分析提示'
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
    keyFiles: 'Key Files',
    sourceEvidence: 'Source Evidence',
    adapterHints: 'Stack Analysis Hints'
  }
};

function getLabels(language) {
  return LABELS[language] || LABELS.zh;
}

function limitText(value, maxChars, label) {
  const text = String(value || '');
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n[${label} truncated at ${maxChars} chars]`;
}

function formatSourceFiles(sourceFiles) {
  if (!Array.isArray(sourceFiles) || sourceFiles.length === 0) return '';

  return sourceFiles
    .map(file => {
      const truncation = file.truncation || {};
      const metadata = [
        `path=${JSON.stringify(file.path || '')}`,
        `language=${JSON.stringify(file.language || 'text')}`,
        `sha256=${JSON.stringify(file.hash || '')}`,
        `truncated=${truncation.truncated === true}`,
        `includedChars=${truncation.includedChars ?? String(file.content || '').length}`,
        `originalChars=${truncation.originalChars ?? String(file.content || '').length}`
      ];
      if (truncation.reason) metadata.push(`reason=${JSON.stringify(truncation.reason)}`);
      if (file.redactions) metadata.push(`redactions=${file.redactions}`);

      return `<source ${metadata.join(' ')}>\n${file.content || ''}\n</source>`;
    })
    .join('\n\n');
}

function relativeProjectPath(projectPath) {
  if (!projectPath) return '';
  if (!path.isAbsolute(projectPath)) return String(projectPath).replace(/\\/g, '/');

  const relative = path.relative(process.cwd(), projectPath);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.replace(/\\/g, '/');
  }
  return path.basename(projectPath);
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

const OVERVIEW_SUMMARY_SECTIONS = ['overview', 'modules', 'api', 'data', 'dependencies', 'notes', 'quickstart'];

function summarizeProjectDocument(doc) {
  const sections = OVERVIEW_SUMMARY_SECTIONS.map(section => {
    const content = extractSection(doc || '', section);
    if (content == null) return null;
    return `#### section:${section}\n${limitText(content.trim(), 1200, section)}`;
  }).filter(Boolean);
  return sections.length > 0 ? sections.join('\n\n') : '(no structured sections available)';
}

function buildRelationshipEvidence(projects, scanResults) {
  const aliases = new Set(projects.map(project => project.alias));
  const evidence = [];
  for (const project of projects) {
    const sources = scanResults?.[project.alias]?.sourceFiles || [];
    for (const source of sources) {
      if (source.path === 'package.json') {
        try {
          const pkg = JSON.parse(source.content);
          const dependencies = {
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {}),
            ...(pkg.peerDependencies || {})
          };
          for (const dependency of Object.keys(dependencies)) {
            if (aliases.has(dependency) && dependency !== project.alias) {
              evidence.push(`- [${project.alias}:${source.path}] dependency -> ${dependency}`);
            }
          }
          if (pkg.workspaces) {
            evidence.push(
              `- [${project.alias}:${source.path}] workspace declaration: ${JSON.stringify(pkg.workspaces)}`
            );
          }
        } catch {
          // Truncated or non-JSON package evidence is handled by import evidence below.
        }
      }

      const imports = source.content.matchAll(/(?:from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g);
      for (const match of imports) {
        const target = [...aliases].find(alias => alias !== project.alias && match[1].includes(alias));
        if (target) evidence.push(`- [${project.alias}:${source.path}] import "${match[1]}" -> ${target}`);
      }
    }
  }
  return evidence.length > 0
    ? [...new Set(evidence)].join('\n')
    : '- No cross-project relationship evidence found. Do not infer project calls or data flow.';
}

function buildOverviewPrompt({ config, generatedDocs, scanResults, language } = {}) {
  const configObj = config || {};
  const projects = configObj.projects || [];
  const docs = generatedDocs || {};

  const projectSummaries = limitText(
    projects
      .map(p => {
        const doc = docs[p.alias] || '';
        const summary = summarizeProjectDocument(doc);
        return `### ${p.alias} (${p.label}, ${p.type})\n${summary}\n`;
      })
      .join('\n'),
    CONTEXT_LIMITS.MAX_OTHER_DOCS_CHARS,
    'project summaries'
  );

  const tpl = loadTemplate('scan-prompt-overview.md', language);
  return renderTemplate(tpl, {
    projectName: configObj.projectName || '',
    projectList: projects.map(p => `- ${p.alias}: ${p.label} (${p.type})`).join('\n'),
    projectSummaries,
    relationshipEvidence: buildRelationshipEvidence(projects, scanResults || {})
  });
}

function buildOneShotPrompt({ projects, scanResults, language } = {}) {
  const labels = getLabels(language);
  const projectList = projects || [];
  const results = scanResults || {};

  const projectSections = projectList
    .map(p => {
      const result = results[p.alias] || {};
      return `## ${p.alias}
${labels.projectName}：${p.name}
${labels.projectType}：${p.type}
${labels.projectPath}：${relativeProjectPath(p.path)}

${labels.dirStructure}：
${limitText(result.tree, CONTEXT_LIMITS.MAX_TREE_CHARS, 'tree')}

${labels.keyFiles}：
${(result.sourceFiles || []).map(file => file.path).join('\n') || (result.keyFiles || []).join('\n')}

${labels.sourceEvidence}：
${formatSourceFiles(result.sourceFiles)}

${labels.adapterHints}：
${result.promptHints || ''}`;
    })
    .join('\n\n---\n\n');

  const tpl = loadTemplate('scan-prompt-one-shot.md', language);
  return renderTemplate(tpl, { projectSections });
}

function buildSubprojectPrompt({ project, scanResult, otherDocs, language } = {}) {
  const labels = getLabels(language);
  const projectObj = project || {};
  const scanObj = scanResult || {};

  let otherDocsSection = '';
  if (otherDocs && Object.keys(otherDocs).length > 0) {
    otherDocsSection = labels.otherDocs;
    for (const [alias, doc] of Object.entries(otherDocs)) {
      const summary = doc.split('\n').slice(0, 15).join('\n');
      otherDocsSection += `\n\n### ${alias}\n${summary}`;
    }
    otherDocsSection = limitText(otherDocsSection, CONTEXT_LIMITS.MAX_OTHER_DOCS_CHARS, 'other docs');
  }

  const tpl = loadTemplate('scan-prompt.md', language);
  return renderTemplate(tpl, {
    projectName: projectObj.name || '',
    projectType: projectObj.type || '',
    projectPath: relativeProjectPath(projectObj.path),
    tree: limitText(scanObj.tree, CONTEXT_LIMITS.MAX_TREE_CHARS, 'tree'),
    keyFiles: (scanObj.sourceFiles || []).map(file => file.path).join('\n') || (scanObj.keyFiles || []).join('\n'),
    sourceEvidence: formatSourceFiles(scanObj.sourceFiles),
    otherDocsSection: [scanObj.promptHints ? `${labels.adapterHints}：\n${scanObj.promptHints}` : '', otherDocsSection]
      .filter(Boolean)
      .join('\n\n')
  });
}

// 兼容分发层：根据 type 派发到专用函数
// 新代码请直接调用 buildOverviewPrompt / buildOneShotPrompt / buildSubprojectPrompt
function buildInitPrompt({
  project,
  scanResult,
  type,
  config,
  generatedDocs,
  projects,
  scanResults,
  otherDocs,
  language
} = {}) {
  if (type === 'overview') {
    return buildOverviewPrompt({ config, generatedDocs, scanResults, language });
  }
  if (type === 'one-shot') {
    return buildOneShotPrompt({ projects, scanResults, language });
  }
  return buildSubprojectPrompt({ project, scanResult, otherDocs, language });
}

function categorizeFiles(keyFiles) {
  const categories = {
    controllerFiles: [],
    serviceFiles: [],
    entityFiles: [],
    repositoryFiles: [],
    configFiles: []
  };

  for (const file of keyFiles) {
    const normalizedPath = file.replace(/\\/g, '/').toLowerCase();

    if (normalizedPath.includes('/controller/') || normalizedPath.includes('controller.java')) {
      categories.controllerFiles.push(file);
    } else if (normalizedPath.includes('/service/') || normalizedPath.includes('service.java')) {
      categories.serviceFiles.push(file);
    } else if (
      normalizedPath.includes('/entity/') ||
      normalizedPath.includes('/model/') ||
      normalizedPath.includes('entity.java')
    ) {
      categories.entityFiles.push(file);
    } else if (
      normalizedPath.includes('/repository/') ||
      normalizedPath.includes('/mapper/') ||
      normalizedPath.includes('repository.java') ||
      normalizedPath.includes('mapper.java')
    ) {
      categories.repositoryFiles.push(file);
    } else if (
      normalizedPath.includes('application.yml') ||
      normalizedPath.includes('application.properties') ||
      normalizedPath.includes('pom.xml') ||
      normalizedPath.includes('build.gradle')
    ) {
      categories.configFiles.push(file);
    }
  }

  return categories;
}

function buildApiPrompt({ project, scanResult, language }) {
  const projectObj = project || {};
  const scanObj = scanResult || {};

  const displayFiles = (scanObj.sourceFiles || []).map(file => file.path);
  const categories = categorizeFiles(displayFiles.length > 0 ? displayFiles : scanObj.keyFiles || []);

  const tpl = loadTemplate('java-api-prompt.md', language);
  return renderTemplate(tpl, {
    projectName: projectObj.name || '',
    projectType: projectObj.type || '',
    projectPath: relativeProjectPath(projectObj.path),
    tree: scanObj.tree || '',
    controllerFiles: categories.controllerFiles.join('\n') || '未找到 Controller 文件',
    serviceFiles: categories.serviceFiles.join('\n') || '未找到 Service 文件',
    sourceEvidence: formatSourceFiles(scanObj.sourceFiles)
  });
}

function buildDatabasePrompt({ project, scanResult, language }) {
  const projectObj = project || {};
  const scanObj = scanResult || {};

  const displayFiles = (scanObj.sourceFiles || []).map(file => file.path);
  const categories = categorizeFiles(displayFiles.length > 0 ? displayFiles : scanObj.keyFiles || []);

  const tpl = loadTemplate('java-database-prompt.md', language);
  return renderTemplate(tpl, {
    projectName: projectObj.name || '',
    projectType: projectObj.type || '',
    projectPath: relativeProjectPath(projectObj.path),
    tree: scanObj.tree || '',
    entityFiles: categories.entityFiles.join('\n') || '未找到 Entity/Model 文件',
    repositoryFiles: categories.repositoryFiles.join('\n') || '未找到 Repository/Mapper 文件',
    configFiles: categories.configFiles.join('\n') || '未找到配置文件',
    sourceEvidence: formatSourceFiles(scanObj.sourceFiles)
  });
}

module.exports = {
  buildUsePrompt,
  buildInitPrompt,
  buildOverviewPrompt,
  buildOneShotPrompt,
  buildSubprojectPrompt,
  buildApiPrompt,
  buildDatabasePrompt,
  formatSourceFiles,
  getLabels
};
