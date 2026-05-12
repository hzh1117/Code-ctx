# CodeContext 设计文档 v0.4

> 状态：设计阶段 | 目标：任意多端项目均可使用的 AI 开发上下文工具

---

## 一、用一句话说清楚这个工具做什么

**让 AI 编程助手在任意项目里都能立刻"认识"你的代码库，并且每次开发时自动准备好最合适的提问方式。**

---

## 二、核心流程（两个阶段）

```
【阶段一：初始化】只做一次（大改动后重做）

用户运行 code-ctx init
        ↓
工具扫描项目文件树 + 提取关键文件
        ↓
生成 prompt → 用户发给 AI（或自动调用 API）
        ↓
AI 生成结构化文档 → 写入 ai-docs/
        ↓
ai-docs/ 包含：
  OVERVIEW.md          总览 + 项目关系
  {子项目}.md          各端结构文档
  api-contracts.md     接口契约
  db-schema.md         数据库结构（可选）
  PROMPT-TEMPLATES.md  针对本项目定制的场景模板


【阶段二：日常开发】每次开发前使用

用户描述任务：code-ctx use "商户端新增优惠券导出功能"
        ↓
        ├─→ 模式A（智能）：分析任务 → 自动匹配场景 → 填入模板 → 复制到剪贴板
        └─→ 模式B（手动）：展示模板列表 → 用户选择 → 填入模板 → 复制到剪贴板
        ↓
用户打开 AI 工具，粘贴，填入具体需求细节，发送
```

---

## 三、初始化阶段详细设计

### 3.1 init 命令做什么

```bash
code-ctx init
```

**步骤一：项目探测**

工具自动识别项目里有哪些子项目，识别依据：

| 特征文件 | 判断为 |
|---------|--------|
| `package.json` 含 `uni-app` | 小程序/H5（uni-app） |
| `package.json` 含 `vue` + `element-ui` | Vue2 管理后台 |
| `package.json` 含 `react` | React 前端 |
| `pom.xml` / `build.gradle` | Java 后端 |
| `package.json` 含 `express`/`koa`/`nestjs` | Node.js 后端 |
| `go.mod` | Go 后端 |
| `requirements.txt` / `pyproject.toml` | Python 后端 |
| `manifest.json` 含 `mp-weixin` | 微信小程序 |

探测完后，询问用户确认：
```
检测到以下子项目：
  [mp]   my-app-mp      →  微信小程序 (uni-app)
  [api]  my-app-api     →  Java 后端
  [mer]  my-app-mer     →  Vue2 管理后台
  [plat] my-app-plat    →  Vue2 管理后台

确认？(y/n) 也可以手动调整别名和类型
```

**步骤二：扫描 + 提取关键内容**

根据子项目类型，提取不同的关键文件：

| 子项目类型 | 重点提取文件 |
|-----------|-------------|
| Vue2/Vue3 管理后台 | `src/api/*.js`, `src/router/modules/*.js`, `src/store/modules/*.js`, `.env.*` |
| 小程序 (uni-app) | `api/*.js`, `pages.json`, `config/app.js`, `utils/request.js` |
| Java 后端 | `**/controller/**/*.java`（只提取类名+方法签名，不含方法体）, `application.yml` |
| Node.js 后端 | `routes/*.js`, `controllers/*.js`, `app.js` |
| 数据库 | `*.sql`（只提取 `CREATE TABLE` 语句，不含数据） |

**步骤三：生成文档 prompt**

工具把文件树 + 提取的关键内容组装成 prompt，采用**自适应策略**：

```javascript
// 从配置读取阈值，默认值如下
const thresholds = config.tokenThresholds || {
  oneShot: 200000,        // < 200k → 一次性生成
  batchWithContext: 500000, // < 500k → 分步 + 上下文
  // > 500k → 分步最小化
};

const totalTokens = estimateTokens(allScannedContent);

if (totalTokens < thresholds.oneShot) {
  strategy = 'ONE_SHOT';
} else if (totalTokens < thresholds.batchWithContext) {
  strategy = 'BATCH_WITH_CONTEXT';
} else {
  strategy = 'BATCH_MINIMAL';
}
```

**BATCH_WITH_CONTEXT 模式下**，每个子项目 prompt 都附带：
1. 项目关系骨架（项目名、类型、它调用谁、被谁用）
2. 已生成的其他子项目的「摘要」（不是全文）

**关键约束**：OVERVIEW.md 必须最后生成，因为它依赖所有子项目文档已经存在。

prompt 生成后，两种方式处理：

- `aiMode: clipboard`（默认）：把 prompt 复制到剪贴板，用户自己粘贴给 AI
- `aiMode: api`（配置了 key 后）：直接调用 API，全自动生成

**步骤四：写入文档**

AI 生成的文档统一写入 `ai-docs/`，最后生成 `PROMPT-TEMPLATES.md`。

**步骤五：敏感信息检查**

写入文档后，自动检查 `ai-docs/` 中是否有疑似明文密钥：

```
⚠️ 检测到 ai-docs/ 中可能包含敏感信息：
  - OVERVIEW.md 第 45 行：password = "xxx"
  - api-contracts.md 第 12 行：api_key = "sk-..."

建议：
  1. 运行 code-ctx doctor 查看详细报告
  2. 确认是否需要添加到 sensitiveFields 配置

是否继续？(y/n)
```

如果 `gitTrack: true` 且检测到敏感字段，强制提示用户确认后才能提交。

**步骤六：引导提示**

init 完成后显示下一步操作提示：

```
✓ 初始化完成！ai-docs/ 已生成 5 个文档。

下一步：
  开始开发前：  code-ctx use "你的任务描述"
  代码有大改动：code-ctx update
  检查文档健康：code-ctx doctor
  重新生成文档：code-ctx fix <子项目别名>
```

---

### 3.2 生成的 PROMPT-TEMPLATES.md 有什么不同

**通用工具生成的模板是根据实际项目定制的**，不是千篇一律的占位符。

模板来源采用**内置骨架 + AI 补充**策略：
- 工具内置场景骨架模板，含占位符
- init 时 AI 根据项目结构自动识别有哪些端，生成对应场景列表
- 用户可在 `code-ctx.config.js` 中覆盖或新增场景

**场景模板结构**（AI 根据项目生成）：

不同项目的场景数量和内容不同，但结构统一：

| 字段 | 说明 |
|------|------|
| `id` | 场景标识（A/B/C/...） |
| `name` | 场景名称（如"C 端新功能"） |
| `description` | 场景描述 |
| `relatedProjects` | 涉及的子项目别名数组 |
| `template` | prompt 模板内容（含占位符） |

**示例**：一个多端系统（小程序 + 商户后台 + 平台后台）会自动生成：

| 场景 | 名称 | 涉及子项目 | 典型任务 |
|------|------|-----------|---------|
| A | C 端新功能 | mp + api | 新增小程序页面 |
| B | 商户后台新功能 | mer + api | 新增商户管理功能 |
| C | 平台后台新功能 | plat + api | 新增平台管控功能 |
| D | 数据模型变更 | api + db | 修改表结构 |
| E | 修改已有功能 | 按需 | 优化/重构现有功能 |
| F | 排查 Bug | 按需 | 定位和修复问题 |
| G | 纯后端改动 | api | 后端逻辑调整 |
| H | 跨端功能 | mp + mer/plat + api | 多端联动功能 |

而一个简单博客（前端 + 后端）可能只生成：

| 场景 | 名称 | 涉及子项目 |
|------|------|-----------|
| A | 前端功能 | web + api |
| B | 后端功能 | api |
| C | 修 Bug | 按需 |

比如对于一个 uni-app + Java 后端的项目，生成的模板里会自动填入：
- 真实的文档路径：`/path/to/ai-docs/OVERVIEW.md`
- 真实的接口前缀：`/api/admin/`、`/api/front/`
- 真实的端口：8080、3000
- 真实的目录约定：`pages/`、`src/views/`

而对于另一个 React + NestJS 项目，生成的模板会填入那个项目的约定。

---

## 四、日常开发阶段详细设计

### 4.1 两种使用模式

#### 模式 A：智能模式（直接描述需求）

```bash
code-ctx use "新增优惠券批量导出功能"
```

工具内部流程：
1. 读取 `ai-docs/OVERVIEW.md` 中的项目结构信息
2. 分析任务描述，判断：涉及哪些端？属于哪种场景类型？
3. 自动选择最合适的模板
4. 把项目上下文 + 填好的模板拼成完整 prompt
5. 复制到剪贴板，提示用户去粘贴

**场景匹配逻辑**（关键词 + AI 兜底）：

```
用户输入任务描述
    ↓
关键词快筛（"小程序"→A，"商户"→B，"bug"→F...）
    ↓
命中唯一场景？ → 是 → 直接使用（置信度 100%）
    ↓ 否
调用 AI 判断 → 返回场景编号 + 置信度
```

输出示例：
```
✓ 识别为：场景 B（商户后台新功能）置信度 87%
  不对？输入字母切换：A/C/D/E/F/G/H，或回车确认
> [回车]

✓ 涉及子项目：mer + api
✓ 已复制到剪贴板，去你的 AI 工具粘贴即可

提示：粘贴后记得在 [功能需求细节] 处补充具体字段和交互说明

是否需要补充更多上下文？(y/n)
```

#### 模式 B：手动选择模式

```bash
code-ctx use
```

工具展示可用场景列表：
```
选择开发场景：
  A  新增 C 端功能（小程序）
  B  新增商户后台功能
  C  新增平台管控功能
  D  修改数据模型
  E  修改已有功能
  F  排查 Bug
  G  纯后端改动
  H  跨端功能

输入字母选择：
```

用户选 B 后，工具加载商户端 + 后端文档，拼成完整 prompt 复制到剪贴板。

---

### 4.2 输出的 prompt 结构

无论哪种模式，最终复制到剪贴板的内容结构如下：

```
【第一部分：项目上下文】
（自动注入，用户不需要看，AI 需要）

请先阅读以下项目文档，建立上下文，读完回复"已就绪"：

=== 系统总览 ===
{OVERVIEW.md 内容}

=== 商户端文档 ===
{mer.md 内容}

=== 接口契约（商户端相关部分）===
{api-contracts.md 商户端部分}


【第二部分：任务模板】
（用户填写具体需求，AI 按此执行）

任务：在商户后台新增【优惠券批量导出】功能。
要求：
1. 菜单位置：【待填写：如「营销中心 > 优惠券管理」页面新增导出按钮】
2. 页面功能：【待填写：列表筛选后导出为 Excel】
3. 后端接口：路径遵循 /api/admin/ 约定

先列出需要改动的完整文件清单，确认后逐个实现。
```

**prompt 超长时的分级加载策略**：

当 prompt 超出 AI 字数限制时，按以下优先级裁剪：

| 级别 | 内容 | 触发条件 |
|------|------|----------|
| L1 完整 | OVERVIEW + 涉及子项目文档 + 接口契约 | 默认 |
| L2 精简 | OVERVIEW 速查表 + 子项目核心模块 + 开发注意事项 | L1 超限 |
| L3 最小 | 仅任务模板 + 关键接口路径 | L2 超限 |

每个文档用固定标记注释各节，方便按需截取：
```markdown
<!-- section:overview-summary -->
<!-- section:core-modules -->
<!-- section:dev-notes -->
```

---

## 五、文档更新设计

### 5.1 update 命令

```bash
code-ctx update
```

工具流程：
1. 检查 `ai-docs/.last-scan`（上次扫描的时间戳 + 文件哈希）
2. 比对当前文件，找出有变化的子项目
3. 只重新扫描变化的部分，生成增量更新 prompt
4. 用户发给 AI，AI 返回更新后的文档内容
5. 写入对应 `.md` 文件

**增量更新 prompt 内容**：
- 变化文件内容（新增/修改的文件）
- 当前对应文档的相关片段（让 AI 知道在哪个位置更新）
- 告诉 AI："这是新增的 X，这是现有文档，请更新对应部分"

### 5.2 什么时候需要 update

| 操作 | 是否需要 update |
|------|----------------|
| 新增了一个页面/路由 | 是（对应子项目 .md） |
| 新增了接口 | 是（api-contracts.md） |
| 修改了已有逻辑（不改接口签名）| 否 |
| 修改了数据库表结构 | 是（db-schema.md） |
| 只改了样式/UI | 否 |

### 5.3 fix 命令

```bash
code-ctx fix <子项目别名>
```

与 `update` 的区别：

| 命令 | 触发方式 | 用途 |
|------|---------|------|
| `update` | 自动检测增量 | 日常开发，只更新变化部分 |
| `fix` | 用户指定子项目 | 强制全量重跑某个子项目 |

使用场景：
- `update` 后发现某子项目文档质量不好
- 子项目结构大改（如重构）
- `doctor` 发现某文档有问题

流程：
1. 重新扫描指定子项目的全部文件
2. 生成完整的子项目文档 prompt
3. 用户发给 AI，AI 返回新的文档内容
4. 覆盖写入对应 `.md` 文件

---

## 六、项目配置文件

```javascript
// code-ctx.config.js（放在项目根目录，init 时自动生成）

module.exports = {
  // 工具基本信息
  projectName: 'my-app',
  outputDir: './ai-docs',

  // AI 调用方式
  // 'clipboard': 生成 prompt 复制到剪贴板，用户手动粘贴
  // 'anthropic' / 'openai': 自动调用 API（需配置 key）
  aiMode: 'clipboard',
  // aiApiKey: process.env.ANTHROPIC_API_KEY,

  // 子项目定义（init 时自动探测，用户可调整）
  projects: [
    {
      alias: 'mp',
      path: './my-app-mp',
      type: 'uniapp-miniprogram',
      label: '微信小程序（C端用户）',
    },
    {
      alias: 'api',
      path: './my-app-api',
      type: 'java-backend',
      label: '后端 API 服务（Spring Boot）',
    },
    {
      alias: 'mer',
      path: './my-app-mer',
      type: 'vue2-admin',
      label: '商户端 Web 后台',
    },
    {
      alias: 'plat',
      path: './my-app-plat',
      type: 'vue2-admin',
      label: '平台端 Web 后台',
    },
  ],

  // 排除目录（init 时自动补充常见的）
  excludeDirs: [
    'node_modules', '.git', 'dist', 'build',
    '.nuxt', 'unpackage', 'miniprogram_npm',
    '.idea', '.vscode', 'ai-docs',
  ],

  // 忽略文件（支持 .gitignore 语法）
  // 也可使用 .code-ctx-ignore 文件（优先级更高）
  ignorePatterns: [
    '*.test.js',
    '*.spec.ts',
    '__tests__/',
    'docs/',
  ],

  // 是否将 ai-docs/ 纳入 git 版本控制
  // true: 团队共享 AI 上下文（推荐）
  // false: 每人本地生成，加 .gitignore
  // 注意：如果检测到敏感字段，init 会强制提示确认
  gitTrack: true,

  // 敏感字段配置（扫描时自动替换为 [REDACTED]）
  // 内置默认列表，用户可追加
  sensitiveFields: {
    // 内置：password, secret, token, private_key, api_key, access_key...
    // 用户追加：
    custom: ['my_company_secret', 'internal_api_token'],
  },

  // 自定义场景模板（可覆盖默认模板）
  // 不配置则使用工具内置的通用模板
  // customTemplates: './ai-docs/PROMPT-TEMPLATES.md',
}
```

---

## 七、技术实现方案

### 选型：Node.js CLI

**理由**：
- 目标用户的项目里已有 Node 环境，无需额外安装
- 跨平台（Windows / Mac / Linux）
- 可用 `npm link` 全局安装，在任意项目目录运行
- 后期可发布为 npm 包，一行安装

### 命令结构

```
code-ctx
  ├── init              # 初始化：扫描项目，生成 ai-docs/
  ├── use [任务描述]    # 日常使用：生成开发 prompt 到剪贴板
  ├── update            # 更新：检测变化，更新相关文档
  ├── fix [子项目别名]  # 修复：重新生成指定子项目的文档
  ├── status            # 查看：ai-docs 各文档的最后更新时间
  ├── doctor            # 检查：文档健康检查
  └── dashboard         # 打开本地 Web 管理页面
```

### 项目结构

```
code-ctx/
├── bin/
│   └── cli.js              # commander 入口
├── src/
│   ├── commands/           # init, use, update, fix, status, doctor, dashboard
│   ├── scanner/            # 项目探测、文件扫描（可扩展新项目类型）
│   ├── generator/          # prompt 生成、文档生成（可扩展）
│   ├── matcher/            # 场景匹配（关键词 + AI）
│   ├── template/           # 模板引擎、内置骨架
│   ├── ai/                 # AI 调用封装（clipboard/api）
│   ├── web/                # 本地 Web 服务
│   │   ├── server.js       # Express/Koa 服务
│   │   ├── api/            # REST API 接口
│   │   └── public/         # 前端静态文件（打包后）
│   └── utils/              # 编码处理、剪贴板等
├── web/                    # 前端源码（Vue/React）
│   ├── src/
│   │   ├── views/          # 页面：配置、场景编辑、prompt 预览
│   │   ├── components/     # 组件
│   │   └── api/            # 后端接口调用
│   └── package.json
├── templates/              # 内置场景骨架模板
└── package.json
```

插件接口预留：`scanner/` 和 `generator/` 目录支持扩展新项目类型。

### 核心依赖

| 依赖 | 用途 |
|------|------|
| `commander` | CLI 命令解析 |
| `glob` | 文件树遍历 |
| `chardet` | 文件编码检测 |
| `iconv-lite` | 文件编码处理（解决 Windows GBK 问题） |
| `clipboardy` | 跨平台剪贴板操作 |
| `inquirer` | 交互式终端问答（手动选模板） |
| `chalk` | 终端彩色输出 |
| `express` | 本地 Web 服务器 |
| `@anthropic-ai/sdk` | 可选：自动调用 Claude API |

### 文件编码方案（解决 Windows 乱码）

所有文件读取统一用 `iconv-lite`，先检测编码再转换：

```javascript
const iconv = require('iconv-lite');
const chardet = require('chardet');
const fs = require('fs');

function readFileUTF8(filePath) {
  const buffer = fs.readFileSync(filePath);
  const encoding = chardet.detect(buffer) || 'UTF-8';
  return iconv.decode(buffer, encoding);
}
```

### doctor 命令（文档健康检查）

```bash
code-ctx doctor
```

检查项目：
1. 每个 `.md` 文件是否包含必要的章节（section 标记完整性）
2. OVERVIEW 里的项目关系是否和 `code-ctx.config.js` 的定义一致
3. **弱检查**：`api-contracts.md` 里的接口数量，提示用户手动核对（避免误报）
4. **可选强检查**：`--strict` 模式下尝试解析代码对比路由路径集合
5. 检查 `ai-docs/` 里是否有疑似明文密钥（敏感信息检查）
6. 输出健康报告，标出可疑的地方让用户复核

### 任务历史记录

每次 `code-ctx use` 命令执行后，写入 `ai-docs/.task-history.jsonl`：

```json
{"timestamp":"2026-05-12T10:30:00Z","task":"商户端新增优惠券导出","scenario":"B","projects":["mer","api"]}
```

用途：
- `update` 命令可以用历史任务推断哪些模块最近在改动
- 后期可以生成"本周开发了什么"的摘要

### init 容错机制

写入进度文件 `ai-docs/.init-state.json`，记录每个子项目的完成状态：

```json
{
  "lastRun": "2026-05-12T10:00:00Z",
  "projects": {
    "mp": {"status": "completed"},
    "api": {"status": "completed"},
    "mer": {"status": "failed", "error": "扫描超时"},
    "plat": {"status": "pending"}
  }
}
```

重跑 `init` 时跳过已完成的，只处理失败和未处理的。每个子项目独立生成、独立写入，不互相阻塞。

---

## 八、AI 工具集成方式

code-ctx 生成的 prompt 支持三种输出模式，适配不同的 AI 工具：

### 8.1 输出模式与 AI 模式的关系

配置中有两个相关但正交的概念：

| 配置项 | 作用 | 可选值 |
|--------|------|--------|
| `aiMode` | 谁来消费 prompt | `clipboard`（用户手动）/ `api`（自动调用） |
| `outputMode` | prompt 怎么输出 | `clipboard` / `stdout` / `file` |

**正交关系**：
- 当 `aiMode: clipboard` 时，`outputMode` 决定 prompt 输出到哪里（剪贴板/文件/stdout）
- 当 `aiMode: api` 时，`outputMode` 无意义（直接调 API，不需要输出 prompt）

### 8.2 输出模式

| 模式 | 命令 | 适用场景 |
|------|------|----------|
| **剪贴板**（默认） | `code-ctx use "任务"` | 所有工具，用户手动粘贴 |
| **stdout** | `code-ctx use "任务" --stdout` | pipe 给 CLI 工具 |
| **文件** | `code-ctx use "任务" --out prompt.md` | 需要编辑后再用 |

**剪贴板降级机制**：

`clipboardy` 在 Windows 上对超大内容（>1MB）可能静默失败。处理方式：

```javascript
async function writeToClipboard(content) {
  try {
    await clipboardy.write(content);
    // 验证写入成功
    const actual = await clipboardy.read();
    if (actual.length < content.length * 0.9) {
      throw new Error('剪贴板写入不完整');
    }
  } catch (err) {
    // 自动降级到文件输出
    const fallbackPath = '.ai-prompt.md';
    fs.writeFileSync(fallbackPath, content);
    console.warn(`⚠️ 剪贴板写入失败，已降级输出到 ${fallbackPath}`);
  }
}
```

### 8.3 与主流 AI 工具配合

**Claude Code / Codex / Open Code 等 CLI 工具**：

```bash
# 方式 1：pipe 直传
code-ctx use "新增优惠券导出" --stdout | claude

# 方式 2：剪贴板粘贴
code-ctx use "新增优惠券导出"
# 然后在 Claude Code 中 Ctrl+V 粘贴
```

**Cursor / Windsurf / VS Code + AI 插件**：

```bash
# 生成到文件，然后在 IDE 中引用
code-ctx use "新增优惠券导出" --out .ai-prompt.md
# 在 IDE 对话中输入：请阅读 .ai-prompt.md
```

**网页版 ChatGPT / Claude**：

```bash
# 剪贴板模式，直接粘贴
code-ctx use "新增优惠券导出"
# 打开网页，Ctrl+V 粘贴
```

### 8.4 配置默认输出模式

```javascript
// code-ctx.config.js
module.exports = {
  // 默认输出模式：clipboard | stdout | file
  outputMode: 'clipboard',
  // file 模式的默认输出路径
  // outputFile: '.ai-prompt.md',
}
```

### 8.5 MCP Server 模式（后续可选）

MCP（Model Context Protocol）是 Claude Code、Cursor 等工具支持的协议。可以把 code-ctx 包装成 MCP Server，让 AI 工具直接调用。

**优势**：
- 无需手动粘贴
- AI 工具自动获取上下文
- 体验更好

**工具定义示例**：

```json
{
  "name": "get_project_context",
  "description": "获取项目上下文，用于 AI 开发",
  "parameters": {
    "task": "任务描述",
    "scenario": "场景标识（可选）"
  }
}
```

**使用方式**：

```bash
# 启动 MCP Server
code-ctx serve

# 在 Claude Code / Cursor 中配置 MCP Server 地址
# 然后 AI 工具可以自动调用 get_project_context 工具
```

建议作为里程碑 3 之后的可选功能。

---

## 九、本地 Web 管理页面

### 9.1 概述

`code-ctx dashboard` 命令启动本地 Web 服务器，自动打开浏览器，提供可视化的配置和管理界面。

### 9.2 功能模块

| 模块 | 功能 |
|------|------|
| **配置管理** | 可视化编辑 `code-ctx.config.js` 所有配置项 |
| **子项目管理** | 添加/删除/编辑子项目配置 |
| **场景模板** | 可视化编辑 A-H 场景的 prompt 模板 |
| **敏感字段** | 管理敏感字段列表 |
| **Prompt 生成** | 选择场景 → 预览 prompt → 复制/导出 |
| **文档状态** | 查看 ai-docs/ 各文档状态 |

### 9.3 技术方案

- **后端**：Express，提供 REST API
- **前端**：Vue 3 + Vite，打包后嵌入 CLI
- **端口**：默认 3456，可配置

### 9.4 启动方式

```bash
code-ctx dashboard
# 启动本地服务器，自动打开 http://localhost:3456
```

### 9.5 页面结构

```
/
├── /config           # 配置管理
├── /projects         # 子项目管理
├── /scenarios        # 场景模板编辑
├── /sensitive        # 敏感字段管理
├── /generate         # Prompt 生成器
└── /status           # 文档状态
```

---

## 十、实现路线图

### 里程碑 1：能用版（2-3 天）
- `init` 命令：扫描文件树 + 提取关键文件 + 生成 prompt（剪贴板模式）
- `use` 命令：手动选模板 + 注入上下文 + 复制到剪贴板
- 支持 Vue2/Vue3 管理后台、uni-app 小程序、Java 后端三种项目类型
- 解决 Windows UTF-8 编码问题

### 里程碑 2：好用版（1 周）
- `use` 命令支持智能模式（关键词 + AI 兜底 + 置信度确认）
- `update` 命令（增量更新文档）
- `doctor` 命令（文档健康检查）
- `dashboard` 命令（本地 Web 管理页面）
- 任务历史记录（`.task-history.jsonl`）
- 更多项目类型支持：NestJS、Go、Python FastAPI、React

### 里程碑 3：自动化版（2 周）
- `aiMode: api` 模式：全自动生成文档，无需手动粘贴
- `fix` 命令
- watch 模式：监听文件变化自动更新文档
