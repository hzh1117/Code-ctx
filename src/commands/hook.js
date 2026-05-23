const fs = require('fs');
const path = require('path');
const { hasGitRepo } = require('../utils/git-utils');

const HOOK_SCRIPT = `#!/bin/sh
# code-ctx post-commit hook
# 检查是否有文档可能需要更新

CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null)
if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# 检查是否有非 ai-docs 目录的文件变化
SRC_CHANGES=$(echo "$CHANGED_FILES" | grep -v "^ai-docs/" | grep -v "^node_modules/" | grep -v "^\\.git/" | head -5)
if [ -n "$SRC_CHANGES" ]; then
  echo ""
  echo "📋 code-ctx: 检测到源码变更，文档可能需要更新"
  echo "   运行 code-ctx update 检查变化"
  echo "   运行 code-ctx update --apply 自动更新文档"
  echo ""
fi
`;

async function hookCommand(rootDir, action) {
  if (!hasGitRepo(rootDir)) {
    console.log('❌ 当前目录不是 git 仓库');
    return;
  }

  const hooksDir = path.join(rootDir, '.git', 'hooks');
  const hookPath = path.join(hooksDir, 'post-commit');

  if (action === 'install') {
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    // Check if hook already exists
    if (fs.existsSync(hookPath)) {
      const existing = fs.readFileSync(hookPath, 'utf8');
      if (existing.includes('code-ctx')) {
        console.log('✓ code-ctx hook 已安装');
        return;
      }
      // Backup existing hook
      fs.copyFileSync(hookPath, hookPath + '.bak');
      console.log('  已备份原有 hook 到 post-commit.bak');
    }

    fs.writeFileSync(hookPath, HOOK_SCRIPT, { mode: 0o755 });
    console.log('✓ 已安装 post-commit hook');
    console.log('  每次 commit 后会提示是否需要更新文档');
    console.log('  卸载: code-ctx hook uninstall');
  } else if (action === 'uninstall') {
    if (!fs.existsSync(hookPath)) {
      console.log('✓ 未安装 code-ctx hook');
      return;
    }

    const content = fs.readFileSync(hookPath, 'utf8');
    if (!content.includes('code-ctx')) {
      console.log('✓ post-commit hook 不是 code-ctx 安装的，跳过');
      return;
    }

    // Restore backup if exists
    const backupPath = hookPath + '.bak';
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, hookPath);
      fs.unlinkSync(backupPath);
      console.log('✓ 已卸载 code-ctx hook，恢复原有 hook');
    } else {
      fs.unlinkSync(hookPath);
      console.log('✓ 已卸载 code-ctx hook');
    }
  } else {
    // Status
    if (!fs.existsSync(hookPath)) {
      console.log('未安装 post-commit hook');
      return;
    }

    const content = fs.readFileSync(hookPath, 'utf8');
    if (content.includes('code-ctx')) {
      console.log('✓ code-ctx post-commit hook 已安装');
    } else {
      console.log('post-commit hook 存在（非 code-ctx 安装）');
    }
  }
}

module.exports = { hookCommand };
