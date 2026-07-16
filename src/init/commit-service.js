const fs = require('fs');
const path = require('path');
const { hasGitRepo, getCurrentCommitHash } = require('../utils/git-utils');
const { STATE_FILES } = require('../utils/constants');

function createCommitService(dependencies = {}) {
  const fileSystem = dependencies.fs || fs;
  const pathImpl = dependencies.path || path;
  const clock = dependencies.clock || {
    now: () => Date.now(),
    isoNow: () => new Date().toISOString()
  };
  const isGitRepo = dependencies.hasGitRepo || hasGitRepo;
  const currentCommit = dependencies.getCurrentCommitHash || getCurrentCommitHash;
  const logger = dependencies.logger;

  return {
    commit({ rootDir, outputDir, projects, state, stateStore, generation }) {
      logger.verbose('保存最终状态...');
      state.lastRun = clock.isoNow ? clock.isoNow() : new Date(clock.now()).toISOString();
      stateStore.save(outputDir, state);

      if (generation.success) {
        fileSystem.writeFileSync(
          pathImpl.join(outputDir, STATE_FILES.LAST_SCAN),
          JSON.stringify(
            {
              timestamp: clock.now(),
              lastCommitHash: isGitRepo(rootDir) ? currentCommit(rootDir) : null,
              projects: projects.map(project => project.alias)
            },
            null,
            2
          )
        );
      }
      logger.verbose('状态文件已更新');

      if (!generation.success) {
        const generatedCount = Object.keys(generation.generatedDocs).length;
        const label = generation.status === 'partial' ? '初始化部分完成' : '初始化失败';
        logger.error(`\n${label}：生成 ${generatedCount} 个，失败 ${generation.failedDocs.length} 个`);
        generation.failedDocs.forEach(failure => {
          logger.error(`  - ${failure.alias || 'unknown'}: ${failure.error}`);
        });
        logger.error('请修复配置或网络问题后重新运行 code-ctx init');
        return;
      }

      const completionMessages = {
        'offline-completed': '\n✓ 离线文档生成完成（已跳过 AI）',
        scanned: '\n✓ 项目扫描完成（已跳过 AI 文档生成）',
        unchanged: '\n✓ 初始化检查完成（文档无需重新生成）',
        completed: '\n✓ 初始化完成！'
      };
      logger.log(completionMessages[generation.status] || completionMessages.completed);
      logger.log('ai-docs/ 已创建');
      logger.log('\n下一步：');
      logger.log('  开始开发前：  code-ctx use "你的任务描述"');
      logger.log('  代码有大改动：code-ctx update');
      logger.log('  检查文档健康：code-ctx doctor');
      logger.log('  重新生成文档：code-ctx fix <子项目别名>');
    }
  };
}

module.exports = { createCommitService };
