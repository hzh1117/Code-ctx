# Support / 支持

## 中文

如果你在使用 Code-ctx 时需要帮助：

1. 先查看 `README.md` 或 `README_EN.md`。
2. 搜索已有 GitHub issues。
3. 使用对应模板提交新的 issue。

Code-ctx 采用 MIT 许可证开源，允许个人和商业自由使用。社区支持由维护者尽力提供，不保证响应时间或解决问题。

提问时请包含：

- 操作系统。
- Node.js 和 npm 版本。
- Code-ctx 版本或 commit hash。
- 你运行的命令或使用的 Dashboard 页面。
- 错误输出或截图。
- 如从源码运行，说明 `npm run check` 是否通过；依赖问题请附根目录或 `web/` 的脱敏 `npm audit --omit=dev` 摘要。

请不要包含 API Key、Token、密码、私有仓库代码，或包含机密信息的生成文档。

如果 AI 请求长时间无响应，可按 Ctrl+C 安全取消。日志中的 `AI_REQUEST_TIMEOUT` 表示单次请求超时，`AI_OPERATION_DEADLINE` 表示整个生成操作超过五分钟上限，`AI_REQUEST_ABORTED` 表示用户取消。提交问题时只提供错误码和脱敏后的上下文，不要粘贴原始 Prompt、provider 响应或本机绝对路径。

敏感安全问题请不要公开提交 issue。优先使用 GitHub Private vulnerability reporting；如果不可用，请按 `SECURITY.md` 联系维护者。

---

## English

For help using Code-ctx:

1. Check `README.md` or `README_EN.md`.
2. Search existing GitHub issues.
3. Open a new issue with the relevant template.

Code-ctx is released under the MIT License and is free for personal and commercial use. Community support is provided on a best-effort basis with no response-time or resolution guarantees.

When asking for help, include:

- Operating system.
- Node.js and npm versions.
- Code-ctx version or commit hash.
- The command you ran or dashboard page you used.
- Error output or screenshots.
- For source checkouts, whether `npm run check` passes. For dependency issues, include the redacted root or `web/` `npm audit --omit=dev` summary.

Do not include API keys, tokens, passwords, private repository code, or generated docs that contain confidential information.

If an AI request appears stuck, Ctrl+C cancels it safely. `AI_REQUEST_TIMEOUT` means one request timed out, `AI_OPERATION_DEADLINE` means the complete generation operation exceeded its five-minute limit, and `AI_REQUEST_ABORTED` means the user cancelled it. Include only the error code and redacted context in support reports; do not paste raw prompts, provider responses, or local absolute paths.

Do not open public issues for sensitive security reports. Prefer GitHub Private vulnerability reporting when available, or follow `SECURITY.md`.
