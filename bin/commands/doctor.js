const { Command } = require('commander');
const { doctorCommand, doctorFix } = require('../../src/commands/doctor');
const { runWithInterrupt, exitCodeForError } = require('../abortable-action');

const doctor = new Command('doctor')
  .description('检查文档健康状态')
  .option('--strict', '严格模式（解析代码路由，检查未记录的接口）')
  .option('--fix', '自动修复文档问题（调用 AI 重新生成）')
  .option('--force', '配合 --fix 使用，强制重新生成所有文档')
  .action(options =>
    runWithInterrupt(async signal => {
      try {
        if (options.fix) {
          await doctorFix(process.cwd(), { force: options.force, signal });
        } else {
          const result = await doctorCommand(process.cwd(), { strict: options.strict });
          if (result.issues.length > 0) {
            process.exitCode = 1;
          }
        }
      } catch (err) {
        console.error('检查失败:', err.message);
        process.exitCode = exitCodeForError(err);
      }
    })
  );

module.exports = doctor;
