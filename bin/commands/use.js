const { Command } = require('commander');
const { useCommand } = require('../../src/commands/use');
const clipboardy = require('clipboardy');
const fs = require('fs');
const path = require('path');

const use = new Command('use')
  .description('生成开发 prompt')
  .argument('[task]', '任务描述')
  .option('-s, --scenario <id>', '指定场景 ID（不指定则自动匹配）')
  .option('--stdout', '输出到 stdout 而非剪贴板')
  .option('--out <file>', '输出到指定文件')
  .action(async (task, options) => {
    try {
      const rootDir = process.cwd();
      const result = await useCommand({
        taskDescription: task,
        scenario: options.scenario,
        rootDir
      });

      if (!options.scenario) {
        console.log(`✓ 识别为：场景 ${result.matchedScenario}（${result.scenarioName}）置信度 ${result.confidence}%`);
        if (result.confidence < 100) {
          console.log('  不对？使用 -s 参数指定场景，如：code-ctx use -s B "任务描述"');
        }
      }

      if (options.stdout) {
        process.stdout.write(result.prompt);
      } else if (options.out) {
        fs.writeFileSync(path.resolve(options.out), result.prompt);
        console.log(`✓ 已写入 ${options.out}`);
      } else {
        try {
          await clipboardy.write(result.prompt);
          console.log('✓ 已复制到剪贴板，去你的 AI 工具粘贴即可');
        } catch {
          const fallbackPath = '.ai-prompt.md';
          fs.writeFileSync(fallbackPath, result.prompt);
          console.log(`⚠️ 剪贴板写入失败，已降级输出到 ${fallbackPath}`);
        }
      }

      console.log('\n提示：粘贴后记得补充具体需求细节');
    } catch (err) {
      console.error('生成失败:', err.message);
      process.exit(1);
    }
  });

module.exports = use;
