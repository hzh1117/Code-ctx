const { Command } = require('commander');
const { useCommand } = require('../../src/commands/use');
const clipboardy = require('clipboardy');

const use = new Command('use')
  .description('生成开发 prompt')
  .argument('[task]', '任务描述')
  .option('-s, --scenario <id>', '场景 ID')
  .action(async (task, options) => {
    try {
      const scenario = options.scenario || 'A';
      const prompt = useCommand({
        scenario,
        projectName: '项目',
        featureName: task || '新功能'
      });

      await clipboardy.write(prompt);
      console.log('✓ 已复制到剪贴板');
      console.log('\n提示：粘贴后记得补充具体需求细节');
    } catch (err) {
      console.error('生成失败:', err.message);
      process.exit(1);
    }
  });

module.exports = use;
