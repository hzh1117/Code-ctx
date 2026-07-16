# Contributing to Code-ctx / 参与贡献

## 中文

感谢你帮助改进 Code-ctx。本项目采用 MIT 许可证，提交贡献即表示你确认自己的贡献可以按 [LICENSE](LICENSE) 中的 MIT 许可发布。

### 当前优先级

维护者本地可能保留 `docs/` 规划和审计资料，但该目录默认不上传 Git。公开贡献请以 README、SECURITY、CHANGELOG 和当前代码为准。

P0-P3 技术问题清单已经完成。当前最需要的贡献方向：

- 类型覆盖：按 `TYPE_CHECKING.md` 扩大 `checkJs`，优先处理 Adapter、命令返回对象、Web API 和 Vue。
- 工具链维护：升级 ESLint、Vite、Glob 等依赖，同时保持 Node 20/22 与 Windows/Ubuntu CI 兼容。
- 运行边界：改进 provider 兼容性 smoke、失败诊断、配额可观测性和 Dashboard 公网部署基线。
- 发布工程：自动版本、npm provenance、安装包内容验证和可复现 release notes。
- 文档同步：README、配置示例、AI 使用指令、安全说明和变更记录。

### 开发环境

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx
npm install
cd web && npm install && cd ..
```

常用命令：

```bash
npm run format:check
npm run lint
npm run typecheck
npm test -- --runInBand
npm run coverage
npm run build:web
npm run pack:smoke
npm run check
node bin/cli.js --help
node bin/cli.js dashboard
```

`npm run check` 已包含上述格式、lint、类型、测试、覆盖率、Web 构建和 package smoke 门禁。修改依赖时还必须对根目录和 `web/` 分别运行 `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org`。

真实 Provider smoke 默认不会访问外部服务；普通测试只校验已脱敏的协议快照，并跳过需要凭据的用例。需要手动验证兼容性时，至少提供一组临时环境变量后运行：

```bash
RUN_PROVIDER_SMOKE=1 OPENAI_API_KEY=... npm test -- tests/smoke/provider-smoke.test.js --runInBand
```

PowerShell 可先设置 `$env:RUN_PROVIDER_SMOKE = '1'` 和对应的 `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY`。兼容端点可额外设置相应的 `*_BASE_URL` 与 `*_SMOKE_MODEL`。不要写入仓库、测试快照或日志；计划任务使用 GitHub Actions secrets，并在启用 smoke 但未提供任何 Provider Key 时主动失败。

### 分支与提交

- 从 `master` 创建分支。
- 每个 PR 聚焦一个功能、一个 bug 修复或一类文档变更。
- 推荐提交前缀：`feat:`、`fix:`、`docs:`、`test:`、`refactor:`、`security:`、`perf:`。
- 不要把大规模重构、安全修复、依赖升级和 UI 改造混在同一个 PR。

### PR 检查清单

- 说明问题、影响范围、解决方案和验证结果。
- 行为变更需要新增或更新测试。
- 修改 CLI、Dashboard、配置、环境变量或用户流程时，同步更新 README 或相关文档。
- 修改安全逻辑时，附上负向用例或手动验证命令。
- 不要提交 `.env`、API Key、Token、SSH Key、私有项目文档、生成的 prompt 文件或本地调试脚本。

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

Thanks for helping improve Code-ctx. The project is released under the MIT License. By contributing, you confirm that your contribution may be published under the MIT terms in [LICENSE](LICENSE).

### Current Priorities

Maintainers may keep local planning and audit material under `docs/`, but that directory is ignored by Git by default. Public contributions should use README, SECURITY, CHANGELOG, and the current code as the source of truth.

The P0-P3 technical issue list is complete. The highest-value contribution areas are now:

- Type coverage: expand `checkJs` following `TYPE_CHECKING.md`, starting with adapters, command result objects, Web APIs, and Vue.
- Toolchain maintenance: update ESLint, Vite, Glob, and related dependencies while preserving Node 20/22 and Windows/Ubuntu CI support.
- Runtime boundaries: improve provider compatibility smoke, failure diagnostics, quota observability, and the Dashboard public-deployment baseline.
- Release engineering: automated versions, npm provenance, package-content verification, and reproducible release notes.
- Documentation sync: README, config examples, AI handoff guidance, security notes, and changelog entries.

### Development Setup

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx
npm install
cd web && npm install && cd ..
```

Useful commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test -- --runInBand
npm run coverage
npm run build:web
npm run pack:smoke
npm run check
node bin/cli.js --help
node bin/cli.js dashboard
```

`npm run check` includes the formatting, lint, type, test, coverage, Web build, and package-smoke gates above. Dependency changes must also run `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` in both the repository root and `web/`.

The real provider smoke does not contact external services by default. Normal test runs only validate the redacted protocol snapshot and skip credentialed cases. To opt in manually, provide at least one temporary provider key:

```bash
RUN_PROVIDER_SMOKE=1 OPENAI_API_KEY=... npm test -- tests/smoke/provider-smoke.test.js --runInBand
```

In PowerShell, set `$env:RUN_PROVIDER_SMOKE = '1'` plus either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` first. Compatible endpoints may also set the matching `*_BASE_URL` and `*_SMOKE_MODEL`. Never write these values to the repository, snapshots, or logs. The scheduled workflow reads GitHub Actions secrets and intentionally fails when smoke is enabled without any provider key.

### Branches and Commits

- Create branches from `master`.
- Keep each PR focused on one feature, bug fix, or documentation area.
- Preferred prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `security:`, `perf:`.
- Do not mix broad refactors, security fixes, dependency upgrades, and UI changes in one PR.

### Pull Request Checklist

- Explain the problem, impact, solution, and verification.
- Add or update tests for behavior changes.
- Update README or related docs when changing CLI commands, Dashboard behavior, config, environment variables, or workflows.
- For security changes, include negative tests or manual verification commands.
- Do not commit `.env`, API keys, tokens, SSH keys, private project docs, generated prompt files, or local debug scripts.

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
