const { Command } = require('commander');
const { hookCommand } = require('../../src/commands/hook');

const hook = new Command('hook')
  .description('管理 git post-commit hook')
  .addCommand(
    new Command('install')
      .description('安装 post-commit hook（commit 后提示更新文档）')
      .action(async () => {
        try {
          await hookCommand(process.cwd(), 'install');
        } catch (err) {
          console.error('安装失败:', err.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('uninstall')
      .description('卸载 post-commit hook')
      .action(async () => {
        try {
          await hookCommand(process.cwd(), 'uninstall');
        } catch (err) {
          console.error('卸载失败:', err.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('status')
      .description('查看 hook 安装状态')
      .action(async () => {
        try {
          await hookCommand(process.cwd(), 'status');
        } catch (err) {
          console.error('查询失败:', err.message);
          process.exit(1);
        }
      })
  );

module.exports = hook;
