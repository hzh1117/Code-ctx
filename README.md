<div align="center">

# Code-ctx

**AI 开发上下文工具，让 AI 编程助手快速理解你的代码库**

[![npm version](https://img.shields.io/npm/v/code-ctx.svg)](https://www.npmjs.com/package/code-ctx)
[![License: Non-Commercial](https://img.shields.io/badge/License-Non--Commercial-red.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![CI](https://github.com/hzh1117/Code-ctx/actions/workflows/ci.yml/badge.svg)](https://github.com/hzh1117/Code-ctx/actions/workflows/ci.yml)

[English](README_EN.md) | 中文

</div>

---

> **项目状态：积极开发中。** 核心 CLI 和本地 Dashboard 已可用，但公开部署、团队推广或商业授权评估前，仍需要继续补齐安全、测试和发布工程。

> **许可说明：** 本项目源码公开，但仅允许非商业使用。禁止商业使用、SaaS 托管、付费集成、付费支持或作为商业产品的一部分再分发。详见 [LICENSE](LICENSE)。

> **术语说明：** 因本项目禁止商业使用，它不属于 OSI 定义下的开源许可；对外请使用“源码公开 / 非商业使用”表述。参考：[Open Source Definition](https://opensource.org/osd)。

## 什么是 Code-ctx？

Code-ctx 是一个面向 AI 编程协作的 CLI 工具。它扫描项目结构，生成 `ai-docs/` 上下文文档，并根据开发任务自动组装适合 Claude、ChatGPT、Cursor、Claude Code、Open Code 等 AI 工具使用的 prompt。

它要解决的问题很直接：每次开启新 AI 对话前，开发者都要重复解释项目结构、技术栈、模块职责、接口约定和业务背景。Code-ctx 把这些信息沉淀成可更新、可复用的上下文。

Code-ctx 不是 AI IDE，也不做代码补全、编辑器内联生成或通用 Agent 工作台。它的边界是生成、维护和复用 AI 可读的代码库上下文，并把这些上下文交给你选择的 AI 工具。

## 核心能力

| 能力 | 当前实现 |
|------|----------|
| 项目探测 | 内置 Vue 2/3、React、Next.js、uni-app、Java、Node.js、Go、Python 等项目类型适配器 |
| 文档生成 | `code-ctx init` 扫描项目并生成 `ai-docs/` |
| Prompt 生成 | `code-ctx use "任务"` 根据场景和文档生成上下文 prompt |
| 增量更新 | `code-ctx update` 通过 Git diff 或 hash 检测变化 |
| 健康检查 | `code-ctx doctor` 检查文档完整性和一致性，支持 `--fix` |
| 本地 Dashboard | Vue 3 + Express，可视化配置、AI 生成、项目和文档状态 |
| AI 协议 | OpenAI 兼容协议和 Anthropic 协议，支持 DeepSeek、Kimi、MiniMax 等兼容服务 |
| 安全过滤 | 对密码、API Key、JWT、SSH Key、数据库连接串等敏感信息做基础过滤 |

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git

### 安装和构建

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx
npm install
cd web && npm install && npm run build && cd ..
npm link
```

### 初始化你的项目

```bash
cd /path/to/your-project
code-ctx init
code-ctx use "新增用户登录功能"
```

默认会把 prompt 写入剪贴板。也可以输出到文件或终端：

```bash
code-ctx use "修复登录页面白屏问题" --out .ai-prompt.md
code-ctx use "新增订单导出" --stdout
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `code-ctx init` | 扫描项目，生成 `ai-docs/` |
| `code-ctx use [task]` | 生成开发 prompt |
| `code-ctx update` | 检测文件变化，生成增量更新 prompt |
| `code-ctx fix <alias>` | 重新生成指定子项目文档 |
| `code-ctx status` | 查看 `ai-docs/` 文档更新时间 |
| `code-ctx doctor` | 检查文档健康状态，支持 `--fix` |
| `code-ctx watch` | 监听文件变化，自动触发增量更新 |
| `code-ctx hook` | 管理 Git post-commit hook |
| `code-ctx dashboard` | 启动本地 Web 管理界面 |

常用参数：

```bash
code-ctx init --skip-ai
code-ctx init --force
code-ctx init -p web
code-ctx init -p api -d database

code-ctx use -s F "修复 AI 生成失败"
code-ctx use --no-ai-match "新增配置页"
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

## 配置

### 环境变量

复制 `.env.example` 为 `.env`，只在本地保存真实密钥：

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# 可选
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.5
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-6
DASHBOARD_TOKEN=
AI_TIMEOUT=180000
```

不要提交 `.env`。如果密钥曾出现在日志、截图、issue 或 PR 中，视为已泄露并立即轮换。

AI `baseUrl` 默认只接受公网 HTTPS 地址，并拒绝 localhost、内网、link-local 和 metadata 地址。需要对接本机模型网关时，应新增显式本地开发开关并配套测试，不要直接放开 Dashboard 配置校验。

### `code-ctx.config.js`

`init` 会生成项目配置，也可以手动维护：

```javascript
module.exports = {
  projectName: 'my-app',
  outputDir: './ai-docs',
  aiMode: 'clipboard',
  projects: [
    { alias: 'web', path: './web', type: 'vue3-admin', label: '前端' },
    { alias: 'api', path: './api', type: 'java-backend', label: '后端' }
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
      model: 'claude-sonnet-4-6',
      maxTokens: 4096
    }
  }
};
```

## Web Dashboard

```bash
code-ctx dashboard
```

默认访问 `http://localhost:3456`。Dashboard 读取的是被管理项目的 `code-ctx.config.js` 和 `ai-docs/`，可以在项目目录内启动，也可以用 `--dir` 指定项目目录。

Dashboard 当前包含：

- 配置管理
- AI 配置和连接测试
- 场景选择和 prompt 生成
- 子项目状态
- 场景模板预览
- 文档状态和健康检查入口

Dashboard 面向本机开发使用，不建议直接暴露到公网。

AI 配置接口会校验协议、baseUrl、模型名、maxTokens 和 API Key 基本格式；保存密钥时拒绝换行注入，并按本机权限能力以 `0o600` 写入 `.env`。

Dashboard API 基于 Express 5。维护 Web API 时请把 `req.body` 视为不可信输入，显式校验类型、长度和允许字段；`express.json()` 应设置合理 `limit`；错误处理中间件应使用 `(err, req, res, next)` 四参数签名并避免向客户端返回内部路径或堆栈。

## 项目结构

```text
codecontext/
├── bin/                  # CLI 入口和命令薄壳
├── src/
│   ├── commands/         # init/use/update/fix/doctor 等核心流程
│   ├── ai/               # OpenAI + Anthropic 原生 HTTP 客户端
│   ├── scanner/          # 项目探测和文件扫描
│   ├── adapters/         # 内置项目类型适配器
│   ├── generator/        # prompt 构建
│   ├── matcher/          # 场景匹配
│   ├── template/         # 模板引擎
│   ├── core/             # section 和文档映射
│   ├── utils/            # 配置、Git、过滤、剪贴板等工具
│   └── web/              # Express Dashboard API
├── web/                  # Vue 3 Dashboard 前端
├── templates/            # Prompt 模板和场景定义
├── tests/                # Jest 测试
```

## 路线图

建议执行顺序：

1. 完成配置加载、命令执行、路径访问、Web API 错误处理等公开前安全加固。
2. 补齐核心测试和覆盖率输出，重点覆盖配置、Git、section 更新、Web API 和 AI 客户端。
3. 优化 AI 上下文生成性能，包括 `init`、`update --apply`、状态页和前端构建体验。
4. 做架构整理，拆分大函数、清理硬编码、统一公共能力。
5. 补齐发布工程，包括 CI、release checklist、npm pack 校验和默认模型配置复核。详见 [`docs/release-checklist.md`](docs/release-checklist.md)。
6. 按需建设产品能力：JSON 配置、插件系统、文档质量评分、Dashboard 体验和 E2E smoke。

维护者本地可以保留 `docs/` 作为规划和审计资料，但 `docs/` 默认不上传 Git，也不进入 npm 发布包；
`docs/release-checklist.md` 是显式例外，作为公开发布门槛说明。

## 开发

```bash
npm test -- --runInBand
npm run coverage
npm run build:web
npm run check
node bin/cli.js help
node bin/cli.js dashboard
```

涉及前端改动时，请至少运行：

```bash
npm run build:web
```

涉及安全、路径、配置和 Web API 改动时，请补充相应测试。

## 已知风险

当前版本仍需重点处理：

- `loadConfigWithVM()` 配置执行安全。
- dashboard dev 命令和 Git 工具的命令构造。
- Dashboard 配置写入白名单和输入验证。
- AI baseUrl 和敏感 AI API 已有基础防护，后续仍需更细的 token/IP 限流策略和分布式部署方案。
- Web API 错误信息泄露和速率限制。
- `core/`、`web/middleware/`、`utils/git-utils.js` 的测试缺口。
- `init` 和 `update --apply` 的 AI 串行调用性能瓶颈。

## 参与贡献

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。提交 PR 前建议运行：

```bash
npm run check
```

安全问题请不要公开提交 issue，按 [SECURITY.md](SECURITY.md) 报告。

维护者建议在 GitHub 仓库设置中开启 [Private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository)，让安全研究者可以通过私有流程提交漏洞。

## 变更记录

见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

[Code-ctx Non-Commercial Source License](LICENSE) © hzh1117。仅允许非商业使用。

这不是 OSI 批准的开源许可证；如需商业使用、商业集成或 SaaS 托管，请先取得维护者书面授权。
