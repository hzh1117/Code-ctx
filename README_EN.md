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

> **Project status:** v1.1.2 fixes production Dashboard startup from the npm package, and the current `master` has completed every P0-P3 item in the technical issue list. Initialization, incremental updates, fact verification, privacy filtering, AI request control, and engineering gates have passed the full regression suite.

> **License:** Released under the [MIT License](LICENSE). Free for personal and commercial use, modification, and redistribution.

## What Is Code-ctx?

Code-ctx is a CLI tool for AI-assisted development. It scans a project, generates reusable context documentation under `ai-docs/`, and assembles task-specific prompts for Claude, ChatGPT, Cursor, Claude Code, Open Code, and similar AI coding tools.

The problem is simple: every new AI session often starts with repeated explanations of project structure, tech stack, module responsibilities, API contracts, and business context. Code-ctx turns that repeated explanation into updateable, reusable context.

Code-ctx is not an AI IDE. It does not provide code completion, editor-native inline generation, or a general agent workspace. Its boundary is generating, maintaining, and reusing AI-readable codebase context for whichever AI tool you choose.

## Core Features

| Feature | Current Implementation |
|---------|------------------------|
| Project detection | Built-in Vue 2/3, React, Next.js, uni-app, Java, Node.js, Go, Python, and generic JS/TS/backend/unknown adapters with configurable scan-pattern overrides |
| Documentation generation | `code-ctx init` writes `ai-docs/`; `--skip-ai` writes deterministic Markdown, OVERVIEW, and a project manifest |
| Prompt generation | `code-ctx use "task"` matches scenarios and builds context-aware prompts; 8 built-in scenarios (A–H) |
| Incremental updates | `code-ctx update` detects additions, edits, and deletions using Git diff or hashes; `--apply` targets only evidence-backed sections |
| Health checks | `code-ctx doctor` checks documentation completeness and consistency; supports `--fix` |
| Document quality scoring | Completeness, freshness, risk, and manifest-backed fact scoring with an overall `OK / WARN / HIGH_RISK` verdict and 0–100 score |
| Local Dashboard | Vue 3 + Express dashboard for config, AI generation, project status, doc quality, security & health, and task history |
| AI protocols | OpenAI-compatible and Anthropic-compatible protocols; built-in presets for OpenAI, Anthropic, DeepSeek, Kimi, MiniMax |
| Token budgeting | Budgets the serialized outbound request, reserves output tokens separately, and validates continuation structure |
| Task history | `use` / `update` automatically append history entries; raw prompts are never written to disk — only hash, length, and a sanitized preview are kept, with automatic rotation |
| Config format | Recommended `code-ctx.config.json` (schema-validated, non-executable); read-only compatibility with `code-ctx.config.js` |
| Plugin system | Mount local paths or npm packages via `plugins: [...]`; contribute adapters, scenarios, and sensitive-pattern rules |
| Sensitive filtering | One outbound gateway redacts secrets, connection strings, and absolute paths from every AI message and emits value-free audit summaries |
| AI request control | Per-request timeout plus a five-minute operation deadline; normal, continuation, streaming, and retry waits support AbortSignal and CLI Ctrl+C cleanup |

## Quick Start

### Requirements

- **Node.js >= 20.0.0** (this project uses commander 14, express 5, and other modern dependencies — Node 20+ is required)
- Git (optional; at runtime it enables precise diffs, while non-Git projects fall back to file hashes)

### Install

```bash
npm install -g code-ctx@latest
code-ctx --version
```

See [CONTRIBUTING.md](CONTRIBUTING.md) when developing from source; those steps are not required for normal installation.

The version should be `1.1.2`.

### 60-Second No-Key Tour

This path does not contact an external AI provider. Use it to verify scanning, documentation, and prompt generation first:

```bash
cd /path/to/your-project
code-ctx init --skip-ai
code-ctx config validate
code-ctx doctor
code-ctx use -s A --no-ai-match --non-interactive "Understand the project structure" --stdout
```

On success, the project root contains `code-ctx.config.json` and `ai-docs/`. `ai-docs/OVERVIEW.md` is the repository overview, and the other Markdown files represent detected projects. `--stdout` prints the prompt directly and does not depend on the system clipboard.

### Generate Detailed Documentation with AI

Run this path from a project that has not been initialized yet:

```bash
cd /path/to/your-project
code-ctx config setup
code-ctx init
code-ctx config validate
code-ctx doctor
code-ctx use "Add user login feature" --stdout
```

`config setup` asks you to choose a provider, confirm the API address and model, enter an API key, and test the connection. It creates or updates `.env`, `.gitignore`, and `code-ctx.config.json`; `init` then persists detected project fields and generates `ai-docs/`. If you already completed the no-key tour, run `code-ctx init --force` after configuring AI to regenerate detailed documents.

Without `--stdout`, prompts go to the clipboard by default. You can also write one to a file:

```bash
code-ctx use "Fix login page white screen" --out .ai-prompt.md
```

### Run Without a Global Install

With `npm exec`, every command must retain the complete package argument; do not mix this path with global commands:

```bash
npm exec --yes --package=code-ctx@latest -- code-ctx --version
npm exec --yes --package=code-ctx@latest -- code-ctx init --skip-ai
npm exec --yes --package=code-ctx@latest -- code-ctx config validate
npm exec --yes --package=code-ctx@latest -- code-ctx doctor
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
| `code-ctx config validate/migrate/setup` | Validate, migrate, or interactively configure the project and AI provider |

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

`init --skip-ai` needs no API key and produces deterministic documents containing scan evidence only. In AI mode, `project-manifest.json` is the trust anchor for document ownership and fact verification. `update --apply` does not guess a section or commit the scan baseline when impact cannot be confirmed. AI calls default to a 180-second request timeout and a five-minute total operation deadline; Ctrl+C cancels active requests and retry waits.

## Configuration

### Environment Variables

Prefer `code-ctx config setup`; it safely creates or updates `.env` in the project root and ensures `.gitignore` contains `.env`. Create `.env` yourself only for manual configuration:

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

The repository and npm package include `.env.example` as a field reference only. You do not need to copy it into a managed project, and it must not overwrite an `.env` created by `config setup`.

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

> **Migrating from JS to JSON**: run `code-ctx config migrate`. It statically parses `module.exports = {...}`, backs up the legacy file, and writes `code-ctx.config.json`. Later Dashboard and `saveAIConfig` changes are also written to JSON.

Legacy `code-ctx.config.js` is supported as static, read-only data only. The loader extracts `module.exports = {...}` and parses it with JSON5; it never executes JavaScript and rejects `require`, `process`, function calls, and computed expressions. Run `code-ctx config migrate` to create a backed-up JSON config. All subsequent writes use `code-ctx.config.json`.

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

See [`examples/plugin-basic/`](examples/plugin-basic/) for a minimal example. Plugins are executable Node.js modules and should only be loaded from reviewed sources. Interactive terminals ask for first-use confirmation and persist trust; non-interactive environments such as CI must allow exact specs with `CODE_CTX_PLUGINS_ALLOW`. Reserve `CODE_CTX_PLUGINS_ALLOW_ALL=1` for isolated test environments whose configuration has already been reviewed. Plugin loading failures only emit a warning and never break builtin functionality.

## Web Dashboard

```bash
code-ctx dashboard
```

The default URL is `http://localhost:3456`. The Dashboard reads the managed project's `code-ctx.config.json` (with static legacy-JS compatibility) and `ai-docs/`. Start it inside the project directory or pass `--dir`.

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

Continuous improvement after completing the P0-P3 technical issue list:

1. Expand `checkJs` in phases using [`TYPE_CHECKING.md`](TYPE_CHECKING.md), eventually covering adapters, commands, Web APIs, and the Vue frontend.
2. Keep ESLint, Vite, Glob, and production dependencies current while preserving Node 20/22 and Windows/Ubuntu compatibility.
3. Extend provider compatibility smoke tests, failure diagnostics, and trend reporting while keeping credentialed tests explicitly opt-in.
4. Improve release automation, version notes, npm provenance, and verification that packages contain only intended artifacts.
5. If the Dashboard is deployed publicly or across processes, add persistent rate limiting, standalone authentication, proxy trust boundaries, and a deployment security baseline.

Maintainers may keep `docs/` locally for planning and audit material; `docs/` is ignored by Git by default and is not included in the npm package.

## Development

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

`npm run check` runs formatting, CLI/backend/Vue lint, incremental `checkJs`, regular tests, thresholded coverage, the production Web build, and a real npm pack/install smoke in order. CI runs the complete gates on Ubuntu with Node 20/22 and CLI/package smoke on Windows with Node 20. High/critical production dependency audits for both the CLI and Dashboard block CI.

For frontend changes, run at least:

```bash
npm run build:web
```

For security, path, config, or Web API changes, add matching tests.

## Known Risks

The current `master` has completed all P0-P3 technical issues: bounded source and change evidence reaches prompts; init/update commit state only after successful writes; manifests drive document ownership and fact checks; all outbound AI messages pass through one privacy gateway; requests support total deadlines and Ctrl+C cancellation; and formatting, types, coverage, cross-platform smoke, and dependency audits are enforced. Existing base-URL SSRF, Dashboard key-write, and token timing protections remain in place.

Remaining risks are deployment and ongoing maintenance boundaries:

- Legacy `code-ctx.config.js` is no longer executed, but only static object syntax is supported; migrate to strictly validated `code-ctx.config.json`.
- The Dashboard is local-only, and in-memory rate limiting is not sufficient for multi-process or distributed public deployment.
- `checkJs` currently covers an incremental set; historical JavaScript outside that set remains on the documented migration plan.
- Nightly provider smoke needs external credentials and is explicitly opt-in, so it cannot guarantee every third-party compatible endpoint remains available.
- Automated fact checks rely on manifests and source evidence and do not replace manual review before publishing private documentation.

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
