const fs = require('fs');
const path = require('path');

const REQUIRED_SECTIONS = {
  'OVERVIEW.md': ['## 项目概述', '## 子项目列表', '## 技术栈'],
  'api-contracts.md': ['## 接口列表']
};

const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*["']?[^"'\s]+/i,
  /secret\s*[:=]\s*["']?[^"'\s]+/i,
  /token\s*[:=]\s*["']?[^"'\s]+/i,
  /api[_-]?key\s*[:=]\s*["']?[^"'\s]+/i
];

async function doctorCommand(rootDir) {
  const aiDocsDir = path.join(rootDir, 'ai-docs');
  const issues = [];
  const warnings = [];

  if (!fs.existsSync(aiDocsDir)) {
    issues.push('ai-docs/ 目录不存在');
    return { issues, warnings };
  }

  for (const [file, sections] of Object.entries(REQUIRED_SECTIONS)) {
    const filePath = path.join(aiDocsDir, file);
    if (!fs.existsSync(filePath)) {
      issues.push(`${file} 不存在`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    for (const section of sections) {
      if (!content.includes(section)) {
        issues.push(`${file} 缺少章节: ${section}`);
      }
    }
  }

  const files = fs.readdirSync(aiDocsDir);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const content = fs.readFileSync(path.join(aiDocsDir, file), 'utf8');
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(`${file} 可能包含敏感信息`);
        break;
      }
    }
  }

  return { issues, warnings };
}

module.exports = { doctorCommand };
