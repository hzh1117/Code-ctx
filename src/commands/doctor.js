const fs = require('fs');
const path = require('path');
const { DETECTION_PATTERNS } = require('../utils/sensitive-filter');

const REQUIRED_SECTIONS = {
  'OVERVIEW.md': ['## 项目概述', '## 子项目列表', '## 技术栈'],
  'api-contracts.md': ['## 接口列表']
};

function checkSectionIntegrity(aiDocsDir) {
  const issues = [];
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
  return issues;
}

function checkSensitiveInfo(aiDocsDir) {
  const warnings = [];
  if (!fs.existsSync(aiDocsDir)) return warnings;

  const files = fs.readdirSync(aiDocsDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(aiDocsDir, file), 'utf8');
    for (const { regex, name } of DETECTION_PATTERNS) {
      if (regex.test(content)) {
        warnings.push(`${file} 可能包含敏感信息 (${name})`);
      }
    }
  }
  return warnings;
}

function checkOverviewConsistency(rootDir, aiDocsDir) {
  const warnings = [];
  const overviewPath = path.join(aiDocsDir, 'OVERVIEW.md');
  const configPath = path.join(rootDir, 'code-ctx.config.js');

  if (!fs.existsSync(overviewPath) || !fs.existsSync(configPath)) return warnings;

  const overviewContent = fs.readFileSync(overviewPath, 'utf8');
  let config;
  try {
    config = require(configPath);
  } catch {
    return warnings;
  }

  const configAliases = (config.projects || []).map(p => p.alias);
  for (const alias of configAliases) {
    if (!overviewContent.includes(alias)) {
      warnings.push(`OVERVIEW.md 中未提及子项目: ${alias}`);
    }
  }

  return warnings;
}

function checkApiContracts(aiDocsDir) {
  const info = {};
  const contractsPath = path.join(aiDocsDir, 'api-contracts.md');

  if (!fs.existsSync(contractsPath)) return info;

  const content = fs.readFileSync(contractsPath, 'utf8');
  const endpointPattern = /^##\s+(GET|POST|PUT|DELETE|PATCH)\s+/gm;
  const matches = content.match(endpointPattern);
  info.endpointCount = matches ? matches.length : 0;

  return info;
}

async function doctorCommand(rootDir, options = {}) {
  const aiDocsDir = path.join(rootDir, 'ai-docs');
  const issues = [];
  const warnings = [];
  const info = {};

  if (!fs.existsSync(aiDocsDir)) {
    issues.push('ai-docs/ 目录不存在');
    return { issues, warnings, info };
  }

  issues.push(...checkSectionIntegrity(aiDocsDir));
  warnings.push(...checkSensitiveInfo(aiDocsDir));
  warnings.push(...checkOverviewConsistency(rootDir, aiDocsDir));
  Object.assign(info, checkApiContracts(aiDocsDir));

  if (options.strict) {
    console.log('严格模式检查暂未实现');
  }

  if (issues.length === 0 && warnings.length === 0) {
    console.log('✓ 文档健康检查通过');
  } else {
    if (issues.length > 0) {
      console.log(`\n❌ 发现 ${issues.length} 个问题：`);
      issues.forEach(i => console.log(`  - ${i}`));
    }
    if (warnings.length > 0) {
      console.log(`\n⚠️ 发现 ${warnings.length} 个警告：`);
      warnings.forEach(w => console.log(`  - ${w}`));
    }
  }

  if (info.endpointCount !== undefined) {
    console.log(`\n📊 接口数量: ${info.endpointCount}`);
  }

  return { issues, warnings, info };
}

module.exports = { doctorCommand };
