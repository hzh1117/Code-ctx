# Changelog / 变更记录

All notable changes to Code-ctx are documented here.

Code-ctx is source-available for non-commercial use. See [LICENSE](LICENSE).

---

## 中文

### [Unreleased]

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

#### Known Issues

- 当前仍存在 P0/P1 风险：配置文件执行、命令拼接、Dashboard 配置写入和统一错误处理；AI baseUrl 和敏感 AI API 已有基础防护，但仍需更细的 token/IP 限流策略和分布式部署方案。
- 当前测试覆盖仍不均衡：`core/`、`web/middleware/`、`utils/git-utils.js` 和适配器缺少直接测试。

---

## English

### [Unreleased]

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

#### Known Issues

- Remaining P0/P1 risks include config execution, command construction, Dashboard config writes, and unified error handling. AI `baseUrl` and sensitive AI APIs have baseline protection, but finer token/IP rate-limit policies and distributed deployment support still need follow-up work.
- Test coverage is still uneven: `core/`, `web/middleware/`, `utils/git-utils.js`, and adapters need direct tests.
