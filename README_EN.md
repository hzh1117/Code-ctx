<div align="center">

# Code-ctx

**AI Development Context Tool — Let AI Coding Assistants Understand Your Codebase Instantly**

[![npm version](https://img.shields.io/npm/v/code-ctx.svg)](https://www.npmjs.com/package/code-ctx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![CI](https://github.com/hzh1117/Code-ctx/actions/workflows/ci.yml/badge.svg)](https://github.com/hzh1117/Code-ctx/actions/workflows/ci.yml)

English | [中文](README.md)

</div>

---

> **⚠️ Project Status: Active Development** — Core features are functional. APIs may change. Feedback and contributions welcome.

## What is Code-ctx?

Code-ctx is a CLI tool that bridges the gap between your codebase and AI programming assistants. It scans your project, generates structured documentation, and automatically prepares context-aware prompts for tools like Claude, ChatGPT, Cursor, and other AI coding assistants.

**The problem:** Every time you start a new AI conversation, you spend 10-15 minutes explaining your project structure, tech stack, and conventions.

**The solution:** Run `code-ctx init` once, then `code-ctx use "your task"` before each AI session. The AI gets full project context in seconds.

## Features

| Feature | Description |
|---------|-------------|
| **Smart Project Detection** | Auto-identifies 9 project types (Vue 2/3, React, Next.js, uni-app, Java, Node.js, Go, Python) |
| **Intelligent Scenario Matching** | Matches task descriptions to 8 development scenarios using keywords + AI fallback |
| **Scenario-Based Templates** | Generates customized prompts for new features, bug fixes, refactoring, and more |
| **Document Auto-Injection** | Automatically loads OVERVIEW and related sub-project docs into prompts |
| **Incremental Updates** | Detects file changes via Git diff or MD5 hash, updates only affected sections |
| **Health Check + Auto-Fix** | Validates document completeness and consistency, auto-repairs outdated docs |
| **Fault Tolerance** | Resumes interrupted `init` runs, skips completed sub-projects automatically |
| **Web Dashboard** | Terminal-industrial UI with dark/light theme, visual config and status management |
| **Security First** | Auto-filters passwords, API keys, JWT tokens, SSH keys, and connection strings |
| **AI API Integration** | Compatible with OpenAI and Anthropic protocols (DeepSeek, Kimi, MiniMax, etc.) |
| **Clipboard Fallback** | Auto-degrades to file output when clipboard write fails |

## Quick Start

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git (any version)

### Install

```bash
# Clone
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx

# Install dependencies
npm install

# Build frontend dashboard
cd web && npm install && npm run build && cd ..

# Link globally
npm link

# Start Web dashboard (optional)
code-ctx dashboard
```

Access `http://localhost:3456` for visual configuration, AI generation, document status management, and more.

### Verify

```bash
code-ctx --version
code-ctx help
```

## Usage

### First Time: Initialize Your Project

```bash
cd /path/to/your-project

# Scan project structure, generate ai-docs/
code-ctx init

# Generate prompt for your task
code-ctx use "Add user login feature"

# Paste into your AI tool (Claude/ChatGPT/Cursor)
```

### Daily Development

```bash
# Smart scenario matching
code-ctx use "Add coupon export to merchant backend"

# Specify scenario manually
code-ctx use -s F "Fix login page white screen"

# Output to file for editing
code-ctx use "Task description" --out .ai-prompt.md
```

### After Code Changes

```bash
# Detect changes, generate incremental update prompt
code-ctx update

# Force regenerate a sub-project's document
code-ctx fix web
```

## Commands

| Command | Description |
|---------|-------------|
| `code-ctx init` | Scan project, generate `ai-docs/` directory |
| `code-ctx use [task]` | Generate development prompt, copy to clipboard |
| `code-ctx update` | Detect file changes, generate incremental update prompt |
| `code-ctx fix <alias>` | Force regenerate specified sub-project document |
| `code-ctx status` | View document status (size, last modified) |
| `code-ctx doctor` | Check document health, support `--fix` auto-repair |
| `code-ctx dashboard` | Start local web management interface |
| `code-ctx watch` | Watch file changes, auto-trigger incremental updates |
| `code-ctx hook` | Manage git post-commit hook |

### Command Options

```bash
# init
code-ctx init              # Normal initialization
code-ctx init --skip-ai    # Scan only, skip AI document generation
code-ctx init --force      # Force regenerate all, ignore completed status

# use
code-ctx use "task"              # Smart match scenario
code-ctx use -s B "task"         # Manually specify scenario (A-H)
code-ctx use "task" --stdout     # Output to terminal
code-ctx use "task" --out p.md   # Output to file

# update
code-ctx update              # Detect changes and generate prompt
code-ctx update --dry-run    # Detect only, don't update scan records
code-ctx update --stdout     # Output to terminal

# fix
code-ctx fix web             # Regenerate web.md
code-ctx fix web --dry-run   # Generate prompt only, don't call AI

# doctor
code-ctx doctor              # Basic health check
code-ctx doctor --strict     # Strict mode (parse code routes)
code-ctx doctor --fix        # Auto-fix outdated/missing documents
code-ctx doctor --fix --force  # Force regenerate all documents

# dashboard
code-ctx dashboard           # Default port 3456
code-ctx dashboard -p 8080   # Custom port
```

## Supported Project Types

| Type | Detection Method |
|------|------------------|
| Vue 2 Admin | `package.json` has `vue` + `element-ui` |
| Vue 3 Admin | `package.json` has `vue` + `element-plus` |
| React | `package.json` has `react` |
| Next.js | `package.json` has `next` |
| uni-app Mini Program | `package.json` has `uni-app` or `manifest.json` |
| Java Backend | `pom.xml` or `build.gradle` |
| Node.js Backend | `package.json` has `express`/`koa`/`nestjs` |
| Go Backend | `go.mod` |
| Python Backend | `requirements.txt` or `pyproject.toml` |

## Scenario Templates

| ID | Scenario | Description | Related Projects |
|----|----------|-------------|------------------|
| A | C-end New Features | Add mini-program/H5/frontend pages | mp, api |
| B | Merchant Backend | Add management features | mer, api |
| C | Platform Backend | Add operations features | plat, api |
| D | Data Model Changes | Modify table structure | api |
| E | Modify Existing | Optimization, refactoring | — |
| F | Bug Fixing | Locate and fix issues | — |
| G | Pure Backend | Backend logic adjustments | api |
| H | Cross-platform | Multi-platform integration | mp, mer, api |

## Configuration

### Environment Variables (.env)

```env
# Anthropic API Key (Claude or compatible services)
ANTHROPIC_API_KEY=<your-anthropic-api-key>

# OpenAI Compatible API Key (DeepSeek, Kimi, MiniMax, etc.)
OPENAI_API_KEY=<your-openai-compatible-api-key>

# Optional: Override default endpoints
# OPENAI_BASE_URL=https://api.deepseek.com
# OPENAI_MODEL=deepseek-chat
# ANTHROPIC_BASE_URL=https://api.anthropic.com
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### Project Configuration (code-ctx.config.js)

Auto-generated by `init`, or manually edited:

```javascript
module.exports = {
  projectName: 'my-app',
  outputDir: './ai-docs',
  aiMode: 'clipboard',           // 'clipboard' | 'api'
  projects: [
    { alias: 'web', path: './web', type: 'vue2-admin', label: 'Frontend' },
    { alias: 'api', path: './api', type: 'java-backend', label: 'Backend' }
  ],
  excludeDirs: ['node_modules', '.git', 'dist'],
  gitTrack: true,                // Include ai-docs/ in git
  ai: {
    protocol: 'openai',          // 'openai' | 'anthropic'
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

## AI API Providers

All providers compatible with OpenAI or Anthropic protocols are supported.

| Provider | Protocol | Base URL | Model Examples |
|----------|----------|----------|----------------|
| DeepSeek | OpenAI | `https://api.deepseek.com` | `deepseek-chat` |
| Kimi | OpenAI | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| MiniMax | OpenAI | `https://api.minimax.chat` | `abab6.5-chat` |
| Zhipu AI | OpenAI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4` |
| Baichuan | OpenAI | `https://api.baichuan-ai.com/v1` | `Baichuan4` |
| Anthropic | Anthropic | `https://api.anthropic.com` | `claude-3-5-sonnet-20241022` |

## Integration with AI Tools

### Claude Code / Cursor / Open Code

```bash
# Method 1: Clipboard (default)
code-ctx use "Task description"
# Paste with Ctrl+V

# Method 2: File output
code-ctx use "Task description" --out .ai-prompt.md
# Reference in AI: "Please read .ai-prompt.md"

# Method 3: stdout pipe
code-ctx use "Task description" --stdout | claude
```

### Web ChatGPT / Claude

```bash
code-ctx use "Task description"
# Open browser, Ctrl+V to paste
```

## Web Dashboard

```bash
code-ctx dashboard
```

Access `http://localhost:3456`:

- **Configuration** — Visual project config editing
- **AI Config** — Tab-based OpenAI/Anthropic setup with connection testing
- **AI Generate** — Split-pane: scenario selection + prompt generation + AI calls
- **Sub-projects** — Card view of detected sub-projects
- **Scenario Templates** — Browse and preview all 8 scenario templates
- **Document Status** — Table view of document health (OK / Needs Update / Missing)

Design: Terminal industrial aesthetic, dark/light theme, Outfit + JetBrains Mono fonts, CSS variables.

## Architecture

```
code-ctx/
├── bin/                    # CLI entry point
│   ├── cli.js              # Main CLI (Commander.js)
│   └── commands/           # 9 command definitions
├── src/                    # Core modules
│   ├── commands/           # Command implementations
│   ├── scanner/            # Project detection + file scanning
│   ├── generator/          # Prompt assembly
│   ├── template/           # Template engine
│   ├── matcher/            # Scenario matching (keyword + AI)
│   ├── ai/                 # AI client (OpenAI + Anthropic)
│   ├── adapters/           # Project type adapters (9 built-in)
│   │   └── builtin/        # Vue2, Vue3, React, Next.js, uni-app, Java, Node, Go, Python
│   ├── core/               # Doc resolver, section parser
│   ├── web/                # Express API server
│   └── utils/              # Config, constants, git, sensitive filter, clipboard
├── templates/              # Built-in scenario templates
├── web/                    # Frontend (Vue 3 + Vite)
│   ├── src/
│   │   ├── components/     # Sidebar
│   │   ├── composables/    # useTheme
│   │   ├── views/          # 6 pages
│   │   ├── App.vue         # Root + CSS variables
│   │   └── main.js         # Entry + router
│   └── dist/               # Build output
└── tests/                  # Jest test suite
```

### Key Design Patterns

- **Adapter Pattern** — Extensible project type detection via `BaseAdapter` + `AdapterRegistry`
- **Strategy Pattern** — Token-based strategy selection (ONE_SHOT / BATCH_WITH_CONTEXT / BATCH_MINIMAL)
- **Section-Level Updates** — Parses markdown sections for surgical document updates
- **Fault Tolerance** — State file tracking (`init-state.json`) enables resume after interruption

## FAQ

**Q: What if `init` is interrupted?**
Re-run it. Completed sub-projects are automatically skipped.

**Q: Clipboard write fails?**
Auto-degrades to `.ai-prompt.md`. Or use `--out` explicitly.

**Q: How to update documents?**
```bash
code-ctx update          # Detect changes
code-ctx fix web         # Force regenerate
code-ctx doctor --fix    # Auto-repair outdated docs
```

**Q: Multi-person collaboration?**
Commit `ai-docs/` to git. Team members share the same context.

**Q: How to extend project type support?**
Create a new adapter in `src/adapters/builtin/` extending `BaseAdapter`.

## Development

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx
npm install
cd web && npm install && npm run build && cd ..
npm link

# Run tests
npm test -- --runInBand

# Build dashboard
npm run build:web

# Run tests and build
npm run check

# Start dashboard
code-ctx dashboard
```

## Contributing

Contributions welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md). Basic flow:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Before submitting:

```bash
npm run check
```

## Security

Please do not open public issues for sensitive security reports. See [SECURITY.md](SECURITY.md).

Before publishing a public repository, make sure `.env`, API keys, private project docs, and generated prompt files are not committed.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © hzh1117
