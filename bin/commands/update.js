const { Command } = require('commander');
const { updateCommand, executeUpdateTransaction } = require('../../src/commands/update');
const { getAIConfig } = require('../../src/utils/config');
const { outputPrompt } = require('../../src/utils/prompt-output');

const update = new Command('update')
  .description('检测变化，更新相关文档')
  .option('--dry-run', '只检测变化，不更新')
  .option('--apply', '自动调用 AI 更新文档（执行 section 替换写回）')
  .option('--stdout', '输出 prompt 到 stdout')
  .action(async (options) => {
    try {
      const rootDir = process.cwd();
      const result = await updateCommand(rootDir, { dryRun: options.dryRun });

      if (result.changedFiles.length === 0) {
        console.log('✓ 没有检测到文件变化');
        return;
      }

      const methodLabels = {
        'git-diff': 'git diff',
        'git-untracked': 'git untracked',
        'git-first-run': 'git 首次扫描',
        'hash': '文件 hash 比对'
      };
      console.log(`检测到 ${result.changedFiles.length} 个文件变化（${methodLabels[result.detectionMethod] || result.detectionMethod}）：`);
      result.changedFiles.slice(0, 10).forEach(f => console.log(`  ${f}`));
      if (result.changedFiles.length > 10) {
        console.log(`  ... 还有 ${result.changedFiles.length - 10} 个文件`);
      }

      // Show section list in dry-run or normal mode
      if (result.sectionUpdates.length > 0) {
        console.log(`\n涉及 ${result.sectionUpdates.length} 个 section：`);
        const grouped = {};
        for (const u of result.sectionUpdates) {
          if (!grouped[u.docName]) grouped[u.docName] = [];
          grouped[u.docName].push(u.sectionName);
        }
        for (const [doc, sections] of Object.entries(grouped)) {
          console.log(`  ${doc} > ${sections.join(', ')}`);
        }
      }

      if (options.apply) {
        // --apply: call AI and write back
        if (result.sectionUpdates.length === 0) {
          console.log('\n没有可更新的 section（文档可能缺少 section 标记）');
          if (result.prompt) {
            console.log('已生成全量更新 prompt，可手动粘贴给 AI：');
            await outputPrompt(result.prompt, options, {
              successMessage: '✓ prompt 已复制到剪贴板'
            });
          }
          return;
        }

        const aiConfig = getAIConfig(rootDir);
        if (!aiConfig.apiKey) {
          console.log('\n⚠ 未配置 API Key，请先在 .env 文件中配置');
          console.log('  已生成 prompt，可手动粘贴给 AI：');
          await outputPrompt(result.prompt || '', options, {
            successMessage: '✓ prompt 已复制到剪贴板'
          });
          return;
        }

        console.log('\n开始自动更新文档...');
        const updateResult = await executeUpdateTransaction(rootDir, result, aiConfig);

        console.log(`\n更新完成：✓ ${updateResult.success} 成功 / ✗ ${updateResult.failed} 失败 / ⊘ ${updateResult.skipped} 跳过`);
        if (!updateResult.committed) {
          console.log('扫描基线未提交，失败或待处理 section 将在下次 update 时重试');
        }
        if (updateResult.failed > 0) {
          console.log('\n失败的 section：');
          updateResult.results
            .filter(r => r.status === 'failed')
            .forEach(r => console.log(`  ${r.docName} > ${r.sectionName}: ${r.reason}`));
        }
      } else {
        // Default: copy prompt to clipboard
        if (result.prompt) {
          await outputPrompt(result.prompt, options, {
            successMessage: '\n✓ 增量更新 prompt 已复制到剪贴板',
            fallbackPrefix: '\n'
          });
        }
      }
    } catch (err) {
      console.error('更新失败:', err.message);
      process.exit(1);
    }
  });

module.exports = update;
