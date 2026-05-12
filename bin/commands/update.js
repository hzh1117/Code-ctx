const { Command } = require('commander');
const { updateCommand } = require('../../src/commands/update');

const update = new Command('update')
  .description('检测变化，更新相关文档')
  .option('-d, --dry-run', '只检测不更新')
  .action(async (options) => {
    try {
      const result = await updateCommand(process.cwd(), { dryRun: options.dryRun });
      if (result.changedFiles.length === 0) {
        console.log('✓ 没有检测到文件变化');
      } else {
        console.log(`✓ 检测到 ${result.changedFiles.length} 个文件变化:`);
        result.changedFiles.forEach(f => console.log(`  - ${f}`));
      }
    } catch (err) {
      console.error('更新失败:', err.message);
      process.exit(1);
    }
  });

module.exports = update;
