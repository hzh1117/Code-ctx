const fs = require('fs');
const path = require('path');
const { listSections } = require('../../core/section');
const { getLatestMtime } = require('../../utils/mtime-utils');

const MAX_TEMPLATE_LENGTH = 10000;
const VALID_SCENARIO_ID_PATTERN = /^[A-Z]$/;

// Section list is the only piece of doc-content the /api/status endpoint
// needs. Cache by (path, mtimeMs) so unchanged docs only cost a stat call
// on subsequent status requests.
const sectionsCache = new Map();

function getCachedSections(filePath, mtimeMs) {
  const cached = sectionsCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.sections;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const sections = listSections(content);
  sectionsCache.set(filePath, { mtimeMs, sections });
  return sections;
}

function clearSectionsCache() {
  sectionsCache.clear();
}

// Combine per-axis findings into a single severity label that mirrors
// what the Dashboard Security page shows at the top.
function deriveOverall(report, schemaErrors, sensitive) {
  if ((report.issues || []).length > 0 || (sensitive || []).length > 0) {
    return 'HIGH_RISK';
  }
  if ((report.warnings || []).length > 0 || (schemaErrors || []).length > 0 || (report.quality && report.quality.overall === 'WARN')) {
    return 'WARN';
  }
  return 'OK';
}

// Build the documents[] array used by /status: lists existing docs (with
// sections + stale flag) and appends placeholder entries for expected docs
// that haven't been generated yet.
function buildDocumentsList(aiDocsDir, projectsArray, expectedDocs, rootDir, isWithinDir) {
  const files = fs.readdirSync(aiDocsDir);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  const documents = mdFiles.map(file => {
    const filePath = path.join(aiDocsDir, file);
    const stats = fs.statSync(filePath);
    return {
      name: file,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      mtime: stats.mtime.toISOString(),
      sections: getCachedSections(filePath, stats.mtimeMs),
      exists: true,
      stale: false
    };
  });

  for (const doc of documents) {
    const docMtime = new Date(doc.lastModified).getTime();
    const alias = doc.name.replace('.md', '');
    const project = projectsArray.find(p => p.alias === alias);
    if (project && project.path) {
      const projectDir = path.resolve(rootDir, project.path);
      if (isWithinDir(projectDir, rootDir) && fs.existsSync(projectDir)) {
        const latestMtime = getLatestMtime(projectDir, Date.now() + 2000);
        if (latestMtime > docMtime) {
          doc.stale = true;
        }
      }
    }
  }

  for (const expected of expectedDocs) {
    if (!mdFiles.includes(expected)) {
      documents.push({
        name: expected,
        size: 0,
        lastModified: null,
        mtime: null,
        sections: [],
        exists: false,
        stale: false
      });
    }
  }

  return documents;
}

module.exports = {
  MAX_TEMPLATE_LENGTH,
  VALID_SCENARIO_ID_PATTERN,
  getCachedSections,
  clearSectionsCache,
  deriveOverall,
  getLatestMtime,
  buildDocumentsList
};
