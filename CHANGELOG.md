# Changelog / 变更记录

All notable changes to Code-ctx are documented here.

Code-ctx is released under the MIT License. See [LICENSE](LICENSE).

---

## 中文

### [Unreleased]

暂无。

### [1.1.0] - 2026-07-17

#### Added

- 扫描器输出带相对路径、语言、SHA-256、截断信息和脱敏源码的结构化证据；Git 与 hash 更新模式都会向 Prompt 提供有界变更证据，并识别删除文件。
- 新增 `project-manifest.json` 作为文档归属和事实校验的信任锚；doctor 会校验文件 hash、路由和依赖声明，而不只检查格式。
- `init --skip-ai` 现在生成确定性项目文档、`OVERVIEW.md` 和 manifest；新增 generic JS/TS、generic backend 与 unknown adapter，并支持配置覆盖扫描模式。
- AI 客户端新增统一出站隐私网关、结构化脱敏审计、AbortSignal、五分钟总 deadline 和可取消重试等待。
- `init` 已拆分为 discovery、snapshot、planning、generation、validation 和 commit 服务；插件 Registry/状态按项目根目录隔离，扫描与 hash 路径使用带预算的异步 I/O。
- 新增 `code-ctx config setup` 引导式 AI 配置与连接测试、TTY/JSON 双模式 AI 进度报告、真实本地 HTTP AI 全流程测试和可选 nightly provider smoke。
- 新增 Prettier、增量 TypeScript `checkJs`、全局与关键文件覆盖率阈值、真实 npm package smoke，以及 Ubuntu Node 20/22 + Windows smoke CI。

#### Fixed

- init/update 只在目标文档成功写盘后提交扫描基线；AI 失败、缺少 Key、section 写入失败和部分失败不再被报告为成功或消费变化。
- 默认 `update` 始终输出合并 Prompt；`--dry-run` 与 `--apply` 互斥；`--apply` 只刷新有源码证据影响的 section，未知变化进入确认队列。
- 修复根项目漏探测、零项目成功、hash 模式删除遗漏、绝对项目路径、输出 token 与输入预算混用等问题。
- continuation 会结合 provider 截断原因和输出结构校验；one-shot 使用严格机器边界并逐项目校验，不再依赖自由标题拆分。
- 配置未知字段会给出迁移警告，类型错误会阻止运行；旧 `code-ctx.config.js` 只按静态 `module.exports = {...}` 数据解析，不再执行 JavaScript。
- `use` 按场景和 token 预算压缩上下文并报告删除摘要；Web Prompt 生成不再重复构建上下文；项目检测只执行一次有界深度遍历。
- `config setup` 先创建 AI 配置后，`init` 现在会把探测出的项目字段合并并写回 JSON；确定性 `OVERVIEW.md` 的机器 section 标记可被 doctor 正确识别。

#### Security

- OpenAI、Anthropic、continuation 和流式请求的所有出站消息统一脱敏密钥、连接串和绝对路径，包括回传的 assistant 内容。
- CLI 的 init/update/fix/doctor/use/watch 支持 Ctrl+C 取消并清理 socket、timer 和监听器；单次超时、总 deadline 与用户取消使用不同错误码。
- 删除会打印 API Key 前缀、模型完整响应和错误堆栈的本地调试脚本。
- CI 对根 CLI 和 Dashboard 的生产依赖执行官方 npm high/critical 阻断审计；修复 `shell-quote` critical 与 `form-data` high 漏洞。

#### Changed

- 项目许可证从 Code-ctx Non-Commercial Source License 切换回 MIT License，允许个人和商业自由使用、修改和分发。同步更新 README、README_EN、CONTRIBUTING、SUPPORT、CODE_OF_CONDUCT、Issue 模板和 `package.json` 的 license 字段。
- 技术问题清单中的 P0（7/7）、P1（15/15）、P2（17/17）与 P3（10/10）已全部完成；README、安全策略、贡献指南和 CI 已同步当前实现。
- 补全插件信任、非交互 AI 配置、Provider smoke、类型检查范围和 Bug 诊断说明；npm 发布包现在包含 README 已引用的 `TYPE_CHECKING.md` 与 `examples/plugin-basic/`。
- 快速开始拆分为无密钥和完整 AI 两条路径，统一全局安装与 npx 命令，移除平台相关文件检查，并明确 `config setup` 创建的文件和升级步骤。

### [1.0.0] - 2026-05-23

#### Added

- 新增 GitHub 社区文件、Issue 模板、PR 模板、CI 和 Dependabot 配置。
- 新增外部资料校准说明：根据 OSI Open Source Definition、GitHub Private vulnerability reporting 文档和 Express 5 文档补充许可证、安全披露与 Web API 安全要求。

#### Changed

- README 和公开仓库文档更新为更贴近当前实现：CLI、Dashboard、双协议 AI 配置、已知风险、测试命令和后续路线图。
- 明确项目定位：Code-ctx 是 AI 可用上下文生成工具，不是 AI IDE，也不做代码补全或通用 Agent 工作台。
- `docs/` 调整为维护者本地规划和审计资料，默认不上传 Git，也不进入 npm 发布包。
- AI API 对接链路补充基础防护：默认拒绝非 HTTPS、本机、内网和 metadata baseUrl，并检查 DNS 解析后的内网地址；Anthropic system prompt 改为顶层 `system` 字段；Dashboard 保存 API Key 时校验协议、baseUrl、模型名和换行注入；敏感 AI API 加入基础内存限流。
- 项目许可从 MIT 调整为 Code-ctx Non-Commercial Source License，允许非商业使用、学习、修改和分发，禁止商业使用。
- 安全策略补充当前审计发现的高风险区域，包括本地配置执行、Dashboard API、AI 凭据和生成文档泄漏风险。
- SUPPORT 和 GitHub issue/PR 模板同步非商业使用、安全披露和提交检查提醒。
- **默认 AI 模型按官方废弃文档校准**：OpenAI 默认从 `gpt-4` 改为 `gpt-5.5`（`gpt-4` 于 2026-10-23 退役）；Anthropic 默认从 `claude-3-5-sonnet-20241022` 改为 `claude-sonnet-4-6`（前者已于 2025-10-28 退役，调用会失败）。已显式覆盖 `OPENAI_MODEL` / `ANTHROPIC_MODEL` 或在 `code-ctx.config.js` 中指定 `model` 的用户不受影响；仍使用旧默认值的项目应检查 `code-ctx.config.js` 中的 `ai.openai.model` 和 `ai.anthropic.model`。
- **P25 JSON 配置 MVP**：新增 `code-ctx.config.json` 支持，作为可校验、不可执行的配置文件（推荐格式）。加载优先级 `JSON > JS`，两者同时存在时使用 JSON 并 warning。`code-ctx init` 默认生成 JSON，可用 `--config-format=js` 显式选择 JS。`code-ctx.config.js` 保留只读兼容（仍在 VM 沙箱内加载）。Dashboard `PUT /api/config` 与 `saveAIConfig` 写回当前生效格式。新增 `validateProjectConfig` 内置轻量 schema 校验，覆盖顶层字段类型、`projects[]` 结构和 `aiMode` 枚举，不依赖 ajv。
- **P26 插件系统 MVP**：新增 `src/plugins/loader.js` 与 `src/plugins/state.js`。`code-ctx.config(.json|.js)` 可通过 `plugins: [...]` 挂载本地路径或 npm 包；每个插件可贡献 `adapters`（继承 `BaseAdapter`）、`scenarios`（按 `id` 覆盖内置）、`sensitivePatterns`、`sensitiveDetectionPatterns`。加载失败只 warn，内置能力不受影响。`filterSensitive`、`scanDirectory`、`getScenarios` 自动合并插件贡献。`init` / `use` / `update` / `doctor` / `fix` 与 web server 入口处都会调用 `initPlugins`，按 rootDir + 配置 mtime 幂等。新增最小示例 `examples/plugin-basic/`。
- **P27 文档质量评分**：新增 `src/utils/doc-quality.js`，按完整度（核心 section 是否齐全）、新鲜度（与项目文件 mtime 比对）、风险（敏感信息、过短、缺失）三个维度评分，整体输出 `OK / WARN / HIGH_RISK` 与 0-100 综合分。`code-ctx doctor` CLI 末尾输出评分摘要并标注需要关注的文档；Dashboard `/api/status` 返回 `docQuality` 字段，Status 页顶部展示评分徽章和问题清单。评分纯规则，不依赖 AI。
- **P28 Dashboard 安全状态页和 doctor 详情**：新增 `/api/doctor` 端点，复用 P14 的 doctor 缓存，返回 doctor issues/warnings、docQuality、敏感信息扫描、配置 schema 错误、已加载插件与加载错误。新增 Web 页面 `安全与健康`（路由 `/security`），可视化展示整体 OK/WARN/HIGH_RISK 徽章、各分类详情和文档质量明细表，仅显示敏感字段名与文件名不暴露原文；支持手动刷新。Sidebar 新增入口。
- **P29 生成历史、prompt diff、任务历史轮转**：扩展 `src/utils/task-history.js`。每条记录加 `id` / `timestamp`，prompt 不落盘——只持久化 `promptHash` / `promptLength` 与经 `filterSensitive` 处理的 `promptPreview`；字段经白名单 sanitize，避免未知字段污染。新增 `MAX_ENTRIES=200` 与 `MAX_FILE_BYTES=256KB` 双轮转，写入后自动 trim 最早记录。`useCommand` 与 `updateCommand` 自动写入历史；Dashboard 时间轴展示场景与 preview。新增 API `GET /api/history` 与 `GET /api/history/diff`（按两个任务 ID 输出 scenario/hash/长度差异）。新增工具 `diffPrompts` 做简单文本 diff 摘要，不引入复杂依赖。
- **P30 AI 客户端增强 MVP（provider preset + token budget）**：新增 `src/ai/presets.js`（OpenAI/Anthropic/DeepSeek/Kimi/MiniMax 五个默认值），新增 `GET /api/ai/presets` 端点。Dashboard `AI 配置` 页加入「服务商模板」一键填充 baseUrl/model/maxTokens，不保存 Key。新增 `src/utils/token-estimator.js`，并迁移 file-scanner 内的旧实现复用同一函数。`useCommand` 返回 `tokenBudget`（estimate / maxTokens / status: ok|warn|over）；CLI `code-ctx use` 与 Dashboard `/generate-prompt` 输出 token 估算与超限警告。不引入流式与取消，留待后续 MVP。
- **P21–P27 发布前清理**：（1）`README.md` / `README_EN.md` Node 版本要求从 `>= 16.0.0` 同步到 `>= 20.0.0`，与 `engines.node` 对齐；（2）`.env.example` 新增 `CODE_CTX_PLUGINS_ALLOW(_ALL)` 说明段；（3）`docs/` 下 9 份历史审计报告统一加 2026-05-15 历史时间戳头部，避免新人误读；（4）ESLint 清零：`src/adapters/base.js` 抽象参数加 `_` 前缀，`src/commands/doctor.js` / `hook.js` 删未用 import，`src/core/section.js` 删未用常量，`src/generator/prompt-builder.js` 删未用 `labels`；（5）`qs` 间接依赖 moderate DoS 漏洞修复至 6.15.2；（6）`src/web/middleware/security.js` `tokenAuth` 改用 `crypto.timingSafeEqual` + 长度预检，规避时序旁路；（7）新增 `tests/commands/doctor-fix.test.js`（9 用例），`src/commands/doctor.js` 行覆盖 64% → 80.06%，整体覆盖率 86.78%。

#### Known Issues

- 技术问题清单 P0-P3 已全部完成。后续工作转为扩大 `checkJs` 范围、持续依赖升级、provider 兼容性观察和发布自动化。
- Dashboard 仍仅面向本机；当前内存级限流不适用于多进程或分布式公网部署。

---

## English

### [Unreleased]

No changes yet.

### [1.1.0] - 2026-07-17

#### Added

- Scanner output now carries structured source evidence with relative paths, language, SHA-256, truncation metadata, and redacted content. Git and hash update modes include bounded change evidence and detect deleted files.
- Added `project-manifest.json` as the trust anchor for document ownership and fact verification. Doctor checks file hashes, routes, and dependency claims instead of format alone.
- `init --skip-ai` now generates deterministic project docs, `OVERVIEW.md`, and a manifest. Generic JS/TS, generic backend, and unknown adapters were added with configurable scan-pattern overrides.
- The AI client now provides one outbound privacy gateway, structured redaction audits, AbortSignal support, a five-minute operation deadline, and cancellable retry waits.
- `init` is split into discovery, snapshot, planning, generation, validation, and commit services. Plugin registries/state are isolated by project root, and scanner/hash paths use budgeted asynchronous I/O.
- Added guided `code-ctx config setup`, TTY/JSON AI progress events, a real local-HTTP AI flow test, and opt-in nightly provider smoke coverage.
- Added Prettier, incremental TypeScript `checkJs`, global and critical-file coverage thresholds, real npm package smoke, and Ubuntu Node 20/22 plus Windows smoke CI.

#### Fixed

- Init/update commit scan baselines only after target documents are written successfully. AI failures, missing keys, section-write failures, and partial failures no longer report success or consume changes.
- Default `update` always emits a merged prompt; `--dry-run` conflicts with `--apply`; apply mode refreshes only source-evidenced sections and sends unknown changes to confirmation.
- Fixed missed root projects, zero-project success, deleted files in hash mode, absolute persisted project paths, and mixed input/output token budgeting.
- Continuation uses provider truncation reasons plus output-structure validation. One-shot output uses strict machine boundaries with per-project validation instead of free-form headings.
- Unknown config fields produce migration warnings while invalid types block execution. Legacy `code-ctx.config.js` is parsed only as static `module.exports = {...}` data and is never executed.
- `use` compresses context by scenario and token budget with a removal summary; Web prompt generation reuses one context build; project detection performs one bounded traversal.
- After `config setup` creates AI settings, `init` now merges and persists detected project fields to JSON. Doctor also recognizes machine section markers in deterministic `OVERVIEW.md` files.

#### Security

- Every outbound OpenAI, Anthropic, continuation, and streaming message now redacts secrets, connection strings, and absolute paths, including assistant content sent back for continuation.
- CLI init/update/fix/doctor/use/watch commands support Ctrl+C cancellation and clean up sockets, timers, and listeners. Request timeout, operation deadline, and user cancellation have distinct error codes.
- Removed the local debug script that printed API-key prefixes, complete model responses, and error stacks.
- CI blocks on official npm high/critical production-dependency audits for both the CLI and Dashboard; the `shell-quote` critical and `form-data` high findings were fixed.

#### Changed

- Switched the project license from the Code-ctx Non-Commercial Source License back to the MIT License. The project is now free for personal and commercial use, modification, and redistribution. README, README_EN, CONTRIBUTING, SUPPORT, CODE_OF_CONDUCT, the issue template, and the `package.json` license field were updated accordingly.
- All technical P0 (7/7), P1 (15/15), P2 (17/17), and P3 (10/10) items are complete. README, security guidance, contribution guidance, and CI now reflect the current implementation.
- Expanded guidance for plugin trust, non-interactive AI setup, provider smoke tests, the enforced type-checking set, and redacted bug diagnostics. The npm package now includes the README-linked `TYPE_CHECKING.md` and `examples/plugin-basic/` files.
- Split Quick Start into no-key and full-AI paths, made global and npx commands consistent, removed platform-specific file checks, and documented setup-created files and upgrade steps.

### [1.0.0] - 2026-05-23

#### Added

- Added GitHub community files, issue templates, pull request template, CI, and Dependabot configuration.
- Added external-reference alignment notes based on the OSI Open Source Definition, GitHub private vulnerability reporting docs, and Express 5 docs.

#### Changed

- Updated README and public repository documents to reflect the current CLI, dashboard, dual-protocol AI configuration, known risks, test commands, and roadmap.
- Clarified positioning: Code-ctx generates AI-usable context; it is not an AI IDE and does not provide code completion or a general agent workspace.
- Changed `docs/` to maintainer-local planning and audit material that is ignored by Git by default and excluded from the npm package.
- Hardened the AI API integration path: non-HTTPS, local, private-network, and metadata `baseUrl` values are rejected by default, DNS-resolved private addresses are checked, Anthropic system prompts are sent through the top-level `system` field, Dashboard API-key saving validates protocol, `baseUrl`, model name, and newline injection, and sensitive AI APIs have baseline in-memory rate limits.
- Changed the project license from MIT to the Code-ctx Non-Commercial Source License. Non-commercial use, study, modification, and distribution are allowed; commercial use is prohibited.
- Expanded the security policy with current audit focus areas: local config execution, Dashboard APIs, AI credentials, and generated documentation leakage.
- Synchronized SUPPORT and GitHub issue/PR templates with non-commercial-use, security-reporting, and submission-check guidance.
- **Default AI models aligned with official deprecation docs.** OpenAI default changed from `gpt-4` to `gpt-5.5` (`gpt-4` retires on 2026-10-23). Anthropic default changed from `claude-3-5-sonnet-20241022` to `claude-sonnet-4-6` (the former was retired on 2025-10-28 and now fails). Users who explicitly set `OPENAI_MODEL` / `ANTHROPIC_MODEL` or specify `model` in `code-ctx.config.js` are unaffected; projects still relying on the old defaults should review `ai.openai.model` and `ai.anthropic.model` in `code-ctx.config.js`.
- **Release-readiness cleanup (P21–P27).** (1) README Node requirement aligned with `engines.node >= 20.0.0`; (2) `.env.example` documents `CODE_CTX_PLUGINS_ALLOW(_ALL)`; (3) historical audit reports under `docs/` carry a 2026-05-15 snapshot header to prevent misreads; (4) ESLint warnings cleared in `adapters/base.js`, `commands/doctor.js`, `commands/hook.js`, `core/section.js`, `generator/prompt-builder.js`; (5) `qs` moderate DoS advisory fixed via dependency bump to 6.15.2; (6) `web/middleware/security.js` `tokenAuth` switched to `crypto.timingSafeEqual` with a length precheck to avoid timing side-channels; (7) New `tests/commands/doctor-fix.test.js` (9 cases) lifts `src/commands/doctor.js` line coverage from 64% to 80%; overall coverage 86.78%.

#### Known Issues

- The P0-P3 technical issue list is complete. Follow-up work focuses on expanding `checkJs`, routine dependency upgrades, provider compatibility monitoring, and release automation.
- The Dashboard remains local-only; current in-memory rate limiting is not sufficient for multi-process or distributed public deployment.
