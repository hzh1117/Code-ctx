const { Command } = require('commander');
const { initCommand } = require('../../src/commands/init');

const init = new Command('init')
  .description('初始化项目，扫描结构生成 ai-docs/')
  .option('--skip-ai', '跳过 AI 文档生成，只扫描项目结构')
  .option('--force', '强制重新生成，忽略已完成状态')
  .action(async (options) => {
    try {
      await initCommand(process.cwd(), {
        skipAi: options.skipAi,
        force: options.force
      });
    } catch (err) {
      console.error('初始化失败:', err.message);
      process.exit(1);
    }
  });

module.exports = init;
