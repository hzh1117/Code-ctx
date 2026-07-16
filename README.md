<div align="center">

# Code-ctx

**AI 开发上下文工具，让 AI 编程助手快速理解你的代码库**

[![npm version](https://img.shields.io/npm/v/code-ctx.svg)](https://www.npmjs.com/package/code-ctx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![CI](https://github.com/hzh1117/Code-ctx/actions/workflows/ci.yml/badge.svg)](https://github.com/hzh1117/Code-ctx/actions/workflows/ci.yml)

[English](README_EN.md) | 中文

</div>

---

> **项目状态：** v1.0.0 已发布，CLI、本地 Dashboard、插件系统、JSON 配置、文档质量评分、任务历史与 token 预算等核心能力已上线。生产部署仍建议参考下文「已知风险」按需加固。

> **许可说明：** 本项目采用 [MIT 许可证](LICENSE)，允许个人和商业自由使用、修改、分发，无需支付费用或取得额外授权。

## 什么是 Code-ctx？

Code-ctx 是一个面向 AI 编程协作的 CLI 工具。它扫描项目结构，生成 `ai-docs/` 上下文文档，并根据开发任务自动组装适合 Claude、ChatGPT、Cursor、Claude Code、Open Code 等 AI 工具使用的 prompt。

它要解决的问题很直接：每次开启新 AI 对话前，开发者都要重复解释项目结构、技术栈、模块职责、接口约定和业务背景。Code-ctx 把这些信息沉淀成可更新、可复用的上下文。

Code-ctx 不是 AI IDE，也不做代码补全、编辑器内联生成或通用 Agent 工作台。它的边界是生成、维护和复用 AI 可读的代码库上下文，并把这些上下文交给你选择的 AI 工具。

## 核心能力

| 能力 | 当前实现 |
|------|----------|
| 项目探测 | 内置 Vue 2/3、React、Next.js、uni-app、Java、Node.js、Go、Python 等项目类型适配器 |
| 文档生成 | `code-ctx init` 扫描项目并生成 `ai-docs/` |
| Prompt 生成 | `code-ctx use "任务"` 按场景匹配文档生成上下文 prompt，内置 8 个场景（A–H） |
| 增量更新 | `code-ctx update` 通过 Git diff 或 hash 检测变化 |
| 健康检查 | `code-ctx doctor` 检查文档完整性和一致性，支持 `--fix` |
| 文档质量评分 | 完整度、新鲜度、风险三维度评分，输出 `OK / WARN / HIGH_RISK` 与 0–100 综合分 |
| 本地 Dashboard | Vue 3 + Express，可视化配置、AI 生成、项目状态、文档评分、安全与健康、任务历史 |
| AI 协议 | OpenAI 兼容协议和 Anthropic 协议，内置 OpenAI / Anthropic / DeepSeek / Kimi / MiniMax 五个服务商模板 |
| Token 预算 | `code-ctx use` 和 Dashboard 输出 prompt token 估算与超限警告 |
| 任务历史 | `use` / `update` 自动写入历史；不落盘原始 prompt，仅保留 hash、长度和脱敏 preview，自动轮转 |
| 配置格式 | 推荐 `code-ctx.config.json`（schema 校验、不可执行），兼容只读 `code-ctx.config.js` |
| 插件系统 | 通过 `plugins: [...]` 挂载本地路径或 npm 包，可贡献 adapters、scenarios、敏感词规则 |
| 安全过滤 | 对密码、API Key、JWT、SSH Key、数据库连接串等敏感信息做基础过滤 |

## 快速开始

### 环境要求

- **Node.js >= 20.0.0**（项目使用 commander 14、express 5 等现代依赖，需 Node 20+）
- Git

### 安装

从源码参与开发请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)，无需作为普通用户的安装步骤执行。

```bash
npm install -g code-ctx
# 或者无需全局安装
npx code-ctx --version
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

### `code-ctx.config.json`

`init` 默认生成 `code-ctx.config.json`（推荐）。JSON 配置不可执行任意代码，更安全，并由内置 schema 做轻量校验：

```json
{
  "projectName": "my-app",
  "outputDir": "./ai-docs",
  "aiMode": "clipboard",
  "projects": [
    { "alias": "web", "path": "./web", "type": "vue3-admin", "label": "前端" },
    { "alias": "api", "path": "./api", "type": "java-backend", "label": "后端" }
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

配置加载优先级：`code-ctx.config.json` > `code-ctx.config.js`。两者同时存在时，使用 JSON 并忽略 JS。

> **从 JS 迁移到 JSON**：把原 `code-ctx.config.js` 中 `module.exports = {...}` 的对象直接复制为 `code-ctx.config.json` 的内容（注意 key 加双引号），然后删除 `.js` 文件即可。Dashboard 和 `saveAIConfig` 会写回到当前生效的格式（即 JSON 优先）。

仍想使用 JS 配置时，`code-ctx.config.js` 完全保留可读兼容；新项目如需生成 JS 配置可使用 `code-ctx init --config-format=js`。注意：JS 配置在 VM 沙箱内加载，不允许 `require` 或访问 `process`。

### 插件系统（MVP）

在配置中通过 `plugins` 数组挂载自定义扩展：

```json
{
  "plugins": [
    "./my-plugin.js",
    "code-ctx-plugin-foo"
  ]
}
```

插件可以贡献：

- `adapters`：自定义项目类型适配器（继承 `BaseAdapter`）
- `scenarios`：追加或覆盖场景（按 `id` 覆盖内置）
- `sensitivePatterns` / `sensitiveDetectionPatterns`：内部敏感数据脱敏与扫描

最小示例见 [`examples/plugin-basic/`](examples/plugin-basic/)。插件加载失败只会输出 warning，不会破坏内置能力。

## Web Dashboard

```bash
code-ctx dashboard
```

默认访问 `http://localhost:3456`。Dashboard 读取的是被管理项目的 `code-ctx.config.js` 和 `ai-docs/`，可以在项目目录内启动，也可以用 `--dir` 指定项目目录。

Dashboard 当前包含：

- 配置管理
- AI 配置和连接测试（含服务商模板一键填充）
- 场景选择和 prompt 生成（含 token 预算提示）
- 子项目状态和文档质量评分
- 场景模板预览
- 安全与健康页（doctor、文档质量、敏感扫描、配置 schema、插件状态汇总）
- 任务历史（含 prompt diff，原始 prompt 不落盘）

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
│   ├── plugins/          # 插件加载和状态合并
│   ├── utils/            # 配置、Git、过滤、token 估算、任务历史等工具
│   └── web/              # Express Dashboard API
├── web/                  # Vue 3 Dashboard 前端
├── templates/            # Prompt 模板和场景定义
├── tests/                # Jest 测试
```

## 路线图

v1.0.0 后的优先方向：

1. 收紧仍待加固的安全面：`loadConfigWithVM()` 沙箱、dashboard dev 与 Git 工具的命令构造、Web API 统一错误处理与更细的 token/IP 限流策略。
2. 补齐覆盖缺口：`core/`、`web/middleware/`、`utils/git-utils.js`、内置适配器和插件加载的直接测试。
3. 性能优化：`init` 与 `update --apply` 的 AI 串行调用、扫描阶段的 mtime 预筛选与 Dashboard 状态页缓存。
4. AI 客户端增强：流式输出、请求取消、超出 token 时的自动截断或分段策略。
5. 插件生态：示例插件、官方适配器模板和插件 schema 校验。

维护者本地可以保留 `docs/` 作为规划和审计资料，但 `docs/` 默认不上传 Git，也不进入 npm 发布包。

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

v1.0.0 已加固：AI baseUrl 默认拒绝非 HTTPS / 本机 / 内网 / metadata 地址并校验 DNS 解析结果；Dashboard 保存 API Key 时校验协议、baseUrl、模型名与换行注入；敏感 AI API 加入内存级基础限流；`tokenAuth` 使用 `crypto.timingSafeEqual` + 长度预检规避时序旁路。

当前版本仍需重点处理：

- `loadConfigWithVM()` 配置执行的沙箱边界。
- dashboard dev 命令和 Git 工具的命令构造。
- Web API 统一错误处理与更细粒度的速率限制（多进程 / 分布式部署场景）。
- `core/`、`web/middleware/`、`utils/git-utils.js` 与内置适配器的测试缺口。
- `init` 和 `update --apply` 的 AI 串行调用性能瓶颈。

Dashboard 面向本机开发使用，不建议直接暴露到公网。

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

[MIT License](LICENSE) © 2026 hzh1117。
