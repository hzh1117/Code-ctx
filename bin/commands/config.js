const path = require('path');
const { Command } = require('commander');
const { inspectProjectConfig, migrateProjectConfig } = require('../../src/utils/config');

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

config
  .command('migrate [root]')
  .description('将旧 JS 配置安全迁移为 JSON')
  .action(root => {
    const rootDir = path.resolve(root || process.cwd());
    try {
      const result = migrateProjectConfig(rootDir);
      if (result.status === 'already-json') {
        console.log(`配置已经是 JSON: ${result.path}`);
      } else {
        console.log(`迁移完成: ${result.path}`);
        console.log(`旧配置备份: ${result.backupPath}`);
      }
      return result;
    } catch (error) {
      console.error(`迁移失败: ${error.message}`);
      process.exitCode = 1;
      return null;
    }
  });

module.exports = config;
