# Contributing to Code-ctx / 参与贡献

## 中文

感谢你帮助改进 Code-ctx。本项目仍在积极开发中，越小、越聚焦的 Pull Request 越容易 review 和合并。

### 开发环境

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx
npm install
cd web && npm install && cd ..
```

提交 PR 前请先运行本地检查：

```bash
npm run check
```

### 分支与提交

- 从 `master` 创建分支。
- 每个 PR 聚焦一个功能、一个 bug 修复或一类文档变更。
- 提交信息尽量清晰，推荐使用 `feat:`、`fix:`、`docs:`、`test:`、`refactor:` 等前缀。

### PR 检查清单

- 说明问题和解决方案。
- 修改 UI 或 CLI 行为时，附上截图或终端输出。
- 行为变更需要新增或更新测试。
- 命令、配置、环境变量、用户流程变更时，同步更新 README 或文档。
- 不要提交本地密钥、`.env`、生成的 prompt 文件或私有项目文档。

### 项目结构提示

- CLI 入口：`bin/cli.js`
- 核心命令实现：`src/commands/`
- 本地 Dashboard API：`src/web/`
- Dashboard 前端：`web/`
- 内置项目探测适配器：`src/adapters/builtin/`

### 提交 Issue

请优先使用 bug report 或 feature request 模板。报告 bug 时请包含：

- 操作系统和 Node.js 版本。
- 具体命令或 Dashboard 页面。
- 预期行为。
- 实际行为，包括日志或截图。
- 最小复现步骤。

---

## English

Thanks for helping improve Code-ctx. This project is in active development, so small, focused pull requests are easiest to review and merge.

### Development Setup

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx
npm install
cd web && npm install && cd ..
```

Run the local checks before opening a pull request:

```bash
npm run check
```

### Branches and Commits

- Create a branch from `master`.
- Keep each pull request focused on one feature, bug fix, or documentation change.
- Use clear commit messages. Conventional prefixes such as `feat:`, `fix:`, `docs:`, `test:`, and `refactor:` are preferred.

### Pull Request Checklist

- Explain the problem and the solution.
- Include screenshots or terminal output when changing UI or CLI behavior.
- Add or update tests for behavior changes.
- Update README or docs when commands, config, environment variables, or user workflows change.
- Do not commit local secrets, `.env`, generated prompt files, or private project documentation.

### Project Notes

- The CLI entry is `bin/cli.js`.
- Core command implementations live in `src/commands/`.
- The local dashboard API lives in `src/web/`.
- The dashboard frontend is a Vue 3 app in `web/`.
- Built-in project detectors live under `src/adapters/builtin/`.

### Reporting Issues

Use the bug report or feature request templates when possible. For bugs, include:

- Operating system and Node.js version.
- Exact command or dashboard page.
- Expected behavior.
- Actual behavior, including logs or screenshots.
- Minimal reproduction steps.
