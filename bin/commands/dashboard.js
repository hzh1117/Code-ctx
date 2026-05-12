const { Command } = require('commander');
const { startServer } = require('../../src/web/server');

const dashboard = new Command('dashboard')
  .description('打开本地 Web 管理页面')
  .option('-p, --port <port>', '端口号', '3456')
  .action(async (options) => {
    try {
      await startServer(process.cwd(), parseInt(options.port));
    } catch (err) {
      console.error('启动失败:', err.message);
      process.exit(1);
    }
  });

module.exports = dashboard;
