<div align="center">

# Code-ctx

**AI development context tool for helping AI coding assistants understand your codebase quickly**

[![npm version](https://img.shields.io/npm/v/code-ctx.svg)](https://www.npmjs.com/package/code-ctx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![CI](https://github.com/hzh1117/Code-ctx/actions/workflows/ci.yml/badge.svg)](https://github.com/hzh1117/Code-ctx/actions/workflows/ci.yml)

English | [中文](README.md)

</div>

---

> **Project status:** v1.0.0 has shipped. The CLI, local Dashboard, plugin system, JSON config, document quality scoring, task history, and token budgeting are all in place. For production deployment, please review "Known Risks" below and harden as needed.

> **License:** Released under the [MIT License](LICENSE). Free for personal and commercial use, modification, and redistribution.

## What Is Code-ctx?

Code-ctx is a CLI tool for AI-assisted development. It scans a project, generates reusable context documentation under `ai-docs/`, and assembles task-specific prompts for Claude, ChatGPT, Cursor, Claude Code, Open Code, and similar AI coding tools.

The problem is simple: every new AI session often starts with repeated explanations of project structure, tech stack, module responsibilities, API contracts, and business context. Code-ctx turns that repeated explanation into updateable, reusable context.

Code-ctx is not an AI IDE. It does not provide code completion, editor-native inline generation, or a general agent workspace. Its boundary is generating, maintaining, and reusing AI-readable codebase context for whichever AI tool you choose.

## Core Features

| Feature | Current Implementation |
|---------|------------------------|
| Project detection | Built-in adapters for Vue 2/3, React, Next.js, uni-app, Java, Node.js, Go, Python, and more |
| Documentation generation | `code-ctx init` scans projects and writes `ai-docs/` |
| Prompt generation | `code-ctx use "task"` matches scenarios and builds context-aware prompts; 8 built-in scenarios (A–H) |
| Incremental updates | `code-ctx update` detects changes using Git diff or hash fallback |
| Health checks | `code-ctx doctor` checks documentation completeness and consistency; supports `--fix` |
| Document quality scoring | Completeness, freshness, and risk scoring with an overall `OK / WARN / HIGH_RISK` verdict and 0–100 score |
| Local Dashboard | Vue 3 + Express dashboard for config, AI generation, project status, doc quality, security & health, and task history |
| AI protocols | OpenAI-compatible and Anthropic-compatible protocols; built-in presets for OpenAI, Anthropic, DeepSeek, Kimi, MiniMax |
| Token budgeting | `code-ctx use` and the Dashboard report prompt token estimates and over-budget warnings |
| Task history | `use` / `update` automatically append history entries; raw prompts are never written to disk — only hash, length, and a sanitized preview are kept, with automatic rotation |
| Config format | Recommended `code-ctx.config.json` (schema-validated, non-executable); read-only compatibility with `code-ctx.config.js` |
| Plugin system | Mount local paths or npm packages via `plugins: [...]`; contribute adapters, scenarios, and sensitive-pattern rules |
| Sensitive filtering | Basic filtering for passwords, API keys, JWTs, SSH keys, database URLs, and related secrets |

## Quick Start

### Requirements

- **Node.js >= 20.0.0** (this project uses commander 14, express 5, and other modern dependencies — Node 20+ is required)
- Git

### Install

```bash
npm install -g code-ctx
# Or run without a global install
npx code-ctx --version
```

See [CONTRIBUTING.md](CONTRIBUTING.md) when developing from source; those steps are not required for normal installation.

### Initialize Your Project

```bash
cd /path/to/your-project
code-ctx init
code-ctx use "Add user login feature"
```

By default, the generated prompt is copied to your clipboard. You can also write it to a file or stdout:

```bash
code-ctx use "Fix login page white screen" --out .ai-prompt.md
code-ctx use "Add order export" --stdout
```

## Commands

| Command | Description |
|---------|-------------|
| `code-ctx init` | Scan the project and generate `ai-docs/` |
| `code-ctx use [task]` | Generate a development prompt |
| `code-ctx update` | Detect file changes and generate an incremental update prompt |
| `code-ctx fix <alias>` | Regenerate documentation for one sub-project |
| `code-ctx status` | Show `ai-docs/` document update times |
| `code-ctx doctor` | Check documentation health; supports `--fix` |
| `code-ctx watch` | Watch file changes and trigger incremental updates |
| `code-ctx hook` | Manage the Git post-commit hook |
| `code-ctx dashboard` | Start the local Web Dashboard |

Common options:

```bash
code-ctx init --skip-ai
code-ctx init --force
code-ctx init -p web
code-ctx init -p api -d database

code-ctx use -s F "Fix AI generation failure"
code-ctx use --no-ai-match "Add config page"
code-ctx use -l en "Add dashboard status cache"

code-ctx update --dry-run
code-ctx update --apply

code-ctx doctor --strict
code-ctx doctor --fix
code-ctx doctor --fix --force

code-ctx dashboard -p 8080
code-ctx dashboard --dir D:/workspace/your-project
code-ctx dashboard --dev
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and keep real credentials local:

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Optional
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.5
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-6
DASHBOARD_TOKEN=
AI_TIMEOUT=180000
```

Never commit `.env`. If a secret appears in logs, screenshots, issues, or pull requests, treat it as compromised and rotate it immediately.

AI `baseUrl` values accept public HTTPS endpoints by default and reject localhost, private-network, link-local, and metadata addresses. If local model gateways are needed, add an explicit local-development option with tests instead of loosening Dashboard validation.

### `code-ctx.config.json`

`init` writes `code-ctx.config.json` by default (recommended). JSON cannot execute arbitrary code and is validated by a built-in lightweight schema:

```json
{
  "projectName": "my-app",
  "outputDir": "./ai-docs",
  "aiMode": "clipboard",
  "projects": [
    { "alias": "web", "path": "./web", "type": "vue3-admin", "label": "Frontend" },
    { "alias": "api", "path": "./api", "type": "java-backend", "label": "Backend" }
  ],
  "excludeDirs": ["node_modules", ".git", "dist"],
  "gitTrack": true,
  "ai": {
    "protocol": "openai",
    "openai": {
      "baseUrl": "https://api.deepseek.com",
      "model": "deepseek-chat",
      "maxTokens": 4096
    },
    "anthropic": {
      "baseUrl": "https://api.anthropic.com",
      "model": "claude-sonnet-4-6",
      "maxTokens": 4096
    }
  }
}
```

Config-loading priority: `code-ctx.config.json` > `code-ctx.config.js`. When both exist the JSON file wins and the JS file is ignored (with a one-shot warning).

> **Migrating from JS to JSON**: copy the object literal from `module.exports = {...}` into a new `code-ctx.config.json`, quote keys properly, and remove the `.js` file. Dashboard writes and `saveAIConfig` follow the currently active format (JSON preferred).

The legacy `code-ctx.config.js` continues to load read-only. Use `code-ctx init --config-format=js` if you specifically want the legacy JS format for a new project. JS configs are evaluated inside a VM sandbox and cannot `require()` or touch `process`.

### Plugin system (MVP)

Mount user extensions by listing them in the config's `plugins` array:

```json
{
  "plugins": [
    "./my-plugin.js",
    "code-ctx-plugin-foo"
  ]
}
```

A plugin can contribute:

- `adapters`: custom project-type adapters (extending `BaseAdapter`)
- `scenarios`: scenarios to add or override (override by matching `id`)
- `sensitivePatterns` / `sensitiveDetectionPatterns`: organization-internal redaction and detection rules

See [`examples/plugin-basic/`](examples/plugin-basic/) for a minimal example. Plugin loading failures only emit a warning and never break builtin functionality.

## Web Dashboard

```bash
code-ctx dashboard
```

The default URL is `http://localhost:3456`. The Dashboard reads the managed project's `code-ctx.config.js` and `ai-docs/`. Start it inside the project directory or pass `--dir`.

Current Dashboard pages include:

- Configuration management
- AI configuration and connection testing (with one-click provider presets)
- Scenario selection and prompt generation (with token-budget hints)
- Sub-project status and document quality scores
- Scenario template preview
- Security & Health (aggregates doctor output, doc quality, sensitive scan, config schema errors, and plugin status)
- Task history (with prompt diff; raw prompts are never persisted)

The Dashboard is intended for local development and should not be exposed directly to the public internet.

The AI configuration API validates protocol, `baseUrl`, model name, `maxTokens`, and basic API-key format. Key saving rejects newline injection and writes `.env` with `0o600` where the local platform supports it.

The Dashboard API uses Express 5. Treat `req.body` as untrusted input, validate shape, length, and allowed fields explicitly, set a reasonable `limit` on `express.json()`, and use four-argument error middleware `(err, req, res, next)` without returning internal paths or stack traces to clients.

## Project Structure

```text
codecontext/
├── bin/                  # CLI entry and command wrappers
├── src/
│   ├── commands/         # init/use/update/fix/doctor flows
│   ├── ai/               # OpenAI + Anthropic native HTTP client
│   ├── scanner/          # project detection and file scanning
│   ├── adapters/         # built-in project type adapters
│   ├── generator/        # prompt builder
│   ├── matcher/          # scenario matching
│   ├── template/         # template engine
│   ├── core/             # sections and document mapping
│   ├── plugins/          # plugin loading and state merging
│   ├── utils/            # config, Git, filtering, token estimator, task history, etc.
│   └── web/              # Express Dashboard API
├── web/                  # Vue 3 Dashboard frontend
├── templates/            # prompt templates and scenarios
├── tests/                # Jest tests
```

## Roadmap

Post-1.0.0 priorities:

1. Continue tightening the security surface: `loadConfigWithVM()` sandbox boundaries, command construction in dashboard dev mode and Git utilities, unified Web API error handling, and finer-grained token/IP rate-limit policies.
2. Close test gaps in `core/`, `web/middleware/`, `utils/git-utils.js`, built-in adapters, and plugin loading.
3. Performance: serial AI calls in `init` and `update --apply`, mtime prefiltering in the scanner, Dashboard status-page caching.
4. AI client enhancements: streaming, request cancellation, and automatic truncation or chunking when prompts exceed the token budget.
5. Plugin ecosystem: example plugins, official adapter templates, and plugin schema validation.

Maintainers may keep `docs/` locally for planning and audit material; `docs/` is ignored by Git by default and is not included in the npm package.

## Development

```bash
npm test -- --runInBand
npm run coverage
npm run build:web
npm run check
node bin/cli.js help
node bin/cli.js dashboard
```

For frontend changes, run at least:

```bash
npm run build:web
```

For security, path, config, or Web API changes, add matching tests.

## Known Risks

Hardened in v1.0.0: AI `baseUrl` rejects non-HTTPS, loopback, private, link-local, and metadata addresses by default and validates DNS resolution results; saving API keys via the Dashboard validates protocol, base URL, model name, and newline injection; sensitive AI endpoints have basic in-memory rate limiting; `tokenAuth` uses `crypto.timingSafeEqual` with length pre-check to mitigate timing side channels.

Current priority risks:

- Sandbox boundaries of `loadConfigWithVM()` config execution.
- Command construction in dashboard dev mode and Git utilities.
- Unified Web API error handling and finer-grained rate limiting (for multi-process / distributed deployments).
- Test gaps in `core/`, `web/middleware/`, `utils/git-utils.js`, and built-in adapters.
- Serial AI calls in `init` and `update --apply`.

The Dashboard is intended for local development and should not be exposed directly to the public internet.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Before submitting a pull request, run:

```bash
npm run check
```

Do not open public issues for security reports. See [SECURITY.md](SECURITY.md).

Maintainers should enable GitHub [private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository) so researchers can submit vulnerabilities through a private workflow.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT License](LICENSE) © 2026 hzh1117.
