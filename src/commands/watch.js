const fs = require('fs');
const path = require('path');
const { updateCommand, executeUpdateTransaction } = require('./update');
const { getAIConfig } = require('../utils/config');
const { clearCache } = require('../template/engine');

const DEFAULT_DEBOUNCE_MS = 5000;
const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build', 'ai-docs'];

function shouldIgnore(filePath) {
  const parts = filePath.split(path.sep);
  return parts.some(part => IGNORED_DIRS.includes(part));
}

async function watchCommand(rootDir, options = {}) {
  const debounceMs = options.debounce || DEFAULT_DEBOUNCE_MS;
  const autoApply = options.autoApply || false;
  let debounceTimer = null;
  let isProcessing = false;

  console.log('👀 监听文件变化中...');
  console.log(`   防抖间隔: ${debounceMs}ms`);
  console.log(`   自动更新: ${autoApply ? '是' : '否'}`);
  console.log('   按 Ctrl+C 停止\n');

  const aiConfig = autoApply ? getAIConfig(rootDir) : null;

  async function processChanges() {
    if (isProcessing) return;
    isProcessing = true;

    try {
      clearCache(); // Refresh templates and scenarios
      const result = await updateCommand(rootDir, { dryRun: false });

      if (result.changedFiles.length === 0) {
        isProcessing = false;
        return;
      }

      const now = new Date().toLocaleTimeString();
      console.log(`[${now}] 检测到 ${result.changedFiles.length} 个文件变化：`);
      result.changedFiles.slice(0, 5).forEach(f => console.log(`  ${f}`));
      if (result.changedFiles.length > 5) {
        console.log(`  ... 还有 ${result.changedFiles.length - 5} 个文件`);
      }

      if (autoApply && aiConfig && aiConfig.apiKey && result.sectionUpdates.length > 0) {
        console.log('\n自动更新文档...');
        const updateResult = await executeUpdateTransaction(rootDir, result, aiConfig);
        console.log(`更新完成：✓ ${updateResult.success} / ✗ ${updateResult.failed} / ⊘ ${updateResult.skipped}`);
      } else if (result.sectionUpdates.length > 0) {
        console.log(`  涉及 ${result.sectionUpdates.length} 个 section，运行 code-ctx update --apply 更新文档`);
      }
    } catch (err) {
      console.error(`  ✗ 处理失败: ${err.message}`);
    } finally {
      isProcessing = false;
    }
  }

  function onChange(filePath) {
    if (shouldIgnore(filePath)) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processChanges, debounceMs);
  }

  // Watch source directories
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const watchers = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (IGNORED_DIRS.includes(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

    const dirPath = path.join(rootDir, entry.name);
    try {
      const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (filename) {
          onChange(path.join(entry.name, filename));
        }
      });
      watchers.push(watcher);
    } catch (err) {
      // Some directories may not support recursive watching
    }
  }

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n停止监听');
    for (const watcher of watchers) {
      watcher.close();
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    process.exit(0);
  });

  // Keep process alive
  return new Promise(() => {});
}

module.exports = { watchCommand };
