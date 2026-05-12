const { Command } = require('commander');
const { fixCommand } = require('../../src/commands/fix');

const fix = new Command('fix')
  .description('重新生成指定子项目的文档')
  .argument('<alias>', '子项目别名')
  .option('-d, --dry-run', '只生成提示词不写入文件')
  .action(async (alias, options) => {
    try {
      const result = await fixCommand(process.cwd(), alias, { dryRun: options.dryRun });
      if (options.dryRun) {
        console.log('✓ 生成的提示词:\n');
        console.log(result.prompt);
      } else {
        console.log(`✓ 已重新生成 ${alias} 的文档`);
      }
    } catch (err) {
      console.error('修复失败:', err.message);
      process.exit(1);
    }
  });

module.exports = fix;
