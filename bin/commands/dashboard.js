const { Command } = require('commander');
const { exec } = require('child_process');
const path = require('path');

module.exports = new Command('dashboard')
  .description('启动 Web 管理界面')
  .option('-p, --port <port>', 'API 端口', '3456')
  .action((options) => {
    const rootDir = process.cwd();
    const apiScript = `node -e "const { startServer } = require('${path.join(__dirname, '../../src/web/server').replace(/\\/g, '\\\\')}'); startServer('${rootDir.replace(/\\/g, '\\\\')}', ${options.port});"`;
    const webDir = path.join(__dirname, '../../web');

    console.log('启动 Dashboard...');
    console.log(`API 服务器端口: ${options.port}`);
    console.log(`前端地址: http://localhost:5173`);

    const concurrently = require('concurrently');
    const { result } = concurrently([
      { command: apiScript, name: 'api', prefixColor: 'blue' },
      { command: 'npm run dev', name: 'web', prefixColor: 'green', cwd: webDir }
    ]);

    result.catch((err) => {
      console.error('启动失败:', err);
      process.exit(1);
    });
  });
