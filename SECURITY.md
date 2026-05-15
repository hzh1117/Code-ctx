# Security Policy / 安全策略

## 中文

### 支持版本

Code-ctx 正在积极开发中。安全修复会应用到 `master` 分支的最新版本，发布前请以最新 commit 为准。

### 当前安全状态

完整维护仓库中的 `docs/安全审计报告-security-audit-report.md` 和 `docs/问题跟踪清单-issue-tracker.md` 已记录当前审计结论。公开部署或商业授权评估前，请优先处理 P0/P1 安全项。

当前重点风险包括：

- `code-ctx.config.js` 解析和执行链路。
- Dashboard 的 `/api/config`、`/api/ai/*`、`/api/docs/*` 等本地接口。
- 命令行路径、Git 参数和 shell 命令构造。
- AI `baseUrl` 可配置导致的 SSRF 风险；当前已阻断本机、内网和 metadata 字面地址及 DNS 解析后的内网地址，并对敏感 AI API 加入基础内存限流。后续仍需更细的 token/IP 策略和分布式限流方案。
- `.env`、API Key、生成文档和 prompt 中的敏感信息泄漏。
- 错误信息直接暴露内部路径或运行细节。

### 报告漏洞

请不要用公开 issue 报告敏感安全问题。优先使用 GitHub 私有漏洞报告；如果不可用，请通过仓库所有者主页联系维护者。

维护者应在 GitHub 仓库 `Settings -> Advanced Security` 中开启 [Private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository)。启用后，研究者可以通过仓库安全页面的私有流程提交报告，避免在 issue 中公开漏洞细节。

报告时请包含：

- 受影响版本或 commit。
- 复现步骤和最小复现项目。
- 影响范围、可利用条件和可能的数据暴露。
- 相关日志、请求体或响应体，但必须移除密钥、Token 和私有路径。

### 密钥和私有文档处理

Code-ctx 内置敏感信息过滤器，但它不能替代人工审查。

- 不要提交 `.env`、API Key、Token、SSH Key、数据库 URL 或私有 prompt 输出。
- 如果 `ai-docs/` 来自私有代码，公开前必须逐页审查。
- 使用 `.env.example` 描述配置结构，不要放真实密钥。
- 如果密钥曾出现在本地文件、日志、截图、issue 或 PR 中，视为已泄露并立即轮换。
- Dashboard 默认用于本机开发，不应直接暴露到公网。

### Web API 安全基线

Dashboard API 基于 Express 5。实现或修改接口时请遵守：

- `req.body`、query、params 都是用户控制输入，使用前必须校验类型、长度和允许字段。
- `express.json()` 应设置合理 `limit`，敏感写入接口可进一步收紧请求体大小。
- 错误处理中间件应使用 `(err, req, res, next)` 四参数签名；客户端返回通用错误，内部路径、堆栈和 provider 响应只写入受控日志。
- 静态文件只从固定构建目录提供，不允许请求参数影响静态目录 root。

### 范围

相关安全报告包括但不限于：

- 配置文件执行、命令注入、路径穿越或任意文件读写。
- Dashboard API 权限绕过、非 localhost 暴露或 token 校验问题。
- AI 服务商凭据的不安全保存、传输、日志输出或回显。
- 生成文档、prompt、调试日志中的敏感信息泄漏。
- SSRF、请求泛洪、资源耗尽或 API 配额滥用。

---

## English

### Supported Versions

Code-ctx is in active development. Security fixes are applied to the latest version on `master`; use the latest commit before publishing or evaluating the project.

### Current Security Status

In the full maintenance repository, `docs/安全审计报告-security-audit-report.md` and `docs/问题跟踪清单-issue-tracker.md` record the current audit findings. Resolve P0/P1 security items before public deployment or commercial license evaluation.

Current high-risk areas include:

- The `code-ctx.config.js` parsing and execution path.
- Local Dashboard endpoints such as `/api/config`, `/api/ai/*`, and `/api/docs/*`.
- CLI paths, Git arguments, and shell command construction.
- SSRF risk from configurable AI `baseUrl` values. Literal and DNS-resolved localhost, private-network, and metadata addresses are blocked now, and sensitive AI APIs have baseline in-memory rate limits. Finer token/IP policies and distributed rate limiting still need follow-up work.
- Secret leakage through `.env`, API keys, generated docs, and prompts.
- Error responses exposing internal paths or runtime details.

### Reporting a Vulnerability

Do not open public issues for sensitive security reports. Use GitHub private vulnerability reporting when available, or contact the maintainer through the repository owner profile.

Maintainers should enable [Private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository) under GitHub repository `Settings -> Advanced Security`. Once enabled, researchers can submit reports through the repository security workflow without exposing details in public issues.

Include:

- Affected version or commit.
- Reproduction steps and a minimal reproduction project.
- Impact, exploit conditions, and possible data exposure.
- Relevant logs, request bodies, or responses with secrets, tokens, and private paths removed.

### Secret and Private Documentation Handling

Code-ctx includes a sensitive information filter, but it is not a replacement for manual review.

- Do not commit `.env`, API keys, tokens, SSH keys, database URLs, or private prompt output.
- Review generated `ai-docs/` page by page before publishing if they came from private code.
- Use `.env.example` for configuration shape, never real credentials.
- If a secret appears in a local file, log, screenshot, issue, or pull request, treat it as compromised and rotate it immediately.
- The Dashboard is intended for local development and should not be exposed directly to the public internet.

### Web API Security Baseline

The Dashboard API uses Express 5. When implementing or changing endpoints:

- Treat `req.body`, query, and params as user-controlled input; validate types, lengths, and allowed fields before use.
- Set a reasonable `limit` for `express.json()`, with tighter limits for sensitive write endpoints when possible.
- Use four-argument error middleware `(err, req, res, next)`; return generic client errors and keep internal paths, stacks, and provider responses in controlled logs only.
- Serve static files only from a fixed build directory; request parameters must not affect the static root.

### Scope

Relevant reports include, but are not limited to:

- Config execution, command injection, path traversal, or arbitrary file read/write.
- Dashboard API authorization bypass, non-localhost exposure, or token validation issues.
- Unsafe storage, transmission, logging, or echoing of AI provider credentials.
- Secret leakage in generated docs, prompts, or debug logs.
- SSRF, request flooding, resource exhaustion, or API quota abuse.
