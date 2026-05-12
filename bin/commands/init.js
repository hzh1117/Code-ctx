const { Command } = require('commander');
const { initCommand } = require('../../src/commands/init');

const init = new Command('init')
  .description('初始化项目，扫描结构生成 ai-docs/')
  .action(async () => {
    try {
      await initCommand(process.cwd());
    } catch (err) {
      console.error('初始化失败:', err.message);
      process.exit(1);
    }
  });

module.exports = init;
