const { Command } = require('commander');
const { input, confirm } = require('@inquirer/prompts');
const { useCommand } = require('../../src/commands/use');
const { writeToClipboard } = require('../../src/utils/clipboard');
const { addTask } = require('../../src/utils/task-history');
const fs = require('fs');
const path = require('path');

const PLACEHOLDER_RE = /【[^】]+】/g;

async function fillPlaceholders(prompt) {
  const placeholders = [...new Set(prompt.match(PLACEHOLDER_RE) || [])];
  if (placeholders.length === 0) return prompt;

  console.log(`\n发现 ${placeholders.length} 个占位符：`);
  placeholders.forEach(p => console.log(`  ${p}`));

  const shouldFill = await confirm({ message: '是否现在填写？', default: false });
  if (!shouldFill) return prompt;

  let filled = prompt;
  for (const placeholder of placeholders) {
    const value = await input({ message: `填写 ${placeholder}`, default: '' });
    if (value) {
      filled = filled.split(placeholder).join(`【${value}】`);
    }
  }
  return filled;
}

async function outputPrompt(prompt, options) {
  if (options.stdout) {
    process.stdout.write(prompt);
  } else if (options.out) {
    fs.writeFileSync(path.resolve(options.out), prompt);
    console.log(`✓ 已写入 ${options.out}`);
  } else {
    const clipResult = await writeToClipboard(prompt);
    if (clipResult.success) {
      console.log('✓ 已复制到剪贴板，去你的 AI 工具粘贴即可');
    } else {
      console.log(`⚠️ 剪贴板写入失败，已降级输出到 ${clipResult.fallbackPath}`);
    }
  }
}

const use = new Command('use')
  .description('生成开发 prompt')
  .argument('[task]', '任务描述')
  .option('-s, --scenario <id>', '指定场景 ID（不指定则自动匹配）')
  .option('-n, --non-interactive', '非交互模式，跳过占位符填写，直接复制到剪贴板')
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

      const finalPrompt = options.nonInteractive
        ? result.prompt
        : await fillPlaceholders(result.prompt);
      await outputPrompt(finalPrompt, options);

      try {
        addTask(rootDir, {
          task: task,
          scenario: result.matchedScenario,
          projects: result.relatedProjects || []
        });
      } catch {}

      if (!options.nonInteractive) {
        console.log('\n提示：粘贴后记得补充具体需求细节');
      }
    } catch (err) {
      console.error('生成失败:', err.message);
      process.exit(1);
    }
  });

module.exports = use;
