const fs = require('fs');
const path = require('path');
const { readFileUTF8 } = require('../utils/file-reader');
const { defaultRegistry } = require('../adapters');

function generateAlias(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 10);
}

function detectProjects(rootDir) {
  const projects = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectDir = path.join(rootDir, entry.name);
    const files = fs.readdirSync(projectDir);

    let pkg = {};
    if (files.includes('package.json')) {
      const pkgPath = path.join(projectDir, 'package.json');
      try {
        pkg = JSON.parse(readFileUTF8(pkgPath));
      } catch {
        // ignore parse errors
      }
    }

    const type = defaultRegistry.detect(pkg, files);
    if (type) {
      projects.push({
        alias: generateAlias(entry.name),
        path: projectDir,
        type,
        name: entry.name
      });
    }
  }

  return projects;
}

module.exports = { detectProjects };
