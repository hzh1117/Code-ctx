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

> **Project status: active development.** The core CLI and local Dashboard are usable, but the audit reports under `docs/` still identify P0 security items and test gaps. Resolve those items before public deployment, team rollout, or commercial-license evaluation.

> **License notice:** This project is source-available for non-commercial use only. Commercial use, SaaS hosting, paid integration, paid support, and redistribution as part of a commercial product are prohibited. See [LICENSE](LICENSE).

> **Terminology:** Because this project prohibits commercial use, it is not an OSI-defined open source license. Use "source-available / non-commercial use" in public wording. Reference: [Open Source Definition](https://opensource.org/osd).

## What Is Code-ctx?

Code-ctx is a CLI tool for AI-assisted development. It scans a project, generates reusable context documentation under `ai-docs/`, and assembles task-specific prompts for Claude, ChatGPT, Cursor, Claude Code, Open Code, and similar AI coding tools.

The problem is simple: every new AI session often starts with repeated explanations of project structure, tech stack, module responsibilities, API contracts, and business context. Code-ctx turns that repeated explanation into updateable, reusable context.

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
OPENAI_MODEL=gpt-4
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
DASHBOARD_TOKEN=
AI_TIMEOUT=180000
```

Never commit `.env`. If a secret appears in logs, screenshots, issues, or pull requests, treat it as compromised and rotate it immediately.

AI `baseUrl` values accept public HTTPS endpoints by default and reject localhost, private-network, link-local, and metadata addresses. If local model gateways are needed, add an explicit local-development option with tests instead of loosening Dashboard validation.

### `code-ctx.config.js`

`init` generates project config automatically. You can also edit it manually:

```javascript
module.exports = {
  projectName: 'my-app',
  outputDir: './ai-docs',
  aiMode: 'clipboard',
  projects: [
    { alias: 'web', path: './web', type: 'vue3-admin', label: 'Frontend' },
    { alias: 'api', path: './api', type: 'java-backend', label: 'Backend' }
  ],
  excludeDirs: ['node_modules', '.git', 'dist'],
  gitTrack: true,
  ai: {
    protocol: 'openai',
    openai: {
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      maxTokens: 4096
    },
    anthropic: {
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096
    }
  }
};
```

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
└── docs/                 # analysis reports, repair plans, AI instructions
```

## Documentation and Roadmap

The repository includes detailed analysis documents. The published package includes these two actionable entry points:

- [AI Implementation Instructions](docs/AI分阶段实施指令-ai-implementation-instructions.md)
- [Project Improvement Roadmap](docs/项目完善路线图-project-improvement-roadmap.md)
- [AI Execution Playbook](docs/AI后续执行提示词手册-ai-execution-playbook.md)

Full audit reports such as `docs/安全审计报告-security-audit-report.md`, `docs/问题跟踪清单-issue-tracker.md`, and `docs/改进修复计划-repair-plan.md` are maintained inside the repository when present. Use the current repository files as the source of truth.

Recommended order:

1. Run `P00` from the [AI Execution Playbook](docs/AI后续执行提示词手册-ai-execution-playbook.md) to confirm the current baseline.
2. Run `P01-P06` for pre-publication security hardening.
3. Run `P07-P11` for tests and coverage output.
4. Run `P12-P15` for AI generation, update, status, and frontend performance.
5. Run `P16-P20` for architecture cleanup and hard-coded behavior removal.
6. Run `P21-P24` for release engineering.
7. Run `P25-P31` as needed for JSON config, plugins, documentation quality, Dashboard improvements, and E2E.

## Development

```bash
npm test -- --runInBand
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

The current audit reports under `docs/` call out these priority risks:

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
