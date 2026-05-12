const fs = require('fs');
const path = require('path');
const { readFileUTF8 } = require('../utils/file-reader');

const PROJECT_TYPES = {
  'uniapp-miniprogram': {
    check: (pkg, files) => {
      return pkg.dependencies?.['uni-app'] || files.includes('manifest.json');
    }
  },
  'vue2-admin': {
    check: (pkg) => {
      return pkg.dependencies?.vue && pkg.dependencies?.['element-ui'];
    }
  },
  'vue3-admin': {
    check: (pkg) => {
      return pkg.dependencies?.vue && pkg.dependencies?.['@element-plus'];
    }
  },
  'react': {
    check: (pkg) => {
      return pkg.dependencies?.react;
    }
  },
  'java-backend': {
    check: (pkg, files) => {
      return files.includes('pom.xml') || files.includes('build.gradle');
    }
  },
  'node-backend': {
    check: (pkg) => {
      return pkg.dependencies?.express || pkg.dependencies?.koa || pkg.dependencies?.['@nestjs/core'];
    }
  },
  'go-backend': {
    check: (pkg, files) => {
      return files.includes('go.mod');
    }
  },
  'python-backend': {
    check: (pkg, files) => {
      return files.includes('requirements.txt') || files.includes('pyproject.toml');
    }
  }
};

function detectProjects(rootDir) {
  const projects = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectDir = path.join(rootDir, entry.name);
    const files = fs.readdirSync(projectDir);

    if (!files.includes('package.json')) {
      for (const [type, config] of Object.entries(PROJECT_TYPES)) {
        if (config.check({}, files)) {
          projects.push({
            alias: entry.name.replace(/[^a-z0-9]/g, '-').substring(0, 10),
            path: projectDir,
            type,
            name: entry.name
          });
        }
      }
      continue;
    }

    const pkgPath = path.join(projectDir, 'package.json');
    const pkg = JSON.parse(readFileUTF8(pkgPath));

    for (const [type, config] of Object.entries(PROJECT_TYPES)) {
      if (config.check(pkg, files)) {
        projects.push({
          alias: entry.name.replace(/[^a-z0-9]/g, '-').substring(0, 10),
          path: projectDir,
          type,
          name: entry.name
        });
        break;
      }
    }
  }

  return projects;
}

module.exports = { detectProjects };