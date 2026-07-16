const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { extractSection } = require('../core/section');
const { isWithinDir } = require('./file-reader');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function loadProjectManifest(aiDocsDir) {
  const manifestPath = path.join(aiDocsDir, 'project-manifest.json');
  if (!fs.existsSync(manifestPath)) return { manifest: null, error: 'manifest-missing' };
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest || !Array.isArray(manifest.projects)) {
      return { manifest: null, error: 'manifest-invalid' };
    }
    return { manifest, error: null };
  } catch {
    return { manifest: null, error: 'manifest-invalid' };
  }
}

function extractRouteClaims(content) {
  const claims = [];
  for (const match of content.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(`?)(\/[\w\-/:.*{}]+)\2/gi)) {
    claims.push(`${match[1].toUpperCase()} ${match[3]}`);
  }
  return [...new Set(claims)];
}

function extractSourceRoutes(contents) {
  const routes = [];
  for (const content of contents) {
    for (const match of content.matchAll(
      /(?:router|app|server)\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/gi
    )) {
      routes.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
  }
  return new Set(routes);
}

function readDependencies(projectDir) {
  const packagePath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(packagePath)) return [];
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return [...new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})])].sort();
  } catch {
    return [];
  }
}

function scoreRatio(passed, total) {
  return total === 0 ? 100 : Math.round((passed / total) * 100);
}

function unverifiedFacts(reason) {
  return {
    status: 'unverified',
    score: 0,
    metrics: {
      manifestMapping: 0,
      referenceResolution: 0,
      sourceCitationCoverage: 0,
      symbolResolution: 0,
      routeConsistency: 0,
      dependencyConsistency: 0
    },
    issues: [{ type: reason, message: '缺少有效项目 manifest，文档事实未验证' }]
  };
}

function verifyOverviewFacts(content, manifest) {
  if (!manifest) return unverifiedFacts('manifest-missing');
  const projects = manifest.projects || [];
  const verified = projects.filter(
    project =>
      content.includes(project.id) && content.includes(project.sourcePath) && content.includes(project.document)
  ).length;
  const mappingScore = scoreRatio(verified, projects.length);
  return {
    status: mappingScore === 100 ? 'verified' : 'low-confidence',
    score: mappingScore,
    metrics: {
      manifestMapping: mappingScore,
      referenceResolution: 100,
      sourceCitationCoverage: mappingScore,
      symbolResolution: 100,
      routeConsistency: 100,
      dependencyConsistency: 100
    },
    issues:
      mappingScore === 100
        ? []
        : [
            {
              type: 'overview-manifest-mismatch',
              message: `OVERVIEW.md 仅引用 ${verified}/${projects.length} 个 manifest 项目`
            }
          ]
  };
}

function verifyProjectFacts(rootDir, content, project, manifest) {
  if (!manifest) return unverifiedFacts('manifest-missing');
  const entry = manifest.projects.find(candidate => candidate.id === project.alias);
  if (!entry) return unverifiedFacts('project-manifest-entry-missing');

  const expectedSourcePath =
    path.relative(rootDir, path.resolve(rootDir, project.path)).split(path.sep).join('/') || '.';
  const normalizedManifestPath = String(entry.sourcePath || '').replace(/^\.\//, '') || '.';
  const manifestMapping = normalizedManifestPath === expectedSourcePath ? 100 : 0;
  const projectDir = path.resolve(rootDir, project.path);
  const keyFiles = Array.isArray(entry.keyFiles) ? entry.keyFiles : [];
  const fileChecks = [];
  const sourceContents = [];

  for (const keyFile of keyFiles) {
    const sourcePath = path.resolve(projectDir, keyFile.path || '');
    let exists = false;
    let hashMatches = false;
    if (isWithinDir(sourcePath, projectDir) && fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile()) {
      exists = true;
      const source = fs.readFileSync(sourcePath, 'utf8');
      sourceContents.push(source);
      hashMatches = !keyFile.hash || sha256(source) === keyFile.hash;
    }
    fileChecks.push({ path: keyFile.path, exists, hashMatches });
  }

  const resolvedFiles = fileChecks.filter(check => check.exists && check.hashMatches).length;
  const citedFiles = fileChecks.filter(check => content.includes(check.path)).length;
  const referenceResolution = scoreRatio(resolvedFiles, fileChecks.length);
  const sourceCitationCoverage = scoreRatio(citedFiles, fileChecks.length);

  const symbolRefs = [...content.matchAll(/`([^`\s]+\.[a-z0-9]+)#([A-Za-z_$][\w$]*)`/gi)];
  let resolvedSymbols = 0;
  for (const [, fileRef, symbol] of symbolRefs) {
    const sourcePath = path.resolve(projectDir, fileRef);
    if (!isWithinDir(sourcePath, projectDir) || !fs.existsSync(sourcePath)) continue;
    const source = fs.readFileSync(sourcePath, 'utf8');
    if (new RegExp(`\\b${symbol.replace(/[$]/g, '\\$&')}\\b`).test(source)) resolvedSymbols++;
  }
  const symbolResolution = scoreRatio(resolvedSymbols, symbolRefs.length);

  const routeClaims = extractRouteClaims(content);
  const sourceRoutes = extractSourceRoutes(sourceContents);
  const matchedRoutes = routeClaims.filter(claim => sourceRoutes.has(claim)).length;
  const routeConsistency = scoreRatio(matchedRoutes, routeClaims.length);

  const dependencies = readDependencies(projectDir);
  const dependencySection = extractSection(content, 'dependencies') || content;
  const mentionedDependencies = dependencies.filter(dependency => dependencySection.includes(dependency)).length;
  const dependencyConsistency = scoreRatio(mentionedDependencies, dependencies.length);

  const metrics = {
    manifestMapping,
    referenceResolution,
    sourceCitationCoverage,
    symbolResolution,
    routeConsistency,
    dependencyConsistency
  };
  const score = Math.round(
    manifestMapping * 0.15 +
      referenceResolution * 0.3 +
      sourceCitationCoverage * 0.25 +
      symbolResolution * 0.1 +
      routeConsistency * 0.1 +
      dependencyConsistency * 0.1
  );
  const issues = [];
  if (manifestMapping < 100)
    issues.push({ type: 'project-mapping-mismatch', message: '文档项目路径与 manifest 不一致' });
  if (referenceResolution < 100)
    issues.push({ type: 'source-reference-invalid', message: '部分源码引用不存在或 hash 已变化' });
  if (sourceCitationCoverage < 80)
    issues.push({ type: 'source-citation-low', message: `来源引用覆盖率仅 ${sourceCitationCoverage}` });
  if (symbolResolution < 100)
    issues.push({ type: 'symbol-reference-invalid', message: '部分符号引用无法在源码中解析' });
  if (routeConsistency < 100) issues.push({ type: 'route-mismatch', message: '文档路由与源码不一致' });
  if (dependencyConsistency < 80)
    issues.push({ type: 'dependency-coverage-low', message: `依赖证据覆盖率仅 ${dependencyConsistency}` });

  return {
    status:
      manifestMapping < 100 || referenceResolution < 100
        ? 'invalid'
        : score >= 80
          ? 'verified'
          : score >= 40
            ? 'low-confidence'
            : 'invalid',
    score,
    metrics,
    issues
  };
}

module.exports = {
  loadProjectManifest,
  verifyOverviewFacts,
  verifyProjectFacts
};
