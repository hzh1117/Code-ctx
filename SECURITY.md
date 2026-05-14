# Security Policy / 安全策略

## 中文

### 支持版本

Code-ctx 正在积极开发中。安全修复会应用到 `master` 分支的最新版本。

### 报告漏洞

请不要用公开 issue 报告敏感安全问题。

优先使用 GitHub 的私有漏洞报告功能；如果不可用，请通过 GitHub 联系仓库所有者。报告时请包含：

- 受影响版本或 commit。
- 复现步骤。
- 影响范围和可能的数据暴露。
- 相关日志，且必须移除密钥。

### 密钥处理

Code-ctx 内置敏感信息过滤器，但用户仍需要自行保护凭据。

- 不要提交 `.env`、API Key、Token、SSH Key、数据库 URL 或私有 prompt 输出。
- 如果 `ai-docs/` 是从私有代码生成的，公开前请先审查内容。
- 用 `.env.example` 说明配置结构，不要放真实密钥。

### 安全报告范围

包括但不限于：

- 生成文档或 prompt 输出中的密钥泄漏。
- Dashboard API 暴露到 localhost 或 token 校验之外。
- 文件读取路由中的路径穿越。
- AI 服务商凭据的不安全处理。

---

## English

### Supported Versions

Code-ctx is in active development. Security fixes are applied to the latest version on `master`.

### Reporting a Vulnerability

Please do not open a public issue for sensitive security reports.

Use GitHub's private vulnerability reporting feature when available, or contact the repository owner through GitHub. Include:

- Affected version or commit.
- Reproduction steps.
- Impact and possible data exposure.
- Any relevant logs, with secrets removed.

### Secret Handling

Code-ctx includes a sensitive information filter, but users are still responsible for protecting credentials.

- Do not commit `.env`, API keys, tokens, SSH keys, database URLs, or private prompt output.
- Review generated `ai-docs/` before publishing if they were generated from private code.
- Use `.env.example` for documenting configuration shape without secrets.

### Scope

Relevant reports include:

- Secret leakage in generated docs or prompt output.
- Dashboard API exposure beyond localhost or token checks.
- Path traversal in file-reading routes.
- Unsafe handling of AI provider credentials.
