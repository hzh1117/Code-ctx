const { Command } = require('commander');
const { doctorCommand } = require('../../src/commands/doctor');

const doctor = new Command('doctor')
  .description('检查文档健康状态')
  .option('--strict', '严格模式（解析代码对比路由）')
  .action(async (options) => {
    try {
      const result = await doctorCommand(process.cwd(), { strict: options.strict });
      if (result.issues.length > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.error('检查失败:', err.message);
      process.exit(1);
    }
  });

module.exports = doctor;
