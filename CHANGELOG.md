# Changelog / 变更记录

All notable changes to Code-ctx are documented here.

Code-ctx is source-available for non-commercial use. See [LICENSE](LICENSE).

---

## 中文

### [Unreleased]

#### Added

- 新增项目分析资料和 AI 分阶段实施指令，覆盖安全、性能、测试、依赖、架构重构和源码公开发布准备。
- 新增后续 AI 执行提示词手册，将安全、测试、性能、架构、发布和产品能力拆成可逐个复制执行的任务包。
- 新增 GitHub 社区文件、Issue 模板、PR 模板、CI 和 Dependabot 配置。
- 新增外部资料校准说明：根据 OSI Open Source Definition、GitHub Private vulnerability reporting 文档和 Express 5 文档补充许可证、安全披露与 Web API 安全要求。

#### Changed

- README 和公开仓库文档更新为更贴近当前实现：CLI、Dashboard、双协议 AI 配置、已知风险、测试命令和后续路线图。
- `docs/` 文件统一调整为中英文组合命名，并同步 README、package 发布清单和仓库内文档引用。
- AI API 对接链路补充基础防护：默认拒绝非 HTTPS、本机、内网和 metadata baseUrl，并检查 DNS 解析后的内网地址；Anthropic system prompt 改为顶层 `system` 字段；Dashboard 保存 API Key 时校验协议、baseUrl、模型名和换行注入；敏感 AI API 加入基础内存限流。
- 项目许可从 MIT 调整为 Code-ctx Non-Commercial Source License，允许非商业使用、学习、修改和分发，禁止商业使用。
- 安全策略补充当前审计发现的高风险区域，包括本地配置执行、Dashboard API、AI 凭据和生成文档泄漏风险。
- README 的 `docs/` 链接调整为以发布包内包含的 AI 指令和路线图为入口，避免 npm 包内出现断链。
- SUPPORT 和 GitHub issue/PR 模板同步非商业使用、安全披露和提交检查提醒。

#### Known Issues

- 当前 `docs/` 审计报告指出仍存在 P0 安全风险：配置文件执行、命令拼接、Dashboard 配置写入和统一错误处理；AI baseUrl 和敏感 AI API 已有基础防护，但仍需更细的 token/IP 限流策略和分布式部署方案。
- 当前测试覆盖仍不均衡：`core/`、`web/middleware/`、`utils/git-utils.js` 和适配器缺少直接测试。

---

## English

### [Unreleased]

#### Added

- Added project analysis materials and phased AI implementation instructions covering security, performance, testing, dependency, architecture, and source-available publication work.
- Added the AI execution playbook with copy-ready task prompts for security, testing, performance, architecture, release engineering, and product work.
- Added GitHub community files, issue templates, pull request template, CI, and Dependabot configuration.
- Added external-reference alignment notes based on the OSI Open Source Definition, GitHub private vulnerability reporting docs, and Express 5 docs.

#### Changed

- Updated README and public repository documents to reflect the current CLI, dashboard, dual-protocol AI configuration, known risks, test commands, and roadmap.
- Renamed `docs/` files to bilingual Chinese-English filenames and synchronized README links, package publishing entries, and repository documentation references.
- Hardened the AI API integration path: non-HTTPS, local, private-network, and metadata `baseUrl` values are rejected by default, DNS-resolved private addresses are checked, Anthropic system prompts are sent through the top-level `system` field, Dashboard API-key saving validates protocol, `baseUrl`, model name, and newline injection, and sensitive AI APIs have baseline in-memory rate limits.
- Changed the project license from MIT to the Code-ctx Non-Commercial Source License. Non-commercial use, study, modification, and distribution are allowed; commercial use is prohibited.
- Expanded the security policy with current audit focus areas: local config execution, Dashboard APIs, AI credentials, and generated documentation leakage.
- Adjusted README `docs/` links to point at package-included AI instructions and roadmap entries, avoiding broken links in npm package consumers.
- Synchronized SUPPORT and GitHub issue/PR templates with non-commercial-use, security-reporting, and submission-check guidance.

#### Known Issues

- The current `docs/` audit reports remaining P0 security risks around config execution, command construction, Dashboard config writes, and unified error handling. AI `baseUrl` and sensitive AI APIs have baseline protection, but finer token/IP rate-limit policies and distributed deployment support still need follow-up work.
- Test coverage is still uneven: `core/`, `web/middleware/`, `utils/git-utils.js`, and adapters need direct tests.
