# Code-ctx

> **⚠️ 项目状态：开发中 (In Development)** — 本项目尚未完成，部分功能可能不稳定或不可用。欢迎试用和反馈，但请勿用于生产环境。

> AI 开发上下文工具 - 让 AI 编程助手立刻"认识"你的代码库

[English](README_EN.md) | 中文

[![npm version](https://img.shields.io/npm/v/code-ctx.svg)](https://www.npmjs.com/package/code-ctx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

Code-ctx 是一个 CLI 工具，帮助 AI 编程助手（如 Claude、ChatGPT、Cursor 等）快速理解你的项目结构。它会扫描项目、生成结构化文档，并根据你的任务描述自动准备最合适的 prompt。

## 特性

- 🔍 **智能项目探测** - 自动识别 8 种项目类型（Vue、React、Java、Go 等）
- 🧠 **智能场景匹配** - 描述任务自动匹配最佳开发场景，无需手动选择
- 📝 **场景化模板** - 8 种开发场景（新功能、修 Bug、重构等）生成定制 prompt
- 📄 **文档自动注入** - 自动加载 OVERVIEW 和相关子项目文档，AI 无需手动指定
- 🔄 **增量更新** - 只更新变化的文件，生成增量更新 prompt
- 🏥 **健康检查 + 自动修复** - 检测文档完整性、一致性，支持 `--fix` 自动修复过期文档
- 💾 **容错机制** - init 中断后可续跑，自动跳过已完成的子项目
- 🖥️ **Web 管理** - 终端工业风 UI，支持明暗主题切换，可视化配置、场景模板、文档状态管理
- 📋 **剪贴板降级** - 超大内容写入失败时自动降级到文件输出
- 🔒 **安全优先** - 自动过滤敏感信息（密码、密钥等）
- 🤖 **AI API 集成** - 兼容 OpenAI 和 Anthropic 协议，支持 DeepSeek、Kimi、MiniMax 等
- 📊 **任务历史** - 记录生成过的 prompt，方便回溯和复用

---

## 本地部署

### 环境要求

| 依赖 | 最低版本 | 检查命令 |
|------|----------|----------|
| Node.js | 16.0.0+ | `node -v` |
| npm | 8.0.0+ | `npm -v` |
| Git | 任意 | `git --version` |

### 第一步：克隆项目

```bash
git clone https://gitee.com/yo-yo-lu-mingming/code-ctx.git
cd code-ctx
```

### 第二步：安装后端依赖

```bash
npm install
```

### 第三步：构建前端

```bash
cd web
npm install
npm run build
cd ..
```

构建完成后，`web/dist/` 目录会生成前端静态文件，Dashboard 启动时会自动加载。

### 第四步：全局链接

```bash
npm link
```

这会在全局创建 `code-ctx` 命令的软链接，之后在任意目录都可以使用 `code-ctx` 命令。

### 第五步：验证安装

```bash
code-ctx --version
code-ctx help
```

看到版本号和帮助信息即表示安装成功。

---

## 快速使用

### 场景一：首次使用（初始化 + 生成 prompt）

```bash
# 1. 进入你的项目目录
cd /path/to/your-project

# 2. 初始化（扫描项目结构，生成 ai-docs/）
code-ctx init

# 3. 生成 prompt（智能匹配场景）
code-ctx use "新增用户登录功能"

# 4. 打开 AI 工具（Claude/ChatGPT/Cursor），粘贴 prompt
```

### 场景二：日常开发（已有 ai-docs/）

```bash
# 直接生成 prompt
code-ctx use "商户后台新增优惠券导出功能"

# 指定场景
code-ctx use -s F "修复登录页面白屏问题"

# 输出到文件（方便编辑后再用）
code-ctx use "任务描述" --out .ai-prompt.md
```

### 场景三：代码变更后更新文档

```bash
# 检测变化，生成增量更新 prompt
code-ctx update

# 强制重新生成某个子项目的文档
code-ctx fix web
```

---

## 命令详解

### `code-ctx init`

初始化项目，扫描结构并生成 `ai-docs/` 目录。

```bash
code-ctx init              # 正常初始化
code-ctx init --skip-ai    # 只扫描，不调用 AI 生成文档
code-ctx init --force      # 强制重新生成，忽略已完成状态
```

**流程：**
1. 扫描项目目录，检测子项目类型
2. 提取关键文件（API、路由、配置等）
3. 调用 AI 生成结构化文档（需配置 API Key）
4. 检查生成文档中是否包含敏感信息
5. 写入 `ai-docs/` 目录

**容错机制：** 如果 init 中断（网络问题、API 超时等），重新运行会自动跳过已完成的子项目。

### `code-ctx use [task]`

生成开发 prompt，复制到剪贴板。

```bash
code-ctx use "任务描述"              # 智能匹配场景
code-ctx use -s B "任务描述"         # 手动指定场景
code-ctx use "任务描述" --stdout     # 输出到终端
code-ctx use "任务描述" --out p.md   # 输出到文件
```

**智能模式流程：**
1. 分析任务描述，匹配最佳场景（A-H）
2. 加载 `ai-docs/OVERVIEW.md`（项目总览）
3. 加载相关子项目文档（如商户端任务会加载 `mer.md`）
4. 组装完整 prompt 并复制到剪贴板

### `code-ctx update`

检测文件变化，生成增量更新 prompt。

```bash
code-ctx update              # 检测变化并生成 prompt
code-ctx update --dry-run    # 只检测变化，不更新扫描记录
code-ctx update --stdout     # 输出到终端
```

### `code-ctx fix <alias>`

强制重新生成指定子项目的文档。

```bash
code-ctx fix web             # 调用 AI 重新生成 web.md
code-ctx fix web --dry-run   # 只生成 prompt，不调用 AI
```

### `code-ctx status`

查看 `ai-docs/` 中各文档的状态（大小、最后修改时间）。

```bash
code-ctx status
```

### `code-ctx doctor`

检查文档健康状态，支持自动修复。

```bash
code-ctx doctor              # 基本检查
code-ctx doctor --strict     # 严格模式（解析代码路由）
code-ctx doctor --fix        # 自动修复文档（调用 AI）
code-ctx doctor --fix --force  # 强制重新生成所有文档
```

**检查项目：**
- 配置与实际目录的一致性（未配置的子项目）
- 文档完整性（内容量、必要章节）
- 文档与代码的一致性（关键文件提及率、目录结构匹配）
- 是否包含密码、密钥等敏感信息
- API 路由记录完整性（严格模式）

**自动修复（`--fix`）：**
- 检测过期文档（关键文件提及率 < 30%）
- 重新生成缺失或过期的子项目文档
- 重新生成 OVERVIEW.md

### `code-ctx dashboard`

启动本地 Web 管理界面。

```bash
code-ctx dashboard           # 默认端口 3456
code-ctx dashboard -p 8080   # 指定端口
```

访问 `http://localhost:3456`，功能包括：

**界面特性：**
- 终端工业风设计，信息密度高，适合开发者使用习惯
- 支持深色/浅色主题切换，主题偏好自动保存到 localStorage
- 使用 Outfit + JetBrains Mono 字体组合，技术值等宽显示
- 所有颜色通过 CSS 变量管理，主题切换无闪烁

**页面说明：**
- **配置管理** (`/`) - 可视化编辑项目配置，表格展示子项目列表
- **AI 配置** (`/ai`) - Tab 切换 OpenAI/Anthropic 协议配置，连接状态实时显示
- **AI 生成** (`/ai-generate`) - 左右分栏布局，选择场景生成 prompt 并调用 AI
- **子项目** (`/projects`) - 卡片式展示检测到的子项目
- **场景模板** (`/scenarios`) - 左侧场景列表 + 右侧模板内容预览
- **文档状态** (`/status`) - 表格展示文档健康状态（正常/待更新/缺失）

---

## 配置说明

### 环境变量（.env）

在项目根目录创建 `.env` 文件，配置 API Key：

```env
# Anthropic API Key（Claude 或兼容服务）
ANTHROPIC_API_KEY=sk-ant-xxx

# OpenAI 兼容 API Key（DeepSeek、Kimi、MiniMax 等）
OPENAI_API_KEY=sk-xxx

# 可选：覆盖默认服务地址和模型
# OPENAI_BASE_URL=https://api.deepseek.com
# OPENAI_MODEL=deepseek-chat
# ANTHROPIC_BASE_URL=https://api.anthropic.com
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### 项目配置（code-ctx.config.js）

`init` 命令会自动生成，也可手动编辑：

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
  gitTrack: true,                // 是否将 ai-docs/ 纳入 git
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

## 支持的项目类型

| 类型 | 特征文件 |
|------|----------|
| Vue2 管理后台 | `package.json` 含 `vue` + `element-ui` |
| Vue3 管理后台 | `package.json` 含 `vue` + `@element-plus` |
| React | `package.json` 含 `react` |
| uni-app 小程序 | `package.json` 含 `uni-app` 或 `manifest.json` |
| Java 后端 | `pom.xml` 或 `build.gradle` |
| Node.js 后端 | `package.json` 含 `express`/`koa`/`nestjs` |
| Go 后端 | `go.mod` |
| Python 后端 | `requirements.txt` 或 `pyproject.toml` |

## 场景模板

| 场景 | 说明 | 典型任务 |
|------|------|----------|
| A | C 端新功能 | 新增小程序/H5/前端页面 |
| B | 商户后台新功能 | 新增管理功能 |
| C | 平台后台新功能 | 新增运营功能 |
| D | 数据模型变更 | 修改表结构 |
| E | 修改已有功能 | 优化、重构 |
| F | 排查 Bug | 定位和修复问题 |
| G | 纯后端改动 | 后端逻辑调整 |
| H | 跨端功能 | 多端联动 |

---

## AI API 集成

支持所有兼容 OpenAI 和 Anthropic 接口协议的大模型。

### 支持的服务商

| 服务商 | 协议 | baseUrl | 模型示例 |
|--------|------|---------|----------|
| DeepSeek | OpenAI | `https://api.deepseek.com` | `deepseek-chat` |
| Kimi | OpenAI | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| MiniMax | OpenAI | `https://api.minimax.chat` | `abab6.5-chat` |
| 智谱 AI | OpenAI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4` |
| 百川 | OpenAI | `https://api.baichuan-ai.com/v1` | `Baichuan4` |
| Claude | Anthropic | `https://api.anthropic.com` | `claude-3-5-sonnet-20241022` |

### 配置方式

1. 在 `.env` 中配置 API Key
2. 在 `code-ctx.config.js` 中配置 `ai.protocol`、`ai.openai`、`ai.anthropic`
3. 或在 Web 管理界面的 `AI 配置` 页面可视化配置

---

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

---

## 常见问题

### Q: init 中断了怎么办？

重新运行即可，已完成的子项目会自动跳过：

```bash
code-ctx init           # 续跑
code-ctx init --force   # 强制全部重新生成
```

### Q: 剪贴板写入失败怎么办？

工具会自动降级到文件输出（`.ai-prompt.md`），也可以主动使用：

```bash
code-ctx use "任务描述" --out prompt.md
```

### Q: 如何更新文档？

```bash
code-ctx update          # 检测变化，生成增量更新 prompt
code-ctx fix web         # 强制重新生成某个子项目的文档
code-ctx fix web --dry-run  # 只生成 prompt，不调用 AI
```

### Q: 如何检查文档是否泄露敏感信息？

```bash
code-ctx doctor             # 检查文档健康
code-ctx doctor --fix       # 自动修复过期/缺失的文档
```

### Q: 支持多人协作吗？

是的！将 `ai-docs/` 目录提交到 git，团队成员可以共享文档：

```bash
git add ai-docs/
git commit -m "docs: 更新 AI 上下文文档"
```

---

## 开发

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

# 运行测试
npm test

# 启动 Web 界面
code-ctx dashboard
```

---

## 目录结构

```
code-ctx/
├── bin/                # CLI 入口
│   ├── cli.js          # 主入口
│   └── commands/       # 命令定义（7 个命令）
├── src/                # 核心代码
│   ├── commands/       # 命令实现
│   ├── scanner/        # 项目探测、文件扫描
│   ├── generator/      # prompt 组装器
│   ├── template/       # 模板引擎
│   ├── matcher/        # 场景匹配（关键词 + 置信度）
│   ├── ai/             # AI 调用封装（OpenAI + Anthropic）
│   ├── web/            # Express Web 服务
│   └── utils/          # 工具函数
├── templates/          # 内置场景模板（scenarios.json）
├── web/                # 前端代码（Vue 3 + Vite）
│   ├── src/
│   │   ├── components/ # 公共组件（Sidebar 侧边栏）
│   │   ├── composables/ # 组合式函数（useTheme 主题切换）
│   │   ├── views/      # 页面：配置、AI配置、AI生成、子项目、场景、状态
│   │   ├── App.vue     # 根组件 + 全局样式 + CSS 变量
│   │   └── main.js     # 入口 + 路由配置
│   └── dist/           # 构建产物
├── tests/              # 测试文件（Jest）
├── .env.example        # 环境变量示例
└── code-ctx.config.js  # 项目配置文件（init 时自动生成）
```

---

## 许可证

MIT License
