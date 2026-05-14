<div align="center">

# Code-ctx

**AI 开发上下文工具 — 让 AI 编程助手立刻"认识"你的代码库**

[![npm version](https://img.shields.io/npm/v/code-ctx.svg)](https://www.npmjs.com/package/code-ctx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

[English](README_EN.md) | 中文

</div>

---

> **⚠️ 项目状态：积极开发中** — 核心功能已可用，API 可能变动。欢迎试用和反馈。

## 什么是 Code-ctx？

Code-ctx 是一个 CLI 工具，解决 AI 编程助手与代码库之间的"上下文鸿沟"。它扫描项目、生成结构化文档，并自动为 Claude、ChatGPT、Cursor 等 AI 工具准备上下文感知的 prompt。

**痛点：** 每次开启新的 AI 对话，都要花 10-15 分钟解释项目结构、技术栈和开发规范。

**方案：** 运行一次 `code-ctx init`，之后每次 AI 对话前执行 `code-ctx use "你的任务"`，AI 秒懂你的项目。

## 功能特性

| 功能 | 说明 |
|------|------|
| **智能项目探测** | 自动识别 9 种项目类型（Vue 2/3、React、Next.js、uni-app、Java、Node.js、Go、Python） |
| **智能场景匹配** | 关键词 + AI 双重匹配，将任务描述映射到 8 种开发场景 |
| **场景化模板** | 新功能、Bug 修复、重构等场景生成定制化 prompt |
| **文档自动注入** | 自动加载 OVERVIEW 总览和相关子项目文档 |
| **增量更新** | 通过 Git diff 或 MD5 检测文件变化，仅更新受影响的章节 |
| **健康检查 + 自动修复** | 检测文档完整性和一致性，支持 `--fix` 自动修复过期文档 |
| **容错机制** | init 中断后可续跑，自动跳过已完成的子项目 |
| **Web 管理面板** | 终端工业风 UI，支持明暗主题，可视化配置和状态管理 |
| **安全优先** | 自动过滤密码、API Key、JWT Token、SSH 密钥、数据库连接串 |
| **AI API 集成** | 兼容 OpenAI 和 Anthropic 协议，支持 DeepSeek、Kimi、MiniMax 等 |
| **剪贴板降级** | 超大内容写入失败时自动降级到文件输出 |

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git（任意版本）

### 安装

```bash
# 克隆项目
git clone https://gitee.com/yo-yo-lu-mingming/code-ctx.git
cd code-ctx

# 安装依赖
npm install

# 构建前端
cd web && npm install && npm run build && cd ..

# 全局链接
npm link

# 启动 Web 管理面板（可选）
code-ctx dashboard
```

访问 `http://localhost:3456` 可使用可视化配置、AI 生成、文档状态管理等功能。

### 验证安装

```bash
code-ctx --version
code-ctx help
```

## 使用方式

### 首次使用：初始化项目

```bash
cd /path/to/your-project

# 扫描项目结构，生成 ai-docs/
code-ctx init

# 根据任务描述生成 prompt
code-ctx use "新增用户登录功能"

# 打开 AI 工具（Claude/ChatGPT/Cursor），粘贴 prompt
```

### 日常开发

```bash
# 智能场景匹配
code-ctx use "商户后台新增优惠券导出功能"

# 手动指定场景
code-ctx use -s F "修复登录页面白屏问题"

# 输出到文件（方便编辑后再用）
code-ctx use "任务描述" --out .ai-prompt.md
```

### 代码变更后更新文档

```bash
# 检测变化，生成增量更新 prompt
code-ctx update

# 强制重新生成某个子项目的文档
code-ctx fix web
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `code-ctx init` | 扫描项目，生成 `ai-docs/` 目录 |
| `code-ctx use [task]` | 生成开发 prompt，复制到剪贴板 |
| `code-ctx update` | 检测文件变化，生成增量更新 prompt |
| `code-ctx fix <alias>` | 强制重新生成指定子项目文档 |
| `code-ctx status` | 查看文档状态（大小、最后修改时间） |
| `code-ctx doctor` | 检查文档健康状态，支持 `--fix` 自动修复 |
| `code-ctx dashboard` | 启动本地 Web 管理界面 |
| `code-ctx watch` | 监听文件变化，自动触发增量更新 |
| `code-ctx hook` | 管理 git post-commit hook |

### 命令参数

```bash
# init
code-ctx init              # 正常初始化
code-ctx init --skip-ai    # 只扫描，不调用 AI 生成文档
code-ctx init --force      # 强制全部重新生成

# use
code-ctx use "任务描述"              # 智能匹配场景
code-ctx use -s B "任务描述"         # 手动指定场景（A-H）
code-ctx use "任务描述" --stdout     # 输出到终端
code-ctx use "任务描述" --out p.md   # 输出到文件

# update
code-ctx update              # 检测变化并生成 prompt
code-ctx update --dry-run    # 只检测，不更新扫描记录
code-ctx update --stdout     # 输出到终端

# fix
code-ctx fix web             # 重新生成 web.md
code-ctx fix web --dry-run   # 只生成 prompt，不调用 AI

# doctor
code-ctx doctor              # 基本健康检查
code-ctx doctor --strict     # 严格模式（解析代码路由）
code-ctx doctor --fix        # 自动修复过期/缺失文档
code-ctx doctor --fix --force  # 强制重新生成所有文档

# dashboard
code-ctx dashboard           # 默认端口 3456
code-ctx dashboard -p 8080   # 自定义端口
code-ctx dashboard --dir D:/workspace/your-project  # 指定要管理的项目目录
```

## 支持的项目类型

| 类型 | 检测方式 |
|------|----------|
| Vue 2 管理后台 | `package.json` 含 `vue` + `element-ui` |
| Vue 3 管理后台 | `package.json` 含 `vue` + `@element-plus` |
| React | `package.json` 含 `react` |
| Next.js | `package.json` 含 `next` |
| uni-app 小程序 | `package.json` 含 `uni-app` 或 `manifest.json` |
| Java 后端 | `pom.xml` 或 `build.gradle` |
| Node.js 后端 | `package.json` 含 `express`/`koa`/`nestjs` |
| Go 后端 | `go.mod` |
| Python 后端 | `requirements.txt` 或 `pyproject.toml` |

## 场景模板

| ID | 场景 | 说明 | 关联项目 |
|----|------|------|----------|
| A | C 端新功能 | 新增小程序/H5/前端页面 | mp, api |
| B | 商户后台新功能 | 新增管理功能 | mer, api |
| C | 平台后台新功能 | 新增运营功能 | plat, api |
| D | 数据模型变更 | 修改表结构 | api |
| E | 修改已有功能 | 优化、重构 | — |
| F | 排查 Bug | 定位和修复问题 | — |
| G | 纯后端改动 | 后端逻辑调整 | api |
| H | 跨端功能 | 多端联动 | mp, mer, api |

## 配置说明

### 环境变量（.env）

```env
# Anthropic API Key（Claude 或兼容服务）
ANTHROPIC_API_KEY=sk-ant-xxx

# OpenAI 兼容 API Key（DeepSeek、Kimi、MiniMax 等）
OPENAI_API_KEY=sk-xxx

# 可选：覆盖默认服务地址
# OPENAI_BASE_URL=https://api.deepseek.com
# OPENAI_MODEL=deepseek-chat
# ANTHROPIC_BASE_URL=https://api.anthropic.com
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### 项目配置（code-ctx.config.js）

`init` 命令自动生成，也可手动编辑：

```javascript
module.exports = {
  projectName: 'my-app',
  outputDir: './ai-docs',
  aiMode: 'clipboard',           // 'clipboard' | 'api'
  projects: [
    { alias: 'web', path: './web', type: 'vue2-admin', label: '前端' },
    { alias: 'api', path: './api', type: 'java-backend', label: '后端' }
  ],
  excludeDirs: ['node_modules', '.git', 'dist'],
  gitTrack: true,                // 将 ai-docs/ 纳入 git
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

## AI API 服务商

支持所有兼容 OpenAI 或 Anthropic 协议的大模型。

| 服务商 | 协议 | Base URL | 模型示例 |
|--------|------|----------|----------|
| DeepSeek | OpenAI | `https://api.deepseek.com` | `deepseek-chat` |
| Kimi | OpenAI | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| MiniMax | OpenAI | `https://api.minimax.chat` | `abab6.5-chat` |
| 智谱 AI | OpenAI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4` |
| 百川 | OpenAI | `https://api.baichuan-ai.com/v1` | `Baichuan4` |
| Anthropic | Anthropic | `https://api.anthropic.com` | `claude-3-5-sonnet-20241022` |

## 与 AI 工具配合

### Claude Code / Cursor / Open Code

```bash
# 方式 1：剪贴板（默认）
code-ctx use "任务描述"
# 在 AI 工具中 Ctrl+V 粘贴

# 方式 2：文件输出
code-ctx use "任务描述" --out .ai-prompt.md
# 在 AI 工具中引用：请阅读 .ai-prompt.md

# 方式 3：stdout 管道
code-ctx use "任务描述" --stdout | claude
```

### 网页版 ChatGPT / Claude

```bash
code-ctx use "任务描述"
# 打开网页，Ctrl+V 粘贴
```

## Web 管理面板

```bash
code-ctx dashboard
```

访问 `http://localhost:3456`：

Dashboard 读取的是“被管理项目”的 `code-ctx.config.js` 和 `ai-docs/`。可以在项目目录内启动，也可以在任意位置用 `--dir` 指定项目目录：

```bash
# 方式一：cd 到项目目录运行
cd D:/workspace/你的项目
code-ctx dashboard

# 方式二：在任意位置指定项目目录
code-ctx dashboard --dir D:/workspace/你的项目
```

- **配置管理** — 可视化编辑项目配置
- **AI 配置** — Tab 切换 OpenAI/Anthropic 协议，连接状态实时检测
- **AI 生成** — 左右分栏：场景选择 + prompt 生成 + AI 调用
- **子项目** — 卡片式展示检测到的子项目
- **场景模板** — 浏览和预览 8 种场景模板
- **文档状态** — 表格展示文档健康状态（正常/待更新/缺失）

设计风格：终端工业风、明暗主题切换、Outfit + JetBrains Mono 字体、CSS 变量管理。

## 架构设计

```
code-ctx/
├── bin/                    # CLI 入口
│   ├── cli.js              # 主入口（Commander.js）
│   └── commands/           # 9 个命令定义
├── src/                    # 核心模块
│   ├── commands/           # 命令实现
│   ├── scanner/            # 项目探测 + 文件扫描
│   ├── generator/          # prompt 组装
│   ├── template/           # 模板引擎
│   ├── matcher/            # 场景匹配（关键词 + AI）
│   ├── ai/                 # AI 客户端（OpenAI + Anthropic）
│   ├── adapters/           # 项目类型适配器（9 个内置）
│   │   └── builtin/        # Vue2, Vue3, React, Next.js, uni-app, Java, Node, Go, Python
│   ├── core/               # 文档解析、章节解析器
│   ├── web/                # Express API 服务
│   └── utils/              # 配置、常量、Git、敏感信息过滤、剪贴板
├── templates/              # 内置场景模板
├── web/                    # 前端（Vue 3 + Vite）
│   ├── src/
│   │   ├── components/     # 侧边栏
│   │   ├── composables/    # useTheme 主题切换
│   │   ├── views/          # 6 个页面
│   │   ├── App.vue         # 根组件 + CSS 变量
│   │   └── main.js         # 入口 + 路由
│   └── dist/               # 构建产物
└── tests/                  # Jest 测试套件
```

### 核心设计模式

- **适配器模式** — 通过 `BaseAdapter` + `AdapterRegistry` 实现可扩展的项目类型探测
- **策略模式** — 基于 token 估算的策略选择（ONE_SHOT / BATCH_WITH_CONTEXT / BATCH_MINIMAL）
- **章节级更新** — 解析 markdown 章节结构，实现精准的文档局部更新
- **容错机制** — 状态文件追踪（`init-state.json`），支持中断后恢复

## 常见问题

**Q: init 中断了怎么办？**
重新运行即可，已完成的子项目会自动跳过。

**Q: 剪贴板写入失败？**
自动降级到 `.ai-prompt.md` 文件输出，也可主动使用 `--out` 参数。

**Q: 如何更新文档？**
```bash
code-ctx update          # 检测变化
code-ctx fix web         # 强制重新生成
code-ctx doctor --fix    # 自动修复过期文档
```

**Q: 支持多人协作吗？**
将 `ai-docs/` 目录提交到 git，团队成员共享同一份上下文文档。

**Q: 如何扩展项目类型支持？**
在 `src/adapters/builtin/` 下创建新的适配器，继承 `BaseAdapter`。

## 开发

```bash
git clone https://gitee.com/yo-yo-lu-mingming/code-ctx.git
cd code-ctx
npm install
cd web && npm install && npm run build && cd ..
npm link

# 运行测试
npm test

# 启动管理面板
code-ctx dashboard
```

## 参与贡献

欢迎贡献！请：

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'feat: add amazing feature'`）
4. 推送分支（`git push origin feature/amazing-feature`）
5. 提交 Pull Request

## 许可证

[MIT](LICENSE) © hzh1117
