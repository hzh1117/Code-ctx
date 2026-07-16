const { Command } = require('commander');
const { initCommand } = require('../../src/commands/init');
const { runWithInterrupt, exitCodeForError } = require('../abortable-action');

const init = new Command('init')
  .description('初始化项目，扫描结构生成 ai-docs/')
  .option('--skip-ai', '跳过 AI 文档生成，只扫描项目结构')
  .option('--force', '强制重新生成，忽略已完成状态')
  .option('-p, --project <alias>', '仅处理指定的子项目（使用别名）')
  .option('-d, --doc-type <type>', '生成特定类型的文档 (api|database)')
  .option('--unlimited', '不限制文件数量和 token')
  .option('--config-format <format>', '配置文件格式 json|js（默认 json）')
  .option('-v, --verbose', '显示详细执行日志')
  .action((options) => runWithInterrupt(async (signal) => {
    try {
      if (options.configFormat && !['json', 'js'].includes(options.configFormat)) {
        console.error('初始化失败: --config-format 必须是 json 或 js');
        process.exitCode = 1;
        return;
      }
      const result = await initCommand(process.cwd(), {
        skipAi: options.skipAi,
        force: options.force,
        project: options.project,
        docType: options.docType,
        unlimited: options.unlimited,
        configFormat: options.configFormat,
        verbose: options.verbose,
        signal
      });
      if (!result.success) {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error('初始化失败:', err.message);
      process.exitCode = exitCodeForError(err);
    }
  }));

module.exports = init;
