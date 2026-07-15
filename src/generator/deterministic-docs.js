const fs = require('fs');
const path = require('path');

function portableRelative(rootDir, targetPath) {
  const relative = path.relative(rootDir, targetPath).split(path.sep).join('/');
  return relative ? `./${relative}` : '.';
}

function dependencyEvidence(scanResult) {
  const sourceFiles = scanResult?.sourceFiles || [];
  const evidence = [];
  for (const source of sourceFiles) {
    const base = path.posix.basename(source.path);
    if (base === 'package.json' && !source.truncation?.truncated) {
      try {
        const pkg = JSON.parse(source.content);
        const dependencies = [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {})
        ].sort();
        evidence.push({ path: source.path, dependencies });
        continue;
      } catch {
        // Keep the manifest as evidence even when it is not valid JSON.
      }
    }
    if (/^(pom\.xml|build\.gradle|go\.mod|cargo\.toml|pyproject\.toml|requirements.*\.txt)$/i.test(base)) {
      evidence.push({ path: source.path, dependencies: [] });
    }
  }
  return evidence;
}

function section(name, body) {
  return [`<!-- section:${name} -->`, body, `<!-- /section:${name} -->`].join('\n');
}

function listOrFallback(items, fallback) {
  return items.length > 0 ? items.map(item => `- ${item}`).join('\n') : `- ${fallback}`;
}

function buildProjectDoc(project, scanResult, sourcePath) {
  const sourceFiles = scanResult?.sourceFiles || [];
  const evidence = dependencyEvidence(scanResult);
  const metadata = JSON.stringify({
    id: project.alias,
    sourcePath,
    type: project.type
  });
  const evidenceLines = evidence.map(item => {
    const dependencies = item.dependencies.length > 0
      ? `; dependencies: ${item.dependencies.join(', ')}`
      : '';
    return `\`${item.path}\`${dependencies}`;
  });
  const keyFileLines = sourceFiles.map(source => {
    const truncated = source.truncation?.truncated ? ' (truncated)' : '';
    return `\`${source.path}\` [${source.language}] sha256:${source.hash}${truncated}`;
  });

  return [
    `# ${project.name}`,
    `<!-- code-ctx-project: ${metadata} -->`,
    '',
    section('overview', [
      `- Project ID: \`${project.alias}\``,
      `- Source path: \`${sourcePath}\``,
      `- Detected type: \`${project.type}\``,
      '- Generation mode: deterministic scan (AI disabled)'
    ].join('\n')),
    '',
    section('structure', ['```text', scanResult?.tree?.trimEnd() || '(empty)', '```'].join('\n')),
    '',
    section('modules', listOrFallback(keyFileLines, 'No key source files matched the scan patterns.')),
    '',
    section('api', '- Not inferred in deterministic mode; inspect the cited source files.'),
    '',
    section('data', '- Not inferred in deterministic mode; inspect the cited source files.'),
    '',
    section('dependencies', [
      `- Detected stack: \`${project.type}\``,
      listOrFallback(evidenceLines, 'No dependency manifest matched the scan patterns.')
    ].join('\n')),
    '',
    section('notes', '- This document contains scan evidence only and makes no AI-generated factual claims.'),
    ''
  ].join('\n');
}

function buildOverview(projectEntries) {
  const projectLines = projectEntries.map(entry =>
    `- \`${entry.id}\` (${entry.type}) - source \`${entry.sourcePath}\`, document \`${entry.document}\``
  );
  const stackLines = [...new Set(projectEntries.map(entry => entry.type))]
    .sort()
    .map(type => `- \`${type}\``);

  return [
    '# Project Overview',
    '<!-- code-ctx-overview: {"mode":"deterministic","manifest":"project-manifest.json"} -->',
    '',
    section('overview', '- Generated from deterministic repository scanning with AI disabled.'),
    '',
    section('subprojects', listOrFallback(projectLines, 'No projects detected.')),
    '',
    section('tech-stack', listOrFallback(stackLines, 'Unknown.')),
    '',
    section('architecture', '- Project boundaries follow the source paths recorded in `project-manifest.json`.'),
    '',
    section('dependencies', '- Cross-project dependencies are not inferred without explicit source evidence.'),
    '',
    section('quickstart', '- Open the project document listed above and follow its cited key files.'),
    ''
  ].join('\n');
}

function generateDeterministicDocs(rootDir, projects, scanResults, outputDir) {
  const generatedDocs = {};
  const manifestProjects = [];

  for (const project of projects) {
    const sourcePath = portableRelative(rootDir, project.path);
    const scanResult = scanResults[project.alias] || {};
    const document = `${project.alias}.md`;
    const techEvidence = dependencyEvidence(scanResult);
    const keyFiles = (scanResult.sourceFiles || []).map(source => ({
      path: source.path,
      language: source.language,
      hash: source.hash,
      truncated: !!source.truncation?.truncated
    }));
    const doc = buildProjectDoc(project, scanResult, sourcePath);
    fs.writeFileSync(path.join(outputDir, document), doc);
    generatedDocs[project.alias] = doc;
    manifestProjects.push({
      id: project.alias,
      label: project.name,
      type: project.type,
      sourcePath,
      document,
      techEvidence,
      tree: scanResult.tree || '',
      keyFiles
    });
  }

  const overview = buildOverview(manifestProjects);
  fs.writeFileSync(path.join(outputDir, 'OVERVIEW.md'), overview);
  generatedDocs.OVERVIEW = overview;

  const manifest = { version: 1, mode: 'deterministic', projects: manifestProjects };
  fs.writeFileSync(
    path.join(outputDir, 'project-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  return { generatedDocs, manifest };
}

module.exports = {
  buildProjectDoc,
  buildOverview,
  dependencyEvidence,
  generateDeterministicDocs
};
