const fs = require('fs');
const path = require('path');
const { listSections } = require('../core/section');
const { readFileUTF8, isWithinDir } = require('./file-reader');
const { DETECTION_PATTERNS } = require('./sensitive-filter');
const { loadProjectConfig } = require('./config');
const { STATE_FILES } = require('./constants');
const { getLatestMtime } = require('./mtime-utils');
const {
  loadProjectManifest, verifyOverviewFacts, verifyProjectFacts
} = require('./fact-verifier');

// Per-doc expectations. Overview and per-project use different templates.
const EXPECTED_PROJECT_SECTIONS = ['overview', 'structure', 'modules', 'api', 'data', 'dependencies', 'notes'];
const EXPECTED_OVERVIEW_SECTIONS = ['overview', 'subprojects', 'tech-stack', 'architecture', 'dependencies', 'quickstart'];

const MIN_CONTENT_LINES = 5;
const SPARSE_CONTENT_LINES = 12;

function getLevel(score) {
  if (score >= 80) return 'OK';
  if (score >= 50) return 'WARN';
  return 'HIGH_RISK';
}

function countContentLines(content) {
  return content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('<!--')).length;
}

function detectSensitive(content) {
  const hits = [];
  for (const { regex, name } of DETECTION_PATTERNS) {
    // Reset lastIndex to prevent alternating true/false for g-flag patterns
    regex.lastIndex = 0;
    if (regex.test(content)) hits.push(name);
  }
  return hits;
}

function scoreCompleteness(presentSections, expectedSections) {
  if (expectedSections.length === 0) return { score: 100, missing: [], present: presentSections };
  const present = expectedSections.filter(s => presentSections.includes(s));
  const missing = expectedSections.filter(s => !presentSections.includes(s));
  const score = Math.round((present.length / expectedSections.length) * 100);
  return { score, present, missing };
}

function scoreOneDoc({
  filePath, docName, expectedSections, projectDir, freshnessDeadline, factualConfidence
}) {
  if (!fs.existsSync(filePath)) {
    return {
      name: docName,
      exists: false,
      level: 'HIGH_RISK',
      score: 0,
      completeness: { score: 0, present: [], missing: expectedSections },
      freshness: { score: 0, stale: false, reason: 'doc-missing' },
      formatHealth: { score: 0 },
      factualConfidence: factualConfidence || { status: 'invalid', score: 0, metrics: {}, issues: [] },
      risks: [{ type: 'doc-missing', message: `${docName} 不存在` }]
    };
  }

  const stat = fs.statSync(filePath);
  const content = readFileUTF8(filePath);
  const present = listSections(content);
  const completeness = scoreCompleteness(present, expectedSections);

  const risks = [];
  const contentLines = countContentLines(content);
  if (contentLines < MIN_CONTENT_LINES) {
    risks.push({ type: 'too-short', message: `${docName} 内容过少（${contentLines} 行）` });
  } else if (contentLines < SPARSE_CONTENT_LINES) {
    risks.push({ type: 'sparse', message: `${docName} 内容偏少（${contentLines} 行）`, severity: 'warn' });
  }

  const sensitiveFields = detectSensitive(content);
  if (sensitiveFields.length > 0) {
    risks.push({ type: 'sensitive', message: `${docName} 可能包含敏感字段: ${sensitiveFields.join(', ')}`, fields: sensitiveFields });
  }

  let stale = false;
  let staleReason = null;
  if (projectDir && fs.existsSync(projectDir)) {
    const latestProjectMtime = getLatestMtime(projectDir, freshnessDeadline);
    if (latestProjectMtime > stat.mtimeMs) {
      stale = true;
      staleReason = 'project-newer-than-doc';
    }
  }

  const freshnessScore = stale ? 50 : 100;

  // High-risk findings hard-cap the score below the OK threshold so the level
  // calculation reflects them even if completeness/freshness are perfect.
  const hardRisk = risks.some(r => r.type === 'sensitive' || r.type === 'too-short');
  const formatScore = hardRisk
    ? Math.min(49, Math.round((completeness.score * 0.6 + freshnessScore * 0.4)))
    : Math.round(completeness.score * 0.6 + freshnessScore * 0.4);
  const facts = factualConfidence || {
    status: 'unverified',
    score: 0,
    metrics: {},
    issues: [{ type: 'facts-unverified', message: '文档事实未验证' }]
  };
  for (const issue of facts.issues || []) risks.push(issue);
  let score = Math.round(formatScore * 0.45 + facts.score * 0.55);
  if (facts.status === 'unverified') score = Math.min(score, 79);
  if (facts.status === 'invalid') score = Math.min(score, 49);

  return {
    name: docName,
    exists: true,
    level: getLevel(score),
    score,
    formatHealth: {
      score: formatScore,
      completeness: completeness.score,
      freshness: freshnessScore,
      risk: hardRisk ? 0 : 100
    },
    factualConfidence: facts,
    completeness,
    freshness: { score: freshnessScore, stale, reason: staleReason },
    risks,
    mtime: stat.mtime.toISOString()
  };
}

function scoreDocs(rootDir, options = {}) {
  const aiDocsDir = path.resolve(rootDir, 'ai-docs');
  const result = {
    overall: 'HIGH_RISK',
    score: 0,
    perDoc: [],
    summary: { completeness: 0, freshness: 0, risk: 100, formatHealth: 0, factualConfidence: 0 },
    lastScanTime: null,
    aiDocsExists: fs.existsSync(aiDocsDir)
  };

  if (!result.aiDocsExists) {
    result.perDoc.push({
      name: 'ai-docs/',
      exists: false,
      level: 'HIGH_RISK',
      score: 0,
      risks: [{ type: 'no-ai-docs', message: 'ai-docs/ 目录不存在' }]
    });
    return result;
  }

  const lastScanPath = path.join(aiDocsDir, STATE_FILES.LAST_SCAN);
  if (fs.existsSync(lastScanPath)) {
    try {
      const ls = JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
      result.lastScanTime = ls.timestamp || null;
    } catch {
      // ignore malformed last-scan
    }
  }

  let config = {};
  try {
    config = loadProjectConfig(rootDir);
  } catch {
    // config errors: handled by doctor proper
  }
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const { manifest } = loadProjectManifest(aiDocsDir);

  // Bound the freshness walk so a large monorepo doesn't make doctor crawl
  // for too long; configurable, defaults to 1.5s budget across all projects.
  const freshnessDeadline = Date.now() + (options.freshnessBudgetMs || 1500);

  // Per-project docs
  for (const project of projects) {
    const filePath = path.join(aiDocsDir, `${project.alias}.md`);
    const projectDir = project.path && isWithinDir(path.resolve(rootDir, project.path), rootDir)
      ? path.resolve(rootDir, project.path)
      : null;
    const content = fs.existsSync(filePath) ? readFileUTF8(filePath) : '';
    result.perDoc.push(scoreOneDoc({
      filePath,
      docName: `${project.alias}.md`,
      expectedSections: EXPECTED_PROJECT_SECTIONS,
      projectDir,
      freshnessDeadline,
      factualConfidence: verifyProjectFacts(rootDir, content, project, manifest)
    }));
  }

  // OVERVIEW.md
  const overviewPath = path.join(aiDocsDir, 'OVERVIEW.md');
  const overviewContent = fs.existsSync(overviewPath) ? readFileUTF8(overviewPath) : '';
  result.perDoc.push(scoreOneDoc({
    filePath: overviewPath,
    docName: 'OVERVIEW.md',
    expectedSections: EXPECTED_OVERVIEW_SECTIONS,
    projectDir: null,
    freshnessDeadline,
    factualConfidence: verifyOverviewFacts(overviewContent, manifest)
  }));

  if (result.perDoc.length === 0) {
    return result;
  }

  // Aggregate scores
  const completenessAvg = average(result.perDoc.map(d => d.completeness?.score ?? 0));
  const freshnessAvg = average(result.perDoc.map(d => d.freshness?.score ?? 0));
  const formatHealthAvg = average(result.perDoc.map(d => d.formatHealth?.score ?? 0));
  const factualConfidenceAvg = average(result.perDoc.map(d => d.factualConfidence?.score ?? 0));

  const anySensitive = result.perDoc.some(d => (d.risks || []).some(r => r.type === 'sensitive'));
  const anyMissing = result.perDoc.some(d => !d.exists);
  const anyTooShort = result.perDoc.some(d => (d.risks || []).some(r => r.type === 'too-short'));

  // Risk axis: 100 baseline, deductions for hard findings.
  let riskScore = 100;
  if (anySensitive) riskScore -= 60;
  if (anyMissing) riskScore -= 30;
  if (anyTooShort) riskScore -= 15;
  riskScore = Math.max(0, riskScore);

  result.summary = {
    completeness: Math.round(completenessAvg),
    freshness: Math.round(freshnessAvg),
    risk: riskScore,
    formatHealth: Math.round(formatHealthAvg),
    factualConfidence: Math.round(factualConfidenceAvg)
  };
  result.score = Math.round(formatHealthAvg * 0.35 + factualConfidenceAvg * 0.45 + riskScore * 0.2);

  const anyInvalidFacts = result.perDoc.some(d => d.factualConfidence?.status === 'invalid');
  const anyUnverifiedFacts = result.perDoc.some(d => d.factualConfidence?.status === 'unverified');

  if (anySensitive || anyMissing || anyInvalidFacts) {
    result.overall = 'HIGH_RISK';
  } else if (anyUnverifiedFacts || result.score < 80 || result.perDoc.some(d => d.level === 'WARN' || d.freshness?.stale)) {
    result.overall = 'WARN';
  } else {
    result.overall = 'OK';
  }

  return result;
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function formatLevelLabel(level) {
  return level === 'OK' ? '✅ OK' : level === 'WARN' ? '⚠️ WARN' : '❌ HIGH_RISK';
}

module.exports = {
  scoreDocs,
  scoreOneDoc,
  formatLevelLabel,
  EXPECTED_PROJECT_SECTIONS,
  EXPECTED_OVERVIEW_SECTIONS
};
