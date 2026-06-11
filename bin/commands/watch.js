const { Command } = require('commander');
const { watchCommand } = require('../../src/commands/watch');

const watch = new Command('watch')
  .description('监听文件变化，自动触发增量更新')
  .option('-d, --debounce <ms>', '防抖间隔（毫秒）', '5000')
  .option('--apply', '自动调用 AI 更新文档（需配置 API Key）')
  .action(async (options) => {
    try {
      const debounce = parseInt(options.debounce, 10);
      if (isNaN(debounce) || debounce < 0) {
        console.error(`❌ --debounce 必须是非负整数，当前值: ${options.debounce}`);
        process.exit(1);
      }
      await watchCommand(process.cwd(), {
        debounce,
        autoApply: options.apply
      });
    } catch (err) {
      console.error('监听失败:', err.message);
      process.exit(1);
    }
  });

module.exports = watch;
