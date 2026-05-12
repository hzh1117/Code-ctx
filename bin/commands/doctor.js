const { Command } = require('commander');
const { doctorCommand } = require('../../src/commands/doctor');

const doctor = new Command('doctor')
  .description('检查文档健康状态')
  .action(async () => {
    try {
      const report = await doctorCommand(process.cwd());
      
      if (report.issues.length === 0 && report.warnings.length === 0) {
        console.log('✓ 文档健康，没有发现问题');
        return;
      }
      
      if (report.issues.length > 0) {
        console.log('❌ 问题:\n');
        report.issues.forEach(issue => console.log(`  - ${issue}`));
        console.log('');
      }
      
      if (report.warnings.length > 0) {
        console.log('⚠️ 警告:\n');
        report.warnings.forEach(warning => console.log(`  - ${warning}`));
        console.log('');
      }
      
      console.log('建议运行 code-ctx update 更新文档');
    } catch (err) {
      console.error('检查失败:', err.message);
      process.exit(1);
    }
  });

module.exports = doctor;
