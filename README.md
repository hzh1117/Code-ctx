# Code-ctx

> AI 开发上下文工具 - 让 AI 编程助手立刻"认识"你的代码库

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
- 🏥 **健康检查** - 检测文档完整性、OVERVIEW 一致性和敏感信息泄露
- 💾 **容错机制** - init 中断后可续跑，自动跳过已完成的子项目
- 🖥️ **Web 管理** - 可视化配置、场景模板、文档状态管理
- 📋 **剪贴板降级** - 超大内容写入失败时自动降级到文件输出
- 🔒 **安全优先** - 自动过滤敏感信息（密码、密钥等）
- 🤖 **AI API 集成** - 兼容 OpenAI 和 Anthropic 协议，支持 DeepSeek、Kimi、MiniMax 等

## 安装

```bash
# 全局安装
npm install -g code-ctx

# 或在项目中安装
npm install --save-dev code-ctx
```

## 快速开始

### 1. 初始化项目

```bash
code-ctx init
```

这会：
- 扫描项目结构
- 检测子项目类型
- 生成 `ai-docs/` 目录和配置文件
- 自动检查敏感信息泄露

支持选项：
- `--skip-ai` - 跳过 AI 文档生成，只扫描项目结构
- `--force` - 强制重新生成，忽略已完成状态

### 2. 生成 Prompt

```bash
# 智能模式：描述任务，自动匹配场景
code-ctx use "新增用户登录功能"

# 手动指定场景
code-ctx use -s B "商户后台新增优惠券管理"

# 输出到文件
code-ctx use "任务描述" --out prompt.md

# 输出到终端
code-ctx use "任务描述" --stdout
```

智能模式会：
1. 分析任务描述，自动匹配最佳场景（A-H）
2. 加载 OVERVIEW.md 和相关子项目文档
3. 组装完整的 prompt 并复制到剪贴板

### 3. 粘贴到 AI 工具

复制生成的 prompt 到你的 AI 工具（Claude、ChatGPT、Cursor 等），AI 就能理解你的项目了！

## 命令列表

| 命令 | 说明 | 选项 |
|------|------|------|
| `code-ctx init` | 初始化项目 | `--skip-ai`, `--force` |
| `code-ctx use [task]` | 生成开发 prompt | `-s <场景>`, `--stdout`, `--out <文件>` |
| `code-ctx update` | 检测变化，更新文档 | `--dry-run`, `--stdout` |
| `code-ctx fix <alias>` | 重新生成指定子项目的文档 | `--dry-run` |
| `code-ctx status` | 查看文档状态 | |
| `code-ctx doctor` | 检查文档健康 | `--strict` |
| `code-ctx dashboard` | 打开 Web 管理页面 | `-p <端口>` |
| `code-ctx help` | 显示帮助信息 | |

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
| A | 新增前端功能 | 新增页面、组件 |
| B | 新增后台功能 | 新增管理功能 |
| C | 新增平台功能 | 新增运营功能 |
| D | 数据模型变更 | 修改表结构 |
| E | 修改已有功能 | 优化、重构 |
| F | 排查 Bug | 定位和修复问题 |
| G | 纯后端改动 | 后端逻辑调整 |
| H | 跨端功能 | 多端联动 |

## 配置文件

初始化后会生成 `code-ctx.config.js`：

```javascript
module.exports = {
  projectName: 'my-app',
  outputDir: './ai-docs',
  aiMode: 'clipboard',
  projects: [
    { alias: 'web', path: './web', type: 'vue2-admin', label: '前端' },
    { alias: 'api', path: './api', type: 'java-backend', label: '后端' }
  ],
  excludeDirs: ['node_modules', '.git', 'dist'],
  gitTrack: true,
  sensitiveFields: {
    custom: ['my_secret_key']
  }
};
```

## 使用场景

### 场景 1：新功能开发

```bash
# 生成 prompt
code-ctx use "新增用户登录功能"

# 粘贴到 AI 工具，AI 会：
# 1. 理解项目结构
# 2. 知道在哪里添加代码
# 3. 遵循项目约定
```

### 场景 2：Bug 修复

```bash
# 生成 Bug 修复 prompt
code-ctx use -s F "登录页面显示异常"

# AI 会：
# 1. 分析可能的原因
# 2. 给出修复方案
```

### 场景 3：代码重构

```bash
# 生成重构 prompt
code-ctx use -s E "优化用户模块性能"

# AI 会：
# 1. 分析现有代码
# 2. 提出优化建议
```

## 与 AI 工具配合

### Claude Code / Cursor

```bash
# 方式 1：剪贴板
code-ctx use "任务描述"
# 然后在 AI 工具中粘贴

# 方式 2：文件输出
code-ctx use "任务描述" --out prompt.md
# 在 AI 工具中引用文件
```

### 网页版 ChatGPT / Claude

```bash
# 生成 prompt
code-ctx use "任务描述"

# 打开网页，Ctrl+V 粘贴
```

## Web 管理界面

```bash
# 启动 Web 界面
code-ctx dashboard

# 指定端口
code-ctx dashboard -p 8080

# 自动打开 http://localhost:3456
```

功能：
- **配置管理** (`/`) - 可视化编辑项目配置
- **AI 配置** (`/ai`) - 配置大模型 API 连接
- **AI 生成** (`/ai-generate`) - 选择场景生成 prompt 并调用 AI
- **子项目** (`/projects`) - 查看检测到的子项目列表
- **场景模板** (`/scenarios`) - 查看 A-H 场景模板
- **文档状态** (`/status`) - 查看 ai-docs 各文档状态

## AI API 集成

支持所有兼容 OpenAI 和 Anthropic 接口协议的大模型。两种协议可以分别配置，互不覆盖；当前启用协议决定测试连接和 AI 生成时实际调用哪套配置。

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

1. 在项目根目录创建 `.env` 文件：

```env
# OpenAI 兼容 API Key（适用于 DeepSeek、Kimi、MiniMax 等）
OPENAI_API_KEY=your-api-key

# Anthropic API Key（适用于 Claude 或 Anthropic 兼容服务）
ANTHROPIC_API_KEY=your-api-key

# 可选：通过环境变量覆盖服务地址/模型
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

2. 在 `code-ctx.config.js` 中分别配置两种协议参数：

```javascript
module.exports = {
  ai: {
    // 当前启用协议：'openai' | 'anthropic'
    protocol: 'openai',

    // OpenAI 兼容协议，调用 {baseUrl}/chat/completions
    openai: {
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      maxTokens: 4096
    },

    // Anthropic 协议，调用 {baseUrl}/v1/messages 或兼容 messages 端点
    anthropic: {
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096
    }
  }
}
```

也可以在 Web 管理界面的 `AI 配置` 页面分别维护两套配置和 API Key。保存后：

- OpenAI 兼容协议的 Key 写入 `.env` 的 `OPENAI_API_KEY`
- Anthropic 协议的 Key 写入 `.env` 的 `ANTHROPIC_API_KEY`
- `code-ctx.config.js` 只保存 `baseUrl`、`model`、`maxTokens` 等非密钥配置
- 旧版扁平配置 `ai.baseUrl` / `ai.model` / `ai.maxTokens` 仍可读取，重新保存后会迁移到当前启用协议的分组配置

### 使用方式

```bash
# 启动 Web 界面
code-ctx dashboard

# 访问 AI 配置页面：http://localhost:3456/ai
# 访问 AI 生成页面：http://localhost:3456/ai-generate
```

## 常见问题

### Q: 如何更新文档？

```bash
# 自动检测变化并生成增量更新 prompt
code-ctx update

# 强制重新生成某个子项目的文档（调用 AI）
code-ctx fix web

# 只生成 prompt，不调用 AI
code-ctx fix web --dry-run
```

### Q: 如何检查文档是否泄露敏感信息？

```bash
code-ctx doctor
```

会检测：
- 必要章节是否完整
- OVERVIEW 与配置的一致性
- API 接口数量统计
- 是否包含密码、密钥等敏感信息

### Q: init 中断了怎么办？

重新运行 `code-ctx init`，已完成的子项目会自动跳过：

```bash
# 正常续跑
code-ctx init

# 强制全部重新生成
code-ctx init --force
```

### Q: 剪贴板写入失败怎么办？

工具会自动降级到文件输出（`.ai-prompt.md`），也可以主动使用文件输出：

```bash
code-ctx use "任务描述" --out prompt.md
```

### Q: 如何自定义场景模板？

编辑 `code-ctx.config.js` 中的 `customTemplates` 字段，或直接编辑 `ai-docs/PROMPT-TEMPLATES.md`。

### Q: 支持多人协作吗？

是的！将 `ai-docs/` 目录提交到 git，团队成员可以共享文档：

```bash
git add ai-docs/
git commit -m "docs: 更新 AI 上下文文档"
```

## 开发

```bash
# 克隆项目
git clone https://gitee.com/yo-yo-lu-mingming/code-ctx.git

# 进入项目目录
cd code-ctx

# 安装依赖
npm install

# 安装前端依赖并构建
cd web
npm install
npm run build
cd ..

# 创建全局链接
npm link

# 启动 Web 界面
code-ctx dashboard
```

访问 http://localhost:3456

## 目录结构

```
code-ctx/
├── bin/              # CLI 入口
│   ├── cli.js
│   └── commands/     # 命令定义
├── src/              # 核心代码
│   ├── commands/     # 命令实现
│   ├── scanner/      # 项目探测、文件扫描
│   ├── generator/    # prompt 组装器
│   ├── template/     # 模板引擎
│   ├── matcher/      # 场景匹配
│   ├── ai/           # AI 调用封装
│   ├── web/          # Web 服务
│   └── utils/        # 工具函数（编码、剪贴板、敏感过滤等）
├── templates/        # 内置场景模板
├── web/              # 前端代码（Vue 3）
└── tests/            # 测试文件
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 致谢

感谢所有 AI 编程助手让开发更高效！
