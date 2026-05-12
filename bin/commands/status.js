const { Command } = require('commander');
const { statusCommand } = require('../../src/commands/status');

const status = new Command('status')
  .description('查看 ai-docs 各文档的最后更新时间')
  .action(async () => {
    try {
      const result = await statusCommand(process.cwd());
      
      if (result.message) {
        console.log(result.message);
        return;
      }
      
      if (result.documents.length === 0) {
        console.log('ai-docs/ 目录为空');
        return;
      }
      
      console.log('文档状态:\n');
      console.log('名称'.padEnd(25) + '大小'.padEnd(10) + '最后修改');
      console.log('-'.repeat(60));
      
      result.documents.forEach(doc => {
        const size = `${(doc.size / 1024).toFixed(1)}KB`;
        const date = new Date(doc.lastModified).toLocaleString();
        console.log(doc.name.padEnd(25) + size.padEnd(10) + date);
      });
    } catch (err) {
      console.error('查看状态失败:', err.message);
      process.exit(1);
    }
  });

module.exports = status;
