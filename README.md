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

> **项目状态：** v1.1.1 已在 Gitee 封板；当前 `master` 已完成技术问题清单中的全部 P0-P3。npm registry 暂仍是旧版 `1.0.0`，在 registry 更新前请使用下方 Gitee 标签安装。初始化、增量更新、事实校验、隐私过滤、AI 请求控制和工程门禁已经过完整回归。

> **许可说明：** 本项目采用 [MIT 许可证](LICENSE)，允许个人和商业自由使用、修改、分发，无需支付费用或取得额外授权。

## 什么是 Code-ctx？

Code-ctx 是一个面向 AI 编程协作的 CLI 工具。它扫描项目结构，生成 `ai-docs/` 上下文文档，并根据开发任务自动组装适合 Claude、ChatGPT、Cursor、Claude Code、Open Code 等 AI 工具使用的 prompt。

它要解决的问题很直接：每次开启新 AI 对话前，开发者都要重复解释项目结构、技术栈、模块职责、接口约定和业务背景。Code-ctx 把这些信息沉淀成可更新、可复用的上下文。

Code-ctx 不是 AI IDE，也不做代码补全、编辑器内联生成或通用 Agent 工作台。它的边界是生成、维护和复用 AI 可读的代码库上下文，并把这些上下文交给你选择的 AI 工具。

## 核心能力

| 能力 | 当前实现 |
|------|----------|
| 项目探测 | 内置 Vue 2/3、React、Next.js、uni-app、Java、Node.js、Go、Python 及 generic JS/TS/backend/unknown 适配器，扫描模式可配置覆盖 |
| 文档生成 | `code-ctx init` 扫描项目并生成 `ai-docs/`；`--skip-ai` 生成确定性 Markdown、OVERVIEW 和项目 manifest |
| Prompt 生成 | `code-ctx use "任务"` 按场景匹配文档生成上下文 prompt，内置 8 个场景（A–H） |
| 增量更新 | `code-ctx update` 通过 Git diff 或 hash 检测新增、修改和删除；`--apply` 只更新有源码证据影响的 section |
| 健康检查 | `code-ctx doctor` 检查文档完整性和一致性，支持 `--fix` |
| 文档质量评分 | 完整度、新鲜度、风险和 manifest 事实证据评分，输出 `OK / WARN / HIGH_RISK` 与 0–100 综合分 |
| 本地 Dashboard | Vue 3 + Express，可视化配置、AI 生成、项目状态、文档评分、安全与健康、任务历史 |
| AI 协议 | OpenAI 兼容协议和 Anthropic 协议，内置 OpenAI / Anthropic / DeepSeek / Kimi / MiniMax 五个服务商模板 |
| Token 预算 | 按实际序列化请求计算输入预算，独立保留输出 token 配额，并校验续写结构完整性 |
| 任务历史 | `use` / `update` 自动写入历史；不落盘原始 prompt，仅保留 hash、长度和脱敏 preview，自动轮转 |
| 配置格式 | 推荐 `code-ctx.config.json`（schema 校验、不可执行），兼容只读 `code-ctx.config.js` |
| 插件系统 | 通过 `plugins: [...]` 挂载本地路径或 npm 包，可贡献 adapters、scenarios、敏感词规则 |
| 安全过滤 | 所有出站 AI 消息统一过滤密钥、连接串和绝对路径，支持无原值的结构化脱敏审计 |
| AI 请求控制 | 单次请求 timeout 与 5 分钟总 deadline 分离；普通、续写、流式和重试等待均支持 AbortSignal，CLI 可用 Ctrl+C 清理取消 |

## 快速开始

### 环境要求

- **Node.js >= 20.0.0**（项目使用 commander 14、express 5 等现代依赖，需 Node 20+）
- Git（当前 Gitee 标签安装需要；运行时用于精确增量 diff，非 Git 项目会退回文件 hash 检测）

### 安装

从源码参与开发请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)，无需作为普通用户的安装步骤执行。

```bash
npm install -g git+https://gitee.com/yo-yo-lu-mingming/code-ctx.git#v1.1.1
code-ctx --version
```

版本应为 `1.1.1`。旧的 npm `1.0.0` 不包含当前的配置向导和完整发布门禁；npm registry 发布 `1.1.1` 后，安装命令会恢复为 `npm install -g code-ctx@latest`。

### 60 秒无密钥体验

这条路径不会连接外部 AI，适合先确认扫描、文档和 Prompt 流程是否适合你的项目：

```bash
cd /path/to/your-project
code-ctx init --skip-ai
code-ctx config validate
code-ctx doctor
code-ctx use -s A --no-ai-match --non-interactive "了解项目结构" --stdout
```

成功后，项目根目录会新增 `code-ctx.config.json` 和 `ai-docs/`；`ai-docs/OVERVIEW.md` 是总览，其他 Markdown 对应探测到的子项目。`--stdout` 会直接在终端显示 Prompt，不依赖系统剪贴板。

### 使用 AI 生成详细文档

在一个尚未初始化的项目根目录中运行：

```bash
cd /path/to/your-project
code-ctx config setup
code-ctx init
code-ctx config validate
code-ctx doctor
code-ctx use "新增用户登录功能" --stdout
```

`config setup` 会让你选择服务商、确认 API 地址和模型、输入 API Key，并测试连接。它自动创建或更新 `.env`、`.gitignore` 和 `code-ctx.config.json`；`init` 随后补齐探测到的项目字段并生成 `ai-docs/`。如果你已经运行过无密钥体验，配置 AI 后使用 `code-ctx init --force` 重新生成详细文档。

不加 `--stdout` 时，Prompt 默认写入剪贴板；也可以输出到文件：

```bash
code-ctx use "修复登录页面白屏问题" --out .ai-prompt.md
```

### 不全局安装

使用 `npm exec` 时，每条命令都需要保留完整包参数，不能与全局命令混用：

```bash
npm exec --yes --package=git+https://gitee.com/yo-yo-lu-mingming/code-ctx.git#v1.1.1 -- code-ctx --version
npm exec --yes --package=git+https://gitee.com/yo-yo-lu-mingming/code-ctx.git#v1.1.1 -- code-ctx init --skip-ai
npm exec --yes --package=git+https://gitee.com/yo-yo-lu-mingming/code-ctx.git#v1.1.1 -- code-ctx config validate
npm exec --yes --package=git+https://gitee.com/yo-yo-lu-mingming/code-ctx.git#v1.1.1 -- code-ctx doctor
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
| `code-ctx config validate/migrate/setup` | 校验、迁移或引导配置项目与 AI provider |

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

`init --skip-ai` 不需要 API Key，会生成只包含扫描证据的确定性文档。AI 模式下，`project-manifest.json` 是文档归属和事实验证的信任锚；`update --apply` 遇到无法确认影响范围的变化时不会猜测 section，也不会提交扫描基线。AI 请求默认单次超时为 180 秒、整个生成操作上限为 5 分钟，按 Ctrl+C 会取消活动请求和重试等待。

## 配置

### 环境变量

推荐使用 `code-ctx config setup`，它会在项目根目录安全创建或更新 `.env`，并确保 `.gitignore` 包含 `.env`。只有需要手动配置时，才自行创建 `.env`：

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

仓库和 npm 包中的 `.env.example` 只是字段参考，不需要复制到被管理项目；不要用它覆盖 `config setup` 已生成的 `.env`。

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

> **从 JS 迁移到 JSON**：运行 `code-ctx config migrate`。命令会静态解析 `module.exports = {...}`、备份旧文件并写入 `code-ctx.config.json`；Dashboard 和 `saveAIConfig` 的后续变更也统一写入 JSON。

旧 `code-ctx.config.js` 只保留静态只读兼容：加载器提取 `module.exports = {...}` 对象并使用 JSON5 解析，不执行 JavaScript，也不允许 `require`、`process`、函数调用或计算表达式。推荐运行 `code-ctx config migrate` 生成带备份的 JSON 配置；所有后续写入都使用 `code-ctx.config.json`。

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

最小示例见 [`examples/plugin-basic/`](examples/plugin-basic/)。插件是会执行代码的 Node.js 模块，只应加载已审查的来源。交互式终端会要求首次确认并持久化信任；CI 等非交互环境必须用 `CODE_CTX_PLUGINS_ALLOW` 精确放行，`CODE_CTX_PLUGINS_ALLOW_ALL=1` 仅用于已隔离的测试环境。插件加载失败只会输出 warning，不会破坏内置能力。

## Web Dashboard

```bash
code-ctx dashboard
```

默认访问 `http://localhost:3456`。Dashboard 读取的是被管理项目的 `code-ctx.config.json`（兼容静态旧 JS 配置）和 `ai-docs/`，可以在项目目录内启动，也可以用 `--dir` 指定项目目录。

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

P0-P3 技术问题清单完成后的持续改进方向：

1. 按 [`TYPE_CHECKING.md`](TYPE_CHECKING.md) 分阶段扩大 `checkJs`，最终覆盖 Adapter、命令、Web API 和 Vue 前端。
2. 持续升级 ESLint、Vite、Glob 等工具链与生产依赖，保持 Node 20/22 和 Windows/Ubuntu 兼容。
3. 扩展 provider 兼容性 smoke、失败诊断和长期趋势记录，同时保持真实凭据测试为显式 opt-in。
4. 完善发布自动化、版本说明和 npm provenance，并持续验证安装包只包含预期产物。
5. 如需公网或多进程部署 Dashboard，增加持久化限流、独立认证、代理信任边界和部署级安全基线。

维护者本地可以保留 `docs/` 作为规划和审计资料，但 `docs/` 默认不上传 Git，也不进入 npm 发布包。

## 开发

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

`npm run check` 会按顺序执行格式检查、根 CLI/后端/Vue lint、增量 `checkJs`、普通测试、带阈值覆盖率、Web 生产构建和真实 npm 打包安装 smoke。CI 在 Ubuntu Node 20/22 上运行完整门禁，并在 Windows Node 20 上执行 CLI/package smoke；根项目和 Dashboard 的生产依赖 high/critical 审计会阻断 CI。

涉及前端改动时，请至少运行：

```bash
npm run build:web
```

涉及安全、路径、配置和 Web API 改动时，请补充相应测试。

## 已知风险

当前 `master` 已完成技术问题清单中的全部 P0-P3：源码证据和变更证据会进入受预算约束的 Prompt；init/update 使用写盘后提交状态的事务边界；manifest 驱动文档归属和事实校验；出站消息统一脱敏；AI 请求支持总 deadline 和 Ctrl+C 取消；格式、类型、覆盖率、跨平台 smoke 与依赖审计均已进入门禁。此前的 baseUrl SSRF、Dashboard 密钥写入和 token 时序比较加固仍然有效。

当前剩余风险主要是部署和持续维护边界：

- 旧 `code-ctx.config.js` 虽不再执行代码，但仅支持静态对象语法；应迁移到严格校验的 `code-ctx.config.json`。
- Dashboard 只面向本机；内存级限流不适用于多进程或分布式公网部署。
- 当前 `checkJs` 是增量范围，未覆盖的历史 JavaScript 仍需按迁移计划逐步纳入。
- nightly provider smoke 需要外部凭据且为显式 opt-in，不能保证所有第三方兼容端点持续可用。
- 自动事实校验依赖 manifest 与源码证据，不能替代发布前人工审查私有文档。

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
