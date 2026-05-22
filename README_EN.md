<div align="center">

# Code-ctx

**AI development context tool for helping AI coding assistants understand your codebase quickly**

[![npm version](https://img.shields.io/npm/v/code-ctx.svg)](https://www.npmjs.com/package/code-ctx)
[![License: Non-Commercial](https://img.shields.io/badge/License-Non--Commercial-red.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![CI](https://github.com/hzh1117/Code-ctx/actions/workflows/ci.yml/badge.svg)](https://github.com/hzh1117/Code-ctx/actions/workflows/ci.yml)

English | [中文](README.md)

</div>

---

> **Project status: active development.** The core CLI and local Dashboard are usable, but security, test coverage, and release engineering still need work before public deployment, team rollout, or commercial-license evaluation.

> **License notice:** This project is source-available for non-commercial use only. Commercial use, SaaS hosting, paid integration, paid support, and redistribution as part of a commercial product are prohibited. See [LICENSE](LICENSE).

> **Terminology:** Because this project prohibits commercial use, it is not an OSI-defined open source license. Use "source-available / non-commercial use" in public wording. Reference: [Open Source Definition](https://opensource.org/osd).

## What Is Code-ctx?

Code-ctx is a CLI tool for AI-assisted development. It scans a project, generates reusable context documentation under `ai-docs/`, and assembles task-specific prompts for Claude, ChatGPT, Cursor, Claude Code, Open Code, and similar AI coding tools.

The problem is simple: every new AI session often starts with repeated explanations of project structure, tech stack, module responsibilities, API contracts, and business context. Code-ctx turns that repeated explanation into updateable, reusable context.

Code-ctx is not an AI IDE. It does not provide code completion, editor-native inline generation, or a general agent workspace. Its boundary is generating, maintaining, and reusing AI-readable codebase context for whichever AI tool you choose.

## Core Features

| Feature | Current Implementation |
|---------|------------------------|
| Project detection | Built-in adapters for Vue 2/3, React, Next.js, uni-app, Java, Node.js, Go, Python, and more |
| Documentation generation | `code-ctx init` scans projects and writes `ai-docs/` |
| Prompt generation | `code-ctx use "task"` builds context-aware prompts |
| Incremental updates | `code-ctx update` detects changes using Git diff or hash fallback |
| Health checks | `code-ctx doctor` checks documentation completeness and consistency; supports `--fix` |
| Local Dashboard | Vue 3 + Express dashboard for config, AI generation, projects, and document status |
| AI protocols | OpenAI-compatible and Anthropic-compatible protocols; works with DeepSeek, Kimi, MiniMax, and similar providers |
| Sensitive filtering | Basic filtering for passwords, API keys, JWTs, SSH keys, database URLs, and related secrets |

## Quick Start

### Requirements

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git

### Install and Build

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx
npm install
cd web && npm install && npm run build && cd ..
npm link
```

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

## Web Dashboard

```bash
code-ctx dashboard
```

The default URL is `http://localhost:3456`. The Dashboard reads the managed project's `code-ctx.config.js` and `ai-docs/`. Start it inside the project directory or pass `--dir`.

Current Dashboard pages include:

- Configuration management
- AI configuration and connection testing
- Scenario selection and prompt generation
- Sub-project status
- Scenario template preview
- Document status and health-check entry

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
│   ├── utils/            # config, Git, filtering, clipboard, etc.
│   └── web/              # Express Dashboard API
├── web/                  # Vue 3 Dashboard frontend
├── templates/            # prompt templates and scenarios
├── tests/                # Jest tests
```

## Roadmap

Recommended order:

1. Complete pre-publication security hardening for config loading, command execution, path access, and Web API error handling.
2. Add core tests and coverage output for config, Git, section updates, Web APIs, and the AI client.
3. Improve AI context-generation performance for `init`, `update --apply`, status pages, and frontend build experience.
4. Clean up architecture by splitting large functions, removing hard-coded behavior, and unifying shared utilities.
5. Complete release engineering: CI, release checklist, npm pack verification, and default model/config review. See [`docs/release-checklist.md`](docs/release-checklist.md).
6. Add product capabilities as needed: JSON config, plugin system, document quality scoring, Dashboard improvements, and E2E smoke tests.

Maintainers may keep `docs/` locally for planning and audit material; `docs/` is ignored by Git by default and is not included in the npm package.
`docs/release-checklist.md` is an explicit exception, published as the public release-gating reference.

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

Current priority risks:

- `loadConfigWithVM()` config execution safety.
- Command construction in dashboard dev mode and Git utilities.
- Dashboard config write whitelisting and input validation.
- AI base URLs and sensitive AI APIs have baseline protection; finer token/IP rate-limit policies and distributed deployment support still need follow-up work.
- Web API error disclosure and missing rate limiting.
- Test gaps in `core/`, `web/middleware/`, and `utils/git-utils.js`.
- Serial AI calls in `init` and `update --apply`.

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

[Code-ctx Non-Commercial Source License](LICENSE) © hzh1117. Non-commercial use only.

This is not an OSI-approved open source license. Obtain written permission from the maintainer before commercial use, commercial integration, or SaaS hosting.
