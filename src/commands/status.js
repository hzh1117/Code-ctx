const fs = require('fs');
const path = require('path');

async function statusCommand(rootDir) {
  const aiDocsDir = path.join(rootDir, 'ai-docs');

  if (!fs.existsSync(aiDocsDir)) {
    return { documents: [], message: 'ai-docs/ 目录不存在' };
  }

  const files = fs.readdirSync(aiDocsDir).filter(f => f.endsWith('.md'));
  const documents = files.map(file => {
    const filePath = path.join(aiDocsDir, file);
    const stats = fs.statSync(filePath);
    return {
      name: file,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    };
  });

  return { documents };
}

module.exports = { statusCommand };
