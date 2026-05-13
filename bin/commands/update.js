const { Command } = require('commander');
const { updateCommand } = require('../../src/commands/update');
const clipboardy = require('clipboardy');
const fs = require('fs');

const update = new Command('update')
  .description('检测变化，更新相关文档')
  .option('--dry-run', '只检测变化，不更新')
  .option('--stdout', '输出 prompt 到 stdout')
  .action(async (options) => {
    try {
      const result = await updateCommand(process.cwd(), { dryRun: options.dryRun });

      if (result.changedFiles.length === 0) {
        console.log('✓ 没有检测到文件变化');
        return;
      }

      console.log(`检测到 ${result.changedFiles.length} 个文件变化：`);
      result.changedFiles.slice(0, 10).forEach(f => console.log(`  ${f}`));
      if (result.changedFiles.length > 10) {
        console.log(`  ... 还有 ${result.changedFiles.length - 10} 个文件`);
      }

      if (result.prompt) {
        if (options.stdout) {
          process.stdout.write(result.prompt);
        } else {
          try {
            await clipboardy.write(result.prompt);
            console.log('\n✓ 增量更新 prompt 已复制到剪贴板');
          } catch {
            fs.writeFileSync('.ai-prompt.md', result.prompt);
            console.log('\n⚠️ 剪贴板写入失败，已输出到 .ai-prompt.md');
          }
        }
      }
    } catch (err) {
      console.error('更新失败:', err.message);
      process.exit(1);
    }
  });

module.exports = update;
