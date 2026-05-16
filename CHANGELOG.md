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

#### Known Issues

- Remaining P0/P1 risks include config execution, command construction, Dashboard config writes, and unified error handling. AI `baseUrl` and sensitive AI APIs have baseline protection, but finer token/IP rate-limit policies and distributed deployment support still need follow-up work.
- Test coverage is still uneven: `core/`, `web/middleware/`, `utils/git-utils.js`, and adapters need direct tests.
