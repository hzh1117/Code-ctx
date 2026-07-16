const { Command } = require('commander');
const { input, confirm, select } = require('@inquirer/prompts');
const { useCommand } = require('../../src/commands/use');
const { getAIConfig } = require('../../src/utils/config');
const { outputPrompt } = require('../../src/utils/prompt-output');
const { runWithInterrupt, exitCodeForError } = require('../abortable-action');

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

const use = new Command('use')
  .description('生成开发 prompt')
  .argument('[task]', '任务描述')
  .option('-s, --scenario <id>', '指定场景 ID（不指定则自动匹配）')
  .option('-n, --non-interactive', '非交互模式，跳过占位符填写，直接复制到剪贴板')
  .option('--no-ai-match', '跳过 AI 辅助场景匹配，仅使用关键词匹配')
  .option('-l, --language <lang>', 'Prompt 语言 (zh/en)', 'zh')
  .option('--stdout', '输出到 stdout 而非剪贴板')
  .option('--out <file>', '输出到指定文件')
  .action((task, options) => runWithInterrupt(async (signal) => {
    try {
      const rootDir = process.cwd();
      const aiConfig = { ...getAIConfig(rootDir), signal };
      const language = options.language || 'zh';

      let result = await useCommand({
        taskDescription: task,
        scenario: options.scenario,
        rootDir,
        aiConfig,
        noAiMatch: !!options.noAiMatch,
        language
      });

      // 低置信度：让用户手动选择场景
      if (result.lowConfidenceScenarios) {
        console.log(`⚠️ 任务描述匹配度较低（${result.confidence}%），请手动选择场景：`);
        const choices = result.lowConfidenceScenarios.map(s => ({
          name: `${s.id} - ${s.name}（${s.description}）`,
          value: s.id
        }));
        const selectedId = await select({
          message: '选择场景',
          choices
        });
        result = await useCommand({
          taskDescription: task,
          scenario: selectedId,
          rootDir,
          aiConfig,
          noAiMatch: !!options.noAiMatch,
          language
        });
      }

      if (!options.scenario && !result.lowConfidenceScenarios) {
        const methodTag = result.matchMethod === 'ai' ? ' (AI 辅助)' : '';
        console.log(`✓ 识别为：场景 ${result.matchedScenario}（${result.scenarioName}）置信度 ${result.confidence}%${methodTag}`);
        if (result.aiReason) {
          console.log(`  AI 判断理由：${result.aiReason}`);
        }
        if (result.loadedDocs && result.loadedDocs.length > 0) {
          console.log('  已加载文档：');
          result.loadedDocs.forEach(doc => console.log(`    ✓ ${doc}`));
        }
        if (result.confidence < 100 && result.matchMethod === 'keyword') {
          console.log('  不对？使用 -s 参数指定场景，如：code-ctx use -s B "任务描述"');
        }
      }

      if (result.compactInfo) {
        const { originalLength, compactLength } = result.compactInfo;
        console.log(`✓ 已启用精简模式（原 ${originalLength} 字 → ${compactLength} 字）`);
      }

      if (result.tokenBudget) {
        const { estimate, maxTokens, status } = result.tokenBudget;
        if (status === 'over') {
          console.log(`⚠️ token 预算超限：估算 ~${estimate} > 配置 ${maxTokens}，可能被截断`);
        } else if (status === 'warn') {
          console.log(`⚠️ token 预算接近上限：估算 ~${estimate} / 配置 ${maxTokens}`);
        } else if (maxTokens) {
          console.log(`ℹ️ token 估算 ~${estimate} / 配置 ${maxTokens}`);
        } else {
          console.log(`ℹ️ token 估算 ~${estimate}`);
        }
      }

      const finalPrompt = options.nonInteractive
        ? result.prompt
        : await fillPlaceholders(result.prompt);
      await outputPrompt(finalPrompt, options, {
        successMessage: '✓ 已复制到剪贴板，去你的 AI 工具粘贴即可'
      });

      // Task history is recorded inside useCommand (P29) — no duplicate write here.

      if (!options.nonInteractive) {
        console.log('\n提示：粘贴后记得补充具体需求细节');
      }
    } catch (err) {
      console.error('生成失败:', err.message);
      process.exitCode = exitCodeForError(err);
    }
  }));

module.exports = use;
