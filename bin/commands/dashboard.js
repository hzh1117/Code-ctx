const { Command } = require('commander');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function validatePort(port) {
  const num = Number(port);
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    console.error(`❌ 端口必须是 1-65535 的整数，当前值: ${port}`);
    process.exit(1);
  }
  return num;
}

function validateDir(dir) {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    console.error(`❌ 目录不存在: ${resolved}`);
    process.exit(1);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    console.error(`❌ 路径不是目录: ${resolved}`);
    process.exit(1);
  }
  return resolved;
}

module.exports = new Command('dashboard')
  .description('启动 Web 管理界面')
  .option('-p, --port <port>', 'API 端口', '3456')
  .option('-d, --dir <path>', '项目目录（默认当前目录）')
  .option('--dev', '开发模式：同时启动 API 和 Vite')
  .action((options) => {
    const port = validatePort(options.port);
    const rootDir = options.dir ? validateDir(options.dir) : process.cwd();

    const configPath = path.join(rootDir, 'code-ctx.config.js');
    if (!fs.existsSync(configPath)) {
      console.warn(`⚠️  未找到 ${configPath}，请确认已在该目录运行 code-ctx init`);
    }

    const webDir = path.join(__dirname, '../../web');
    const accessUrl = `http://localhost:${port}`;

    console.log('启动 Dashboard...');
    console.log(`[CodeCtx] 项目目录: ${rootDir}`);
    console.log(`[CodeCtx] ai-docs 路径: ${path.join(rootDir, 'ai-docs')}`);
    console.log(`[CodeCtx] 配置文件: ${configPath}`);
    console.log(`[CodeCtx] 访问地址: ${accessUrl}`);

    if (!options.dev) {
      console.log('[CodeCtx] 构建前端资源...');
      // shell: false — 参数已数组化，无需 shell 解释器，减少攻击面
      // Windows 下 npm 实际是 npm.cmd，需平台感知
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const buildResult = spawnSync(npmCmd, ['run', 'build'], { cwd: webDir, stdio: 'inherit', shell: false });
      if (buildResult.error || buildResult.status !== 0) {
        console.error('前端构建失败');
        process.exit(1);
      }

      require('../../src/web/server').startServer(rootDir, port).catch((err) => {
        console.error('启动失败:', err);
        process.exit(1);
      });
      return;
    }

    console.log(`API 服务器端口: ${port}`);
    console.log('Vite 开发地址: http://localhost:5173');
    console.log(`访问地址: ${accessUrl}`);

    const serverModulePath = path.join(__dirname, '../../src/web/server');
    const concurrently = require('concurrently');
    const { result } = concurrently([
      {
        command: 'node -e "const { startServer } = require(process.env.SERVER_MODULE); startServer(process.env.ROOT_DIR, Number(process.env.PORT));"',
        name: 'api',
        prefixColor: 'blue',
        env: { SERVER_MODULE: serverModulePath, ROOT_DIR: rootDir, PORT: String(port) }
      },
      { command: 'npm run dev', name: 'web', prefixColor: 'green', cwd: webDir }
    ]);

    result.catch((err) => {
      console.error('启动失败:', err);
      process.exit(1);
    });
  });
