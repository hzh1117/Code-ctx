# Code-ctx

> **⚠️ Project Status: In Development** — This project is not yet complete. Some features may be unstable or unavailable. Feel free to try it out and provide feedback, but please do not use it in production environments.

> AI Development Context Tool - Let AI Programming Assistants "Know" Your Codebase Instantly

English | [中文](README.md)

[![npm version](https://img.shields.io/npm/v/code-ctx.svg)](https://www.npmjs.com/package/code-ctx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Introduction

Code-ctx is a CLI tool that helps AI programming assistants (such as Claude, ChatGPT, Cursor, etc.) quickly understand your project structure. It scans projects, generates structured documents, and automatically prepares the most suitable prompt based on your task description.

## Features

- 🔍 **Smart Project Detection** - Automatically identifies 8 project types (Vue, React, Java, Go, etc.)
- 🧠 **Intelligent Scenario Matching** - Describes tasks to automatically match the best development scenario without manual selection
- 📝 **Scenario Templates** - 8 development scenarios (new features, bug fixes, refactoring, etc.) generate customized prompts
- 📄 **Document Auto-Injection** - Automatically loads OVERVIEW and related sub-project documents, no manual specification needed
- 🔄 **Incremental Updates** - Only updates changed files, generates incremental update prompts
- 🏥 **Health Check** - Detects document completeness, OVERVIEW consistency, and sensitive information leaks
- 💾 **Fault Tolerance** - Can resume after init interruption, automatically skips completed sub-projects
- 🖥️ **Web Management** - Visual configuration, scenario templates, document status management
- 📋 **Clipboard Fallback** - Automatically falls back to file output when writing large content fails
- 🔒 **Security First** - Automatically filters sensitive information (passwords, keys, etc.)
- 🤖 **AI API Integration** - Compatible with OpenAI and Anthropic protocols, supports DeepSeek, Kimi, MiniMax, etc.

---

## Local Deployment

### Environment Requirements

| Dependency | Minimum Version | Check Command |
|------------|-----------------|---------------|
| Node.js | 16.0.0+ | `node -v` |
| npm | 8.0.0+ | `npm -v` |
| Git | Any | `git --version` |

### Step 1: Clone the Project

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd code-ctx
```

### Step 2: Install Backend Dependencies

```bash
npm install
```

### Step 3: Build Frontend

```bash
cd web
npm install
npm run build
cd ..
```

After building, the `web/dist/` directory will generate frontend static files, which will be automatically loaded when the Dashboard starts.

### Step 4: Global Link

```bash
npm link
```

This creates a global symlink for the `code-ctx` command, allowing you to use the `code-ctx` command in any directory.

### Step 5: Verify Installation

```bash
code-ctx --version
code-ctx help
```

Seeing the version number and help information indicates successful installation.

---

## Quick Start

### Scenario 1: First Use (Initialize + Generate Prompt)

```bash
# 1. Enter your project directory
cd /path/to/your-project

# 2. Initialize (scan project structure, generate ai-docs/)
code-ctx init

# 3. Generate prompt (intelligently match scenario)
code-ctx use "Add user login feature"

# 4. Open AI tool (Claude/ChatGPT/Cursor), paste the prompt
```

### Scenario 2: Daily Development (With existing ai-docs/)

```bash
# Generate prompt directly
code-ctx use "Add coupon export feature to merchant backend"

# Specify scenario
code-ctx use -s F "Fix login page white screen issue"

# Output to file (convenient for editing before use)
code-ctx use "Task description" --out .ai-prompt.md
```

### Scenario 3: Update Documents After Code Changes

```bash
# Detect changes, generate incremental update prompt
code-ctx update

# Force regenerate a sub-project's document
code-ctx fix web
```

---

## Command Details

### `code-ctx init`

Initialize project, scan structure and generate `ai-docs/` directory.

```bash
code-ctx init              # Normal initialization
code-ctx init --skip-ai    # Only scan, don't call AI to generate documents
code-ctx init --force      # Force regenerate, ignore completed status
```

**Process:**
1. Scan project directory, detect sub-project types
2. Extract key files (API, routes, configurations, etc.)
3. Call AI to generate structured documents (requires API Key configuration)
4. Check if generated documents contain sensitive information
5. Write to `ai-docs/` directory

**Fault Tolerance:** If init is interrupted (network issues, API timeouts, etc.), re-running will automatically skip completed sub-projects.

### `code-ctx use [task]`

Generate development prompt, copy to clipboard.

```bash
code-ctx use "Task description"              # Intelligently match scenario
code-ctx use -s B "Task description"         # Manually specify scenario
code-ctx use "Task description" --stdout     # Output to terminal
code-ctx use "Task description" --out p.md   # Output to file
```

**Smart Mode Process:**
1. Analyze task description, match best scenario (A-H)
2. Load `ai-docs/OVERVIEW.md` (project overview)
3. Load related sub-project documents (e.g., merchant tasks load `mer.md`)
4. Assemble complete prompt and copy to clipboard

### `code-ctx update`

Detect file changes, generate incremental update prompt.

```bash
code-ctx update              # Detect changes and generate prompt
code-ctx update --dry-run    # Only detect changes, don't update scan records
code-ctx update --stdout     # Output to terminal
```

### `code-ctx fix <alias>`

Force regenerate specified sub-project's document.

```bash
code-ctx fix web             # Call AI to regenerate web.md
code-ctx fix web --dry-run   # Only generate prompt, don't call AI
```

### `code-ctx status`

View status of documents in `ai-docs/` (size, last modification time).

```bash
code-ctx status
```

### `code-ctx doctor`

Check document health status, supports auto-fix.

```bash
code-ctx doctor              # Basic check
code-ctx doctor --strict     # Strict mode (parse code routes)
code-ctx doctor --fix        # Auto-fix documents (calls AI)
code-ctx doctor --fix --force  # Force regenerate all documents
```

**Check Items:**
- Configuration vs actual directory consistency (unconfigured sub-projects)
- Document completeness (content volume, required sections)
- Document vs code consistency (key file mention rate, directory structure match)
- Whether passwords, keys, or other sensitive information are included
- API route record completeness (strict mode)

**Auto-Fix (`--fix`):**
- Detects outdated documents (key file mention rate < 30%)
- Regenerates missing or outdated sub-project documents
- Regenerates OVERVIEW.md

### `code-ctx dashboard`

Start local web management interface.

```bash
code-ctx dashboard           # Default port 3456
code-ctx dashboard -p 8080   # Specify port
```

Visit `http://localhost:3456`, features include:
- **Configuration Management** (`/`) - Visual edit project configuration
- **AI Configuration** (`/ai`) - Configure large model API connections
- **AI Generation** (`/ai-generate`) - Select scenario to generate prompt and call AI
- **Sub-projects** (`/projects`) - View detected sub-project list
- **Scenario Templates** (`/scenarios`) - View A-H scenario templates
- **Document Status** (`/status`) - View ai-docs document status

---

## Configuration Guide

### Environment Variables (.env)

Create a `.env` file in the project root directory to configure API Key:

```env
# Anthropic API Key (Claude or compatible services)
ANTHROPIC_API_KEY=sk-ant-xxx

# OpenAI Compatible API Key (DeepSeek, Kimi, MiniMax, etc.)
OPENAI_API_KEY=sk-xxx

# Optional: Override default service address and model
# OPENAI_BASE_URL=https://api.deepseek.com
# OPENAI_MODEL=deepseek-chat
# ANTHROPIC_BASE_URL=https://api.anthropic.com
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### Project Configuration (code-ctx.config.js)

The `init` command will auto-generate, or you can manually edit:

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
  gitTrack: true,                // Whether to include ai-docs/ in git
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

---

## Supported Project Types

| Type | Feature Files |
|------|---------------|
| Vue2 Admin | `package.json` contains `vue` + `element-ui` |
| Vue3 Admin | `package.json` contains `vue` + `@element-plus` |
| React | `package.json` contains `react` |
| uni-app Mini Program | `package.json` contains `uni-app` or `manifest.json` |
| Java Backend | `pom.xml` or `build.gradle` |
| Node.js Backend | `package.json` contains `express`/`koa`/`nestjs` |
| Go Backend | `go.mod` |
| Python Backend | `requirements.txt` or `pyproject.toml` |

## Scenario Templates

| Scenario | Description | Typical Tasks |
|----------|-------------|---------------|
| A | C-end New Features | Add mini-program/H5/frontend pages |
| B | Merchant Backend New Features | Add management features |
| C | Platform Backend New Features | Add operations features |
| D | Data Model Changes | Modify table structure |
| E | Modify Existing Features | Optimization, refactoring |
| F | Bug Fixing | Locate and fix issues |
| G | Pure Backend Changes | Backend logic adjustments |
| H | Cross-platform Features | Multi-platform integration |

---

## AI API Integration

Supports all large models compatible with OpenAI and Anthropic interface protocols.

### Supported Providers

| Provider | Protocol | baseUrl | Model Examples |
|----------|----------|---------|----------------|
| DeepSeek | OpenAI | `https://api.deepseek.com` | `deepseek-chat` |
| Kimi | OpenAI | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| MiniMax | OpenAI | `https://api.minimax.chat` | `abab6.5-chat` |
| Zhipu AI | OpenAI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4` |
| Baichuan | OpenAI | `https://api.baichuan-ai.com/v1` | `Baichuan4` |
| Claude | Anthropic | `https://api.anthropic.com` | `claude-3-5-sonnet-20241022` |

### Configuration Methods

1. Configure API Key in `.env`
2. Configure `ai.protocol`, `ai.openai`, `ai.anthropic` in `code-ctx.config.js`
3. Or visually configure in the Web management interface's `AI Configuration` page

---

## Integration with AI Tools

### Claude Code / Cursor / Open Code

```bash
# Method 1: Clipboard (default)
code-ctx use "Task description"
# Paste in AI tool with Ctrl+V

# Method 2: File output
code-ctx use "Task description" --out .ai-prompt.md
# Reference in AI tool: Please read .ai-prompt.md

# Method 3: stdout pipe
code-ctx use "Task description" --stdout | claude
```

### Web ChatGPT / Claude

```bash
code-ctx use "Task description"
# Open webpage, Ctrl+V to paste
```

---

## FAQ

### Q: What if init is interrupted?

Just re-run it, completed sub-projects will be automatically skipped:

```bash
code-ctx init           # Resume
code-ctx init --force   # Force regenerate all
```

### Q: What if clipboard writing fails?

The tool will automatically fall back to file output (`.ai-prompt.md`), or you can actively use:

```bash
code-ctx use "Task description" --out prompt.md
```

### Q: How to update documents?

```bash
code-ctx update          # Detect changes, generate incremental update prompt
code-ctx fix web         # Force regenerate a sub-project's document
code-ctx fix web --dry-run  # Only generate prompt, don't call AI
```

### Q: How to check if documents leak sensitive information?

```bash
code-ctx doctor             # Check document health
code-ctx doctor --fix       # Auto-fix outdated/missing documents
```

### Q: Is multi-person collaboration supported?

Yes! Submit the `ai-docs/` directory to git, team members can share documents:

```bash
git add ai-docs/
git commit -m "docs: Update AI context documents"
```

---

## Development

```bash
# Clone project
git clone https://github.com/hzh1117/Code-ctx.git
cd code-ctx

# Install dependencies
npm install

# Build frontend
cd web && npm install && npm run build && cd ..

# Global link
npm link

# Run tests
npm test

# Start web interface
code-ctx dashboard
```

---

## Directory Structure

```
code-ctx/
├── bin/                # CLI entry
│   ├── cli.js          # Main entry
│   └── commands/       # Command definitions (7 commands)
├── src/                # Core code
│   ├── commands/       # Command implementations
│   ├── scanner/        # Project detection, file scanning
│   ├── generator/      # Prompt assembler
│   ├── template/       # Template engine
│   ├── matcher/        # Scenario matching (keywords + confidence)
│   ├── ai/             # AI call wrapper (OpenAI + Anthropic)
│   ├── web/            # Express web service
│   └── utils/          # Utility functions
├── templates/          # Built-in scenario templates (scenarios.json)
├── web/                # Frontend code (Vue 3 + Vite)
│   ├── src/views/      # Pages: config, AI config, AI generation, sub-projects, scenarios, status
│   └── dist/           # Build output
├── tests/              # Test files (Jest)
├── .env.example        # Environment variable example
└── code-ctx.config.js  # Project configuration file (auto-generated by init)
```

---

## License

MIT License
