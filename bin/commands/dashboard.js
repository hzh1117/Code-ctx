const { Command } = require('commander');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = new Command('dashboard')
  .description('启动 Web 管理界面')
  .option('-p, --port <port>', 'API 端口', '3456')
  .option('-d, --dir <path>', '项目目录（默认当前目录）')
  .action((options) => {
    const rootDir = options.dir ? path.resolve(options.dir) : process.cwd();

    if (!fs.existsSync(rootDir)) {
      console.error(`❌ 目录不存在: ${rootDir}`);
      process.exit(1);
    }

    const configPath = path.join(rootDir, 'code-ctx.config.js');
    if (!fs.existsSync(configPath)) {
      console.warn(`⚠️  未找到 ${configPath}，请确认已在该目录运行 code-ctx init`);
    }

    const apiScript = `node -e "const { startServer } = require('${path.join(__dirname, '../../src/web/server').replace(/\\/g, '\\\\')}'); startServer('${rootDir.replace(/\\/g, '\\\\')}', ${options.port});"`;
    const webDir = path.join(__dirname, '../../web');

    console.log('启动 Dashboard...');
    console.log(`[CodeCtx] 项目目录: ${rootDir}`);
    console.log(`[CodeCtx] ai-docs 路径: ${path.join(rootDir, 'ai-docs')}`);
    console.log(`[CodeCtx] 配置文件: ${configPath}`);
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
