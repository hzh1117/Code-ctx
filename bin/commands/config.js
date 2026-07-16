const path = require('path');
const { Command } = require('commander');
const { inspectProjectConfig } = require('../../src/utils/config');

const config = new Command('config')
  .description('检查和管理项目配置');

config
  .command('validate [root]')
  .description('严格校验 code-ctx 配置')
  .action(root => {
    const rootDir = path.resolve(root || process.cwd());
    const result = inspectProjectConfig(rootDir);

    result.warnings.forEach(warning => console.warn(`警告: ${warning}`));
    if (result.errors.length > 0) {
      result.errors.forEach(error => console.error(`错误: ${error}`));
      process.exitCode = 1;
      return result;
    }

    console.log(`配置有效: ${result.path}`);
    return result;
  });

module.exports = config;
