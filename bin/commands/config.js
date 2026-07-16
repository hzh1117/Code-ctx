const path = require('path');
const { Command } = require('commander');
const { inspectProjectConfig, migrateProjectConfig } = require('../../src/utils/config');
const { listPresets, getPreset } = require('../../src/ai/presets');
const { setupAIConfig } = require('../../src/config/setup-service');

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

config
  .command('setup [root]')
  .description('交互配置 AI provider 并测试连接')
  .option('--provider <id>', 'provider preset id')
  .option('--base-url <url>', '覆盖 API Base URL')
  .option('--model <name>', '覆盖模型名')
  .option('--no-test', '保存后不测试连接')
  .action(async (root, options) => {
    const rootDir = path.resolve(root || process.cwd());
    try {
      let prompts = null;
      const getPrompts = async () => {
        if (!prompts) prompts = await import('@inquirer/prompts');
        return prompts;
      };
      const provider = options.provider || await (await getPrompts()).select({
        message: '选择 AI provider',
        choices: listPresets().map(preset => ({ name: preset.name, value: preset.id }))
      });
      const preset = getPreset(provider);
      if (!preset) throw new Error(`未知 provider: ${provider}`);
      const baseUrl = options.baseUrl || await (await getPrompts()).input({
        message: 'API Base URL',
        default: preset.baseUrl
      });
      const model = options.model || await (await getPrompts()).input({
        message: '模型',
        default: preset.model
      });
      const apiKey = process.env.CODE_CTX_SETUP_API_KEY || await (await getPrompts()).password({
        message: 'API Key',
        mask: '*'
      });
      const result = await setupAIConfig(rootDir, {
        provider,
        baseUrl,
        model,
        apiKey,
        testConnection: options.test
      });
      console.log(`配置已保存: ${result.provider} / ${result.model}`);
      if (result.connection.tested && result.connection.success) console.log('连接测试通过');
      if (result.connection.tested && !result.connection.success) {
        console.error(`连接测试失败: ${result.connection.error}`);
        process.exitCode = 1;
      }
      return result;
    } catch (error) {
      console.error(`配置失败: ${error.message}`);
      process.exitCode = 1;
      return null;
    }
  });

module.exports = config;
