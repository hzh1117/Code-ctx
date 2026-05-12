const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const SCAN_PATTERNS = {
  'vue2-admin': [
    'src/api/*.js',
    'src/router/modules/*.js',
    'src/store/modules/*.js',
    '.env.*'
  ],
  'vue3-admin': [
    'src/api/*.js',
    'src/router/*.js',
    'src/stores/*.js',
    '.env.*'
  ],
  'uniapp-miniprogram': [
    'api/*.js',
    'pages.json',
    'config/app.js',
    'utils/request.js'
  ],
  'react': [
    'src/components/**/*.{jsx,tsx}',
    'src/pages/**/*.{jsx,tsx}',
    'src/hooks/*.js',
    'src/App.{jsx,tsx}',
    'src/index.{jsx,tsx}'
  ],
  'java-backend': [
    '**/controller/**/*.java',
    '**/service/**/*.java',
    '**/entity/**/*.java',
    'application.yml',
    'application.properties'
  ],
  'node-backend': [
    'routes/*.js',
    'controllers/*.js',
    'app.js'
  ],
  'go-backend': [
    '**/handler/*.go',
    '**/service/*.go',
    '**/model/*.go',
    '**/middleware/*.go',
    'main.go',
    'go.mod'
  ],
  'python-backend': [
    '**/views.py',
    '**/models.py',
    '**/serializers.py',
    '**/urls.py',
    'app.py',
    'requirements.txt'
  ]
};

function scanProject(projectDir, projectType) {
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    throw new Error(`Directory does not exist: ${projectDir}`);
  }

  const patterns = SCAN_PATTERNS[projectType] || [];
  const keyFiles = [];
  const tree = buildTree(projectDir);

  for (const pattern of patterns) {
    const matches = globSync(pattern, {
      cwd: projectDir,
      absolute: true,
      nodir: true
    });
    keyFiles.push(...matches);
  }

  const uniqueFiles = [...new Set(keyFiles)];
  return { tree, keyFiles: uniqueFiles };
}

function buildTree(dir, prefix = '', depth = 0, maxDepth = 5) {
  if (depth >= maxDepth) return prefix + '└── ...\n';

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let tree = '';

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tree += `${prefix}├── ${entry.name}/\n`;
      tree += buildTree(fullPath, prefix + '│   ', depth + 1, maxDepth);
    } else {
      tree += `${prefix}├── ${entry.name}\n`;
    }
  }

  return tree;
}

module.exports = { scanProject };
