const { Command } = require('commander');
const { fixCommand } = require('../../src/commands/fix');

const fix = new Command('fix')
  .description('重新生成指定子项目的文档')
  .argument('<alias>', '子项目别名')
  .option('--dry-run', '只生成 prompt，不调用 AI')
  .action(async (alias, options) => {
    try {
      await fixCommand(process.cwd(), alias, { dryRun: options.dryRun });
    } catch (err) {
      console.error('修复失败:', err.message);
      process.exit(1);
    }
  });

module.exports = fix;
