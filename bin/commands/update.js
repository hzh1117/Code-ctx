const { Command } = require('commander');
const { updateCommand, executeUpdates } = require('../../src/commands/update');
const { writeToClipboard } = require('../../src/utils/clipboard');
const { getAIConfig } = require('../../src/utils/config');

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
            if (options.stdout) {
              process.stdout.write(result.prompt);
            } else {
              const clipResult = await writeToClipboard(result.prompt);
              if (clipResult.success) {
                console.log('✓ prompt 已复制到剪贴板');
              } else {
                console.log(`⚠ 剪贴板写入失败，已降级输出到 ${clipResult.fallbackPath}`);
              }
            }
          }
          return;
        }

        const aiConfig = getAIConfig(rootDir);
        if (!aiConfig.apiKey) {
          console.log('\n⚠ 未配置 API Key，请先在 .env 文件中配置');
          console.log('  已生成 prompt，可手动粘贴给 AI：');
          if (options.stdout) {
            process.stdout.write(result.prompt || '');
          } else {
            const clipResult = await writeToClipboard(result.prompt || '');
            if (clipResult.success) {
              console.log('✓ prompt 已复制到剪贴板');
            } else {
              console.log(`⚠ 剪贴板写入失败，已降级输出到 ${clipResult.fallbackPath}`);
            }
          }
          return;
        }

        console.log('\n开始自动更新文档...');
        const updateResult = await executeUpdates(rootDir, result.sectionUpdates, aiConfig);

        console.log(`\n更新完成：✓ ${updateResult.success} 成功 / ✗ ${updateResult.failed} 失败 / ⊘ ${updateResult.skipped} 跳过`);
        if (updateResult.failed > 0) {
          console.log('\n失败的 section：');
          updateResult.results
            .filter(r => r.status === 'failed')
            .forEach(r => console.log(`  ${r.docName} > ${r.sectionName}: ${r.reason}`));
        }
      } else {
        // Default: copy prompt to clipboard
        if (result.prompt) {
          if (options.stdout) {
            process.stdout.write(result.prompt);
          } else {
            const clipResult = await writeToClipboard(result.prompt);
            if (clipResult.success) {
              console.log('\n✓ 增量更新 prompt 已复制到剪贴板');
            } else {
              console.log(`\n⚠ 剪贴板写入失败，已降级输出到 ${clipResult.fallbackPath}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('更新失败:', err.message);
      process.exit(1);
    }
  });

module.exports = update;
