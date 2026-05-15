# Contributing to Code-ctx / 参与贡献

## 中文

感谢你帮助改进 Code-ctx。本项目源码公开但仅允许非商业使用，提交贡献即表示你确认自己的贡献可以按 [LICENSE](LICENSE) 中的非商业源码许可发布。

### 当前优先级

在完整维护仓库中，请优先阅读 `docs/` 下的分析报告，尤其是：

- `docs/综合分析报告-comprehensive-analysis-report.md`
- `docs/问题跟踪清单-issue-tracker.md`
- `docs/改进修复计划-repair-plan.md`
- `docs/安全审计报告-security-audit-report.md`
- `docs/测试质量报告-test-quality-report.md`

当前最需要的贡献方向：

- P0 安全修复：配置文件执行、命令拼接、Dashboard 配置写入、SSRF、错误信息泄露、速率限制。
- 测试补齐：`core/section.js`、`core/doc-resolver.js`、`web/middleware/security.js`、`utils/git-utils.js`。
- 性能优化：AI 并发、hash 模式 mtime 预筛选、Dashboard 状态缓存、前端懒加载。
- 文档同步：README、配置示例、AI 使用指令和安全说明。

### 开发环境

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx
npm install
cd web && npm install && cd ..
```

常用命令：

```bash
npm test -- --runInBand
npm run build:web
npm run check
node bin/cli.js help
node bin/cli.js dashboard
```

### 分支与提交

- 从 `master` 创建分支。
- 每个 PR 聚焦一个功能、一个 bug 修复或一类文档变更。
- 推荐提交前缀：`feat:`、`fix:`、`docs:`、`test:`、`refactor:`、`security:`、`perf:`。
- 不要把大规模重构、安全修复、依赖升级和 UI 改造混在同一个 PR。

### PR 检查清单

- 说明问题、影响范围、解决方案和验证结果。
- 涉及 `docs/问题跟踪清单-issue-tracker.md` 的问题时，标明问题 ID，例如 `SEC-001`、`TEST-003`。
- 行为变更需要新增或更新测试。
- 修改 CLI、Dashboard、配置、环境变量或用户流程时，同步更新 README 或相关文档。
- 修改安全逻辑时，附上负向用例或手动验证命令。
- 不要提交 `.env`、API Key、Token、SSH Key、私有项目文档、生成的 prompt 文件或本地调试脚本。
- 商业使用相关请求不要通过普通 PR 处理，请联系维护者获取书面授权。

### 项目结构提示

- CLI 入口：`bin/cli.js`
- 命令薄壳层：`bin/commands/`
- 核心命令实现：`src/commands/`
- AI 客户端：`src/ai/client.js`
- 项目扫描和适配器：`src/scanner/`、`src/adapters/`
- Prompt 模板：`templates/`
- 本地 Dashboard API：`src/web/`
- Dashboard 前端：`web/`
- 测试：`tests/`

### 提交 Issue

请优先使用模板。Bug 报告请包含：

- 操作系统、Node.js 版本和 Code-ctx 版本或 commit。
- 具体命令、参数或 Dashboard 页面。
- 预期行为和实际行为。
- 最小复现步骤。
- 日志或截图，但必须先移除密钥和私有路径。

安全问题请参考 [SECURITY.md](SECURITY.md)，不要公开提交。维护者应优先开启 GitHub Private vulnerability reporting，并确认安全通知能送达仓库管理员。

---

## English

Thanks for helping improve Code-ctx. The project is source-available for non-commercial use only. By contributing, you confirm that your contribution may be published under the non-commercial source license in [LICENSE](LICENSE).

### Current Priorities

In the full maintenance repository, read the reports under `docs/` first, especially:

- `docs/综合分析报告-comprehensive-analysis-report.md`
- `docs/问题跟踪清单-issue-tracker.md`
- `docs/改进修复计划-repair-plan.md`
- `docs/安全审计报告-security-audit-report.md`
- `docs/测试质量报告-test-quality-report.md`

The highest-value contribution areas are:

- P0 security fixes: config execution, command construction, Dashboard config writes, SSRF, error disclosure, and rate limiting.
- Test coverage: `core/section.js`, `core/doc-resolver.js`, `web/middleware/security.js`, and `utils/git-utils.js`.
- Performance: AI concurrency, mtime prefiltering for hash mode, Dashboard status caching, and frontend lazy loading.
- Documentation sync: README, config examples, AI handoff prompts, and security guidance.

### Development Setup

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx
npm install
cd web && npm install && cd ..
```

Useful commands:

```bash
npm test -- --runInBand
npm run build:web
npm run check
node bin/cli.js help
node bin/cli.js dashboard
```

### Branches and Commits

- Create branches from `master`.
- Keep each PR focused on one feature, bug fix, or documentation area.
- Preferred prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `security:`, `perf:`.
- Do not mix broad refactors, security fixes, dependency upgrades, and UI changes in one PR.

### Pull Request Checklist

- Explain the problem, impact, solution, and verification.
- If the work maps to `docs/问题跟踪清单-issue-tracker.md`, include the issue ID such as `SEC-001` or `TEST-003`.
- Add or update tests for behavior changes.
- Update README or related docs when changing CLI commands, Dashboard behavior, config, environment variables, or workflows.
- For security changes, include negative tests or manual verification commands.
- Do not commit `.env`, API keys, tokens, SSH keys, private project docs, generated prompt files, or local debug scripts.
- Commercial-use requests should not be handled through normal PRs; contact the maintainer for written permission.

### Project Notes

- CLI entry: `bin/cli.js`
- CLI command wrappers: `bin/commands/`
- Core command implementations: `src/commands/`
- AI client: `src/ai/client.js`
- Project scanning and adapters: `src/scanner/`, `src/adapters/`
- Prompt templates: `templates/`
- Local Dashboard API: `src/web/`
- Dashboard frontend: `web/`
- Tests: `tests/`

### Reporting Issues

Use the issue templates when possible. Bug reports should include:

- Operating system, Node.js version, and Code-ctx version or commit.
- Exact command, arguments, or Dashboard page.
- Expected and actual behavior.
- Minimal reproduction steps.
- Logs or screenshots with secrets and private paths removed.

For security reports, see [SECURITY.md](SECURITY.md) and do not open a public issue. Maintainers should enable GitHub Private vulnerability reporting and verify that security notifications reach repository administrators.
