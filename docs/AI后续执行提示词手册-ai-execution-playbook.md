# Code-ctx 后续 AI 执行提示词手册

> 用途：后续你可以每次复制一个任务包给 AI 编程助手执行。任务包按依赖顺序排列，每个任务都有目标、建议文件、验收标准和可直接复制的提示词。
>
> 原则：先安全，再测试，再性能，再架构，再产品能力。不要一次把多个阶段全丢给 AI，避免改动过大、难以 review。

## 使用方式

1. 每次只复制“全局前置提示词”加一个任务包。
2. 每个任务完成后先 review diff，再运行任务内验证命令。
3. 只有当前任务通过验收，再进入下一个任务。
4. 遇到库、框架、SDK、CLI 或云服务文档，必须按仓库 `AGENTS.md` 使用 `ctx7` 查询最新文档。
5. 涉及许可证、安全披露、公开发布、行业最佳实践，可用 Firecrawl 查询资料，但结果必须落成仓库文档或变更说明。
6. 不提交 `.env`、API Key、生成 prompt、私有项目文档、本地调试脚本。

## 全局前置提示词

每次给 AI 执行任务前，先复制这一段，再复制具体任务包。

```text
你正在维护 D:\workspace\codecontext 的 Code-ctx 项目。

必须先阅读：
- README.md
- README_EN.md
- LICENSE
- SECURITY.md
- CONTRIBUTING.md
- docs/AI分阶段实施指令-ai-implementation-instructions.md
- docs/项目完善路线图-project-improvement-roadmap.md
- docs/AI后续执行提示词手册-ai-execution-playbook.md
- docs/ 下现有分析报告：项目分析报告-project-analysis-report.md、架构分析报告-architecture-analysis-report.md、代码质量报告-code-quality-report.md、安全审计报告-security-audit-report.md、性能分析报告-performance-analysis-report.md、测试质量报告-test-quality-report.md、依赖配置报告-dependency-config-report.md、综合分析报告-comprehensive-analysis-report.md、问题跟踪清单-issue-tracker.md、改进修复计划-repair-plan.md

执行规则：
- 以当前代码为准，报告只作为线索；如果报告和代码不一致，先说明差异。
- 本项目源码公开但禁止商业使用，不要把许可证写成 MIT 或 OSI 标准开源。
- 涉及库、框架、SDK、CLI 或云服务文档时，必须按 AGENTS.md 使用 ctx7 查询最新文档。
- 涉及公开发布、许可证、安全披露等外部资料时，可用 Firecrawl 查询并引用来源。
- 不提交 .env、API Key、Token、生成 prompt、私有 ai-docs 或本地 debug 文件。
- 修改生产代码前先补或更新测试；如果无法测试，必须说明原因并提供手动验证步骤。
- 保持改动聚焦，不做任务外重构，不格式化无关文件。

输出要求：
- 列出改动文件。
- 列出验证命令和结果。
- 列出剩余风险。
- 给出建议的下一个任务包编号。
```

## 执行总览

| 阶段 | 任务包 | 目标 | 前置 |
|------|--------|------|------|
| M0 | P00 | 基线确认和发布清单复核 | 无 |
| M1 安全 | P01-P06 | 消除公开前 P0/P1 安全风险 | P00 |
| M2 测试 | P07-P11 | 补齐核心测试和覆盖率输出 | M1 可分批完成 |
| M3 性能 | P12-P15 | 降低 AI 生成、update、status、前端首屏耗时 | M1 + P07 |
| M4 架构 | P16-P20 | 拆大函数、清硬编码、统一公共能力 | M2 基础覆盖 |
| M5 发布工程 | P21-P24 | lint、CI、包清单、release checklist | M1 |
| M6 产品能力 | P25-P31 | JSON 配置、插件、文档质量、Dashboard、AI 增强、E2E | M1-M5 |

## M0：基线确认

### P00：当前状态复核和任务拆分校准

**目标**：确认当前仓库状态、测试基线、发布清单和已有文档是否仍一致。

**建议文件**：
- 只读优先；如发现文档明显过期，可修改 `docs/项目完善路线图-project-improvement-roadmap.md` 和 `docs/AI后续执行提示词手册-ai-execution-playbook.md`

**验收标准**：
- 明确当前测试结果、构建结果、npm pack 文件列表。
- 明确哪些报告项已经被修复，哪些仍未修复。
- 不做生产代码改动。

```text
请执行 P00：Code-ctx 当前状态复核和任务拆分校准。

任务：
1. 阅读全局前置提示词要求的文档。
2. 运行并记录：
   - git status --short --untracked-files=all
   - npm run check
   - npm pack --dry-run
3. 对照 docs/问题跟踪清单-issue-tracker.md、docs/改进修复计划-repair-plan.md、docs/项目完善路线图-project-improvement-roadmap.md，列出：
   - 已经完成或部分完成的事项；
   - 仍需执行的安全、测试、性能、架构、发布、产品能力任务；
   - 哪些任务必须前置，哪些可并行。
4. 如果 docs/AI后续执行提示词手册-ai-execution-playbook.md 与当前代码明显不一致，只更新该文档，不改生产代码。

验收：
- npm run check 通过，或明确失败原因。
- npm pack --dry-run 输出发布文件列表。
- 输出下一步建议任务编号。
```

## M1：安全加固

### P01：配置加载安全化

**目标**：消除 `code-ctx.config.js` 加载链路的高风险对象注入。

**建议文件**：
- `src/utils/config.js`
- `tests/utils/config.test.js`
- 必要时更新 `README.md`、`README_EN.md` 的配置说明

**验收标准**：
- `loadConfigWithVM()` 不向 VM 沙箱注入 `require`、`process`、`__dirname`、`__filename`。
- 现有简单 `module.exports = {}` 配置仍可读取。
- 恶意配置无法 `require('child_process')`。

```text
请执行 P01：配置加载安全化。

重点：
1. 检查 src/utils/config.js 当前 loadConfigWithVM/loadProjectConfig 实现。
2. 修改 VM 配置加载逻辑：
   - 不注入 require、process、__dirname、__filename。
   - 只保留 module、exports、console 中必要且低风险的对象；如 console 不需要可不注入。
   - 保留 CommonJS module.exports 对象配置兼容。
   - 对解析失败错误做安全包装，避免泄露不必要内部细节。
3. 新增或更新 tests/utils/config.test.js：
   - 正常 module.exports 对象配置可加载。
   - exports.xxx 写法如当前支持则继续支持；如不支持需说明。
   - 恶意配置 `require('child_process')` 被拒绝。
   - 配置文件语法错误返回可理解错误。
4. 如需文档同步，只改最小说明。

验证命令：
- npm test -- --runInBand tests/utils/config.test.js
- npm test -- --runInBand
- npm run check

不要做 JSON 配置迁移；那是 P25。
```

### P02：命令执行和 Git 参数安全化

**目标**：把字符串拼接执行命令改成安全参数数组，阻断命令注入。

**建议文件**：
- `bin/commands/dashboard.js`
- `src/utils/git-utils.js`
- `tests/utils/git-utils.test.js`
- 必要时更新 `tests/commands/*`

**验收标准**：
- 不使用字符串拼接方式执行用户可影响的命令。
- 路径、端口、commit hash 有校验。
- Windows 特殊字符路径不造成命令注入。

```text
请执行 P02：命令执行和 Git 参数安全化。

重点：
1. 检查 bin/commands/dashboard.js 和 src/utils/git-utils.js 是否存在 execSync/exec 字符串拼接。
2. 将可被用户输入影响的命令改为 spawnSync、execFileSync 或等价安全参数数组。
3. dashboard:
   - 校验端口必须是 1-65535 的整数。
   - 校验 --dir 解析后存在且是目录。
   - dev 启动不通过 shell 字符串拼接传参。
4. git-utils:
   - git diff、rev-parse 等命令使用数组参数。
   - commit hash 参数限制为合法 hash 或明确支持的 ref 格式；如果现有功能依赖任意 ref，说明兼容策略。
5. 新增 tests/utils/git-utils.test.js：
   - mock child_process，验证命令和参数数组。
   - 覆盖 git 命令失败降级。
   - 覆盖非法 commit/ref 被拒绝或安全处理。
6. 如 dashboard 命令可测试，补充 focused test；否则给出手动验证命令。

验证命令：
- npm test -- --runInBand tests/utils/git-utils.test.js
- npm test -- --runInBand
- npm run check

不要改无关 CLI 行为。
```

### P03：Dashboard API 输入白名单和请求体限制

**目标**：防止 Dashboard 写配置、改模板、触发任务时写入任意键、原型污染或超大请求。

**建议文件**：
- `src/web/server.js`
- `src/web/api/config.js`
- `src/web/api/scenarios.js`
- `src/web/api/ai.js`
- `tests/web/basic-api.test.js`
- `tests/web/scenarios-edit.test.js`
- 新增 `tests/web/security.test.js`

**验收标准**：
- `express.json()` 设置合理 `limit`。
- `/api/config` 只允许已知字段。
- 过滤 `__proto__`、`constructor`、`prototype` 等污染键。
- 场景模板有长度限制。

```text
请执行 P03：Dashboard API 输入白名单和请求体限制。

执行前用 ctx7 查询 Express 5 文档，确认 express.json limit、错误处理中间件和静态文件行为。

重点：
1. src/web/server.js:
   - 将 express.json() 改为 express.json({ limit: '1mb' }) 或更保守值。
   - 确认静态文件 root 固定为 web/dist，不受请求参数影响。
2. src/web/api/config.js:
   - PUT /api/config 添加 ALLOWED_KEYS 白名单。
   - 对 projectName、outputDir、aiMode、projects、excludeDirs、gitTrack、ai 等字段做结构校验。
   - 丢弃或拒绝未知字段；对 __proto__/constructor/prototype 一律拒绝。
3. src/web/api/scenarios.js:
   - PUT /api/scenarios/:id 限制 id 为 A-H 或当前 scenarios 中存在的 id。
   - template 长度限制，建议 10000 字符。
   - 请求体只接受 template。
4. src/web/api/ai.js:
   - 对 provider/protocol/baseUrl/model/maxTokens 等字段做类型和长度校验。
5. 测试：
   - 添加污染键不会进入配置文件。
   - 未知字段被拒绝或过滤，按实现选择断言。
   - 超大 body 返回 413 或安全错误。
   - 超长模板返回 400。

验证命令：
- npm test -- --runInBand tests/web/security.test.js tests/web/basic-api.test.js tests/web/scenarios-edit.test.js
- npm test -- --runInBand
- npm run check
```

### P04：统一错误处理和安全响应头

**目标**：客户端不直接看到内部路径、堆栈、provider 原始错误；Web 响应包含基础安全头。

**建议文件**：
- `src/web/server.js`
- `src/web/middleware/security.js`
- `src/web/api/*.js`
- `tests/web/security.test.js`
- `tests/web/basic-api.test.js`

**验收标准**：
- Express 错误处理中间件使用 `(err, req, res, next)` 四参数签名。
- 客户端错误信息通用化，服务端日志保留必要排查信息。
- 响应头至少包含 `X-Content-Type-Options`、`X-Frame-Options`，CSP 按 Dashboard 实际资源保守配置。

```text
请执行 P04：统一错误处理和安全响应头。

执行前用 ctx7 查询 Express 5 错误处理中间件文档。

重点：
1. 在 src/web/middleware/security.js 中增加或整理：
   - securityHeaders middleware；
   - asyncHandler 或统一错误处理工具；
   - errorHandler(err, req, res, next) 四参数中间件。
2. 在 src/web/server.js 中正确挂载：
   - 安全头在 API 和静态资源前；
   - API 路由之后挂载 errorHandler；
   - 404/前端 fallback 行为不被破坏。
3. 改造 src/web/api/*.js 中直接 `res.status(500).json({ error: err.message })` 的位置：
   - 客户端返回通用错误；
   - 已知 400 类输入错误保留安全、可理解消息；
   - 内部错误只写 console.error 或受控 logger。
4. 测试：
   - 构造一个触发内部异常的 API，断言响应不含本地路径、堆栈、provider 原始响应。
   - 断言安全响应头存在。
   - 现有 API 正常响应不变。

验证命令：
- npm test -- --runInBand tests/web/security.test.js tests/web/basic-api.test.js
- npm test -- --runInBand
- npm run check
```

### P05：AI baseUrl SSRF 防护和敏感 API 限流

**目标**：阻断内网、metadata、本机地址作为 AI provider baseUrl；给 AI 测试、生成、保存密钥接口加基础限流。

**当前状态（2026-05-15）**：`src/ai/client.js` 已新增 `validateBaseUrl` 和 DNS 解析校验，AI 调用和 Dashboard AI 配置保存已默认拒绝非 HTTPS、本机、内网、link-local 和 metadata 地址；Anthropic system prompt 已改为顶层 `system` 字段；`/api/ai/test`、`/api/ai/generate`、`/api/ai/save-key` 已有基础内存限流。后续重点不要重复实现基础校验，而是补齐更细的 token/IP 策略、分布式部署方案和更完整的回归测试。

**建议文件**：
- `src/ai/client.js`
- `src/utils/config.js`
- `src/web/api/ai.js`
- `src/web/middleware/security.js`
- `tests/ai/client.test.js`
- `tests/web/ai-config.test.js`
- `tests/web/generate-prompt.test.js`

**验收标准**：
- 禁止 `localhost`、`127.0.0.1`、`0.0.0.0`、`::1`、`169.254.*`、`10.*`、`172.16-31.*`、`192.168.*`。
- 正常 HTTPS OpenAI/Anthropic/DeepSeek/Kimi 兼容地址通过。
- 敏感接口超限返回 429。

```text
请执行 P05：AI baseUrl SSRF 防护和敏感 API 限流。

重点：
1. 复核现有 validateBaseUrl 和 DNS 解析校验，不重复造一套校验：
   - 保持默认只允许公网 HTTPS；测试和本地调试继续走显式 allowLocalBaseUrl/allowInsecureBaseUrl 选项。
   - 补充更多大小写、尾随斜杠、IPv6、hostname 变体和 DNS 解析失败用例。
2. 确认读取和保存 AI 配置、调用 AI 前都使用 validateBaseUrl。
3. 复核 /api/ai/generate、/api/ai/test、/api/ai/save-key 基础内存限流：
   - 当前默认 30 次/分钟；
   - 后续可按 token/IP 组合细化；
   - 如将来支持多进程或云部署，补分布式限流方案。
4. 测试：
   - 内网地址被拒绝。
   - 正常 provider 地址通过。
   - 超限返回 429。
   - 限流不会影响其他非敏感 API。

验证命令：
- npm test -- --runInBand tests/ai/client.test.js tests/web/ai-config.test.js tests/web/generate-prompt.test.js
- npm test -- --runInBand
- npm run check
```

### P06：路径遍历、save-key 和调试日志脱敏

**目标**：收尾安全项，覆盖文件路径、密钥保存、debug 输出。

**当前状态（2026-05-15）**：`/api/ai/save-key` 已限制 API Key 长度并拒绝换行，保存 `.env` 时使用 `{ mode: 0o600 }`；`AI_DEBUG_RESPONSE` 已改为输出响应摘要，不再输出完整响应正文。后续重点放在路径遍历校验、debug 脱敏断言补强和跨 Web API 的统一错误响应。

**建议文件**：
- `src/web/api/ai.js`
- `src/web/api/scenarios.js`
- `src/web/api/projects.js`
- `src/commands/update.js`
- `src/ai/client.js`
- `tests/web/security.test.js`
- `tests/commands/update.test.js`
- `tests/ai/client.test.js`

**验收标准**：
- 所有请求参数拼接文件路径前做 `path.resolve` + allowedDir 校验。
- `save-key` 限制长度、禁止换行，写 `.env` 使用 `0o600`。
- `AI_DEBUG_RESPONSE` 不输出完整响应正文或密钥。

```text
请执行 P06：路径遍历、save-key 和调试日志脱敏。

重点：
1. 找出 src/web/api/* 和 src/commands/update.js 中所有由 docName、alias、id、请求参数拼接文件路径的位置。
2. 增加 allowedDir 校验：
   - 使用 path.resolve 获取目标路径。
   - 目标路径必须位于允许目录内。
   - 拒绝 ../、绝对路径、空值、`.`、`..` 等危险输入。
3. /api/ai/save-key:
   - 复核现有 key 长度和换行校验，补缺失用例即可。
   - 保持写 .env 时使用 { mode: 0o600 }；Windows 上说明权限语义差异。
4. src/ai/client.js:
   - 复核 AI_DEBUG_RESPONSE 只输出 status、headers 中安全字段、响应长度、摘要或 request id。
   - 不输出完整响应、Authorization、API Key。
5. 测试：
   - 路径遍历被拒绝。
   - save-key 超长和换行被拒绝。
   - debug 输出不包含 secret 或完整响应正文。

验证命令：
- npm test -- --runInBand tests/web/security.test.js tests/commands/update.test.js tests/ai/client.test.js
- npm test -- --runInBand
- npm run check
```

## M2：测试体系补齐

### P07：core 模块测试

**目标**：补齐 `src/core/section.js` 和 `src/core/doc-resolver.js` 的直接测试。

```text
请执行 P07：core 模块测试补齐。

重点：
1. 新增 tests/core/section.test.js，覆盖：
   - extractSection 正常多行提取；
   - section 不存在；
   - section 名包含连字符、点号、特殊正则字符；
   - replaceSection 保留外围内容和 marker；
   - listSections 去重、忽略不闭合或异常 marker 的当前行为。
2. 新增 tests/core/doc-resolver.test.js，覆盖：
   - findRelatedDoc 找到对应项目文档；
   - 无匹配返回当前实现约定；
   - groupChangesByProject 按项目路径分组；
   - 忽略 ai-docs；
   - Windows 和 POSIX 路径。
3. 如果测试暴露真实 bug，先说明，再做最小修复。

验证命令：
- npm test -- --runInBand tests/core/section.test.js tests/core/doc-resolver.test.js
- npm test -- --runInBand
```

### P08：Web 测试 helper 和安全中间件测试

**目标**：减少 Web 测试重复代码，补齐 localhost/token/security middleware 行为。

```text
请执行 P08：Web 测试 helper 和安全中间件测试。

重点：
1. 新增 tests/helpers/http.js，提取 requestJson、requestText、startTestServer 等现有重复 helper。
2. 改造 tests/web/*.test.js 中重复 helper，保持测试语义不变。
3. 新增或完善 tests/web/security.test.js：
   - localhost 请求允许；
   - DASHBOARD_TOKEN 设置后无 token 拒绝；
   - token 错误拒绝；
   - token 正确通过；
   - 安全响应头存在；
   - 错误响应不泄露 stack/path。
4. 保持测试文件清晰，不引入全局共享状态导致 flaky。

验证命令：
- npm test -- --runInBand tests/web
- npm test -- --runInBand
```

### P09：Git、AI 重试和 update 写回测试

**目标**：覆盖最容易造成数据损坏或网络异常回归的逻辑。

```text
请执行 P09：Git、AI 重试和 update 写回测试。

重点：
1. tests/utils/git-utils.test.js：
   - hasGitRepo；
   - getCurrentCommitHash；
   - getChangedFilesSince；
   - git 不存在或命令失败降级；
   - 非法 ref/hash 行为。
2. tests/ai/client.test.js：
   - 429/500/网络错误按当前重试策略重试；
   - Retry-After 生效；
   - 超时处理；
   - OpenAI/Anthropic 错误响应不泄露过多原文。
3. tests/commands/update.test.js：
   - executeUpdates 成功写回；
   - 部分失败不会破坏原文档；
   - 备份恢复；
   - update --apply 不更新无关 section。

验证命令：
- npm test -- --runInBand tests/utils/git-utils.test.js tests/ai/client.test.js tests/commands/update.test.js
- npm test -- --runInBand
```

### P10：覆盖率脚本和 CI 输出

**目标**：让测试覆盖率可量化，但不强行设置过高门槛。

```text
请执行 P10：覆盖率脚本和 CI 输出。

重点：
1. package.json 增加脚本：
   - "coverage": "jest --coverage --runInBand"
2. 如需要，新增 jest coverage 配置，排除 web/dist、node_modules、测试 fixtures。
3. 更新 .github/workflows/ci.yml：
   - 至少运行 npm run check；
   - 可选运行 npm run coverage，但不要因低覆盖率直接失败，除非设置合理低门槛。
4. 更新 README.md、README_EN.md 开发命令说明。
5. 运行覆盖率并记录当前基线，不夸大覆盖率。

验证命令：
- npm run coverage
- npm run check
```

### P11：测试稳定性和重复测试清理

**目标**：清理重复或条件断言，减少后续重构成本。

```text
请执行 P11：测试稳定性和重复测试清理。

重点：
1. 审查 tests/integration/ai-api.test.js 与 tests/ai/client.test.js 是否完全重复。
2. 如果完全重复，删除或合并；如果有独特覆盖，保留并说明。
3. 修复 tests/commands/update.test.js 中不稳定或条件式断言，使测试确定性更强。
4. 确保 helpers 不隐藏关键断言。

验证命令：
- npm test -- --runInBand
- npm run check
```

## M3：性能优化

### P12：init AI 并发池

**目标**：降低多子项目初始化时的总等待时间。

```text
请执行 P12：init AI 并发池。

重点：
1. 在 src/commands/init.js 中引入小型 asyncPool，不新增依赖，默认 concurrency=2。
2. 保持现有 ONE_SHOT / BATCH_WITH_CONTEXT / BATCH_MINIMAL 策略语义。
3. 一个子项目失败不得导致全部失败；失败记录进入现有状态或结果输出。
4. 保持 init-state 续跑语义。
5. 测试：
   - 并发度不超过 2；
   - 一个项目失败，其他项目仍继续；
   - 续跑跳过已完成项目。

验证命令：
- npm test -- --runInBand tests/commands/init.test.js tests/commands/init-continuation.test.js
- npm test -- --runInBand
- npm run check
```

### P13：update 并发写回和 hash mtime 预筛选

**目标**：降低 `update --apply` 和 hash 模式扫描耗时。

```text
请执行 P13：update 并发写回和 hash mtime 预筛选。

重点：
1. src/commands/update.js:
   - hash 模式保存 mtimeMs + hash，兼容旧 .last-scan.json。
   - mtime 未变化时跳过 hash 计算。
2. executeUpdates:
   - 同一文档内多个 section 可并行请求 AI；
   - 最终统一写回；
   - 任何 section 失败不得破坏原文档；
   - 备份和恢复逻辑明确。
3. 测试：
   - 旧 last-scan 格式兼容；
   - mtime 未变不计算 hash；
   - 部分 section 失败恢复原文。

验证命令：
- npm test -- --runInBand tests/commands/update.test.js
- npm test -- --runInBand
- npm run check
```

### P14：Dashboard status、doctor、配置和模板缓存

**目标**：避免状态页频繁读取全文和重复执行 doctor。

```text
请执行 P14：Dashboard status、doctor、配置和模板缓存。

重点：
1. /api/status 默认只读取文件 stats，不读取所有文档全文。
2. /api/docs/:name 或类似详情接口按需读取全文，并做路径校验。
3. runDoctor({ silent: true }) 添加 30 秒 TTL 缓存；配置或 ai-docs 变化时失效。
4. getAIConfig/loadProjectConfig/getScenarios/loadTemplate 等可缓存路径添加 mtime 失效策略。
5. sensitive-filter 正则预编译。
6. 测试：
   - /api/status 不调用 readFileSync 读取全文或调用次数降低；
   - TTL 内 doctor 只运行一次；
   - 修改文件后缓存失效。

验证命令：
- npm test -- --runInBand tests/web/status-update.test.js tests/web/projects-status.test.js tests/template/engine.test.js tests/utils/config.test.js tests/utils/sensitive-filter.test.js
- npm test -- --runInBand
- npm run check
```

### P15：前端懒加载、代码分割和渲染优化

**目标**：降低 Dashboard 首屏包体和无意义重绘。

```text
请执行 P15：前端懒加载、代码分割和渲染优化。

执行前用 ctx7 查询 Vite 4 当前配置文档，避免使用不兼容配置。

重点：
1. web/src/main.js:
   - 将路由组件改为动态 import。
2. web/vite.config.js:
   - 添加保守 manualChunks，例如 vue/vendor 分包。
3. web/src/App.vue 或全局 CSS:
   - 移除全局 `*` transition；
   - 只对需要动画的元素保留 transition。
4. 如字体加载阻塞明显，改为更合理的 preload/preconnect 或本地 fallback，但不引入复杂资产流程。
5. 验证构建产物 chunk 列表，并说明收益。

验证命令：
- npm run build:web
- npm run check
```

## M4：架构和代码质量

### P16：拆分 initCommand

**目标**：把 `src/commands/init.js` 从大函数拆成清晰阶段函数。

```text
请执行 P16：拆分 initCommand。

前置：至少完成 P07 或确认现有 init 测试足够覆盖。

重点：
1. 保持 initCommand 对外签名和返回结构不变。
2. 拆分为阶段函数，建议：
   - validateRootDir
   - detectSubProjects
   - prepareOutputDir
   - scanAllProjects
   - generateProjectConfig
   - generateDocuments
   - runSensitiveInfoCheck
   - finalizeInit
3. 不改变日志语义和状态恢复语义。
4. 对拆出的纯函数添加 focused tests，如果函数仍只服务内部，可通过 init.test 间接覆盖。

验证命令：
- npm test -- --runInBand tests/commands/init.test.js tests/commands/init-continuation.test.js
- npm test -- --runInBand
- npm run check
```

### P17：扁平化 updateCommand

**目标**：降低 `src/commands/update.js` 嵌套和职责混杂。

```text
请执行 P17：扁平化 updateCommand。

重点：
1. 保持 updateCommand 和 executeUpdates 对外签名不变。
2. 提取函数：
   - detectChangedFiles
   - loadLastScan
   - saveLastScan
   - buildUpdateResult
   - groupSectionUpdates
3. 使用 early return 减少嵌套。
4. 不改变 dry-run、prompt 输出、apply 行为。

验证命令：
- npm test -- --runInBand tests/commands/update.test.js
- npm test -- --runInBand
- npm run check
```

### P18：doctor 拆分和 CLI 输出复用

**目标**：让 doctor 检查函数可复用，让 use/update prompt 输出逻辑去重。

```text
请执行 P18：doctor 拆分和 CLI 输出复用。

重点：
1. src/commands/doctor.js:
   - 拆出 checkProjectStructure、checkConfigConsistency、checkDocsCompleteness、checkDocsVsCode、checkSensitiveInfo 等函数。
   - 配置只读取一次并向下传递。
2. bin/commands/use.js 和 bin/commands/update.js:
   - 提取公共 outputPrompt helper 到合适模块，例如 src/utils/prompt-output.js 或 bin/commands/shared.js。
   - 保持 stdout/out/clipboard 降级行为不变。
3. tests:
   - doctor 原有测试全部通过；
   - use/update CLI 行为通过现有测试或新增 focused tests 覆盖。

验证命令：
- npm test -- --runInBand tests/commands/doctor.test.js tests/commands/use.test.js tests/commands/update.test.js
- npm test -- --runInBand
- npm run check
```

### P19：场景关键词迁移到 JSON

**目标**：让场景匹配关键词可配置，减少代码硬编码。

```text
请执行 P19：场景关键词迁移到 JSON。

重点：
1. templates/scenarios.json 和 templates/scenarios.en.json 增加 keywords 字段。
2. src/matcher/scenario-matcher.js 从 getScenarios() 读取 keywords。
3. 保留旧 KEYWORDS 作为兼容 fallback，或一次迁移后删除并确保测试覆盖。
4. 更新 tests/matcher/scenario-matcher.test.js：
   - 中文关键词匹配；
   - 英文关键词匹配；
   - 缺少 keywords 时 fallback 或安全返回；
   - 低置信度逻辑不变。
5. 更新 README 中场景说明，如有必要。

验证命令：
- npm test -- --runInBand tests/matcher/scenario-matcher.test.js tests/template/engine.test.js
- npm test -- --runInBand
- npm run check
```

### P20：适配器优先级、公共 API 和空模块清理

**目标**：减少 Java 特定扫描逻辑对其他项目类型的影响，清理空导出。

```text
请执行 P20：适配器优先级、公共 API 和空模块清理。

重点：
1. 将 scanner/file-scanner.js 中 Java 特有优先级下沉到 adapters：
   - BaseAdapter 可增加 getPriorityPatterns 或 getFilePriority。
   - Java/Node/Go/Python/Vue/React/uni-app 按各自类型定义。
   - 未实现适配器使用默认优先级。
2. tests/scanner/file-scanner.test.js 增加不同项目类型优先级断言。
3. src/index.js:
   - 如果保留 main 字段，就导出明确公共 API；
   - 如果没有公共 API，评估 package.json main 字段和 npm 包影响，不要草率删除。
4. src/generator/index.js 如只是无意义 re-export，评估引用后清理。

验证命令：
- npm test -- --runInBand tests/scanner/file-scanner.test.js
- npm test -- --runInBand
- npm run check
- npm pack --dry-run
```

## M5：发布工程

### P21：依赖边界和 ESLint 可用化

**目标**：让 lint 脚本可执行，锁定高风险 CJS/ESM 依赖边界。

```text
请执行 P21：依赖边界和 ESLint 可用化。

执行前：
- 用 ctx7 查询 ESLint 8 配置文档。
- 如要升级依赖，必须分别查询对应迁移说明，并单独说明风险。

重点：
1. 增加基础 ESLint 配置，适配 CommonJS + Jest。
2. npm run lint 应能执行，并只报告真实问题。
3. 评估 concurrently 是否应移到 devDependencies：
   - 如果 dashboard --dev 是开发能力，可移到 devDependencies；
   - 如果运行时依赖它，保留 dependencies 并说明。
4. 评估 clipboardy、express 精确锁版本：
   - 若锁定，更新 package-lock。
   - 说明原因：避免 CJS/ESM 或 Express 5 小版本变动。

验证命令：
- npm install --package-lock-only
- npm run lint
- npm run check
- npm pack --dry-run
```

### P22：CI matrix、coverage 和依赖安全扫描

**目标**：让 GitHub CI 更接近公开项目维护要求。

```text
请执行 P22：CI matrix、coverage 和依赖安全扫描。

执行前用 ctx7 查询 GitHub Actions setup-node 最新用法。

重点：
1. .github/workflows/ci.yml:
   - Node 18/20/22 matrix，若 Node 16 仍需支持也纳入或单独说明。
   - npm ci。
   - npm run check。
   - 可选 npm run coverage。
2. 增加 npm audit --audit-level=high 或说明为何暂不启用。
3. 确认 Dependabot 配置覆盖 npm 根目录和 web/。
4. 不引入需要外部 token 的服务。

验证命令：
- npm run check
- npm audit --audit-level=high
```

### P23：发布清单和 release checklist

**目标**：发布前有明确人工检查清单，避免非商业许可和私有文件遗漏。

```text
请执行 P23：发布清单和 release checklist。

重点：
1. 新增 docs/release-checklist.md。
2. 内容至少包括：
   - 许可证非商业边界检查；
   - npm pack 文件列表检查；
   - .env/API Key/ai-docs 私有内容检查；
   - SECURITY.md 和 GitHub Private vulnerability reporting 检查；
   - CHANGELOG 更新；
   - npm version / tag / GitHub release 流程；
   - 回滚策略。
3. package.json files 如需包含该文档，同步更新。
4. README/README_EN 文档和路线图增加链接。

验证命令：
- npm run check
- npm pack --dry-run
```

### P24：外部文档和默认模型配置复核

**目标**：避免 README 和默认模型名过时，但不盲目升级。

```text
请执行 P24：外部文档和默认模型配置复核。

执行前：
- 用 ctx7 查询 OpenAI/Anthropic SDK 或 API 文档时，必须按 AGENTS.md。
- 如查询不到模型最新信息，不要凭记忆改默认模型。
- 可用 Firecrawl 查询官方模型文档，但只采用官方来源。

重点：
1. 复核 README、README_EN、.env.example、src/utils/constants.js、src/utils/config.js 中默认 provider、baseUrl、model 名称。
2. 如果当前默认值过时，给出证据和兼容迁移方案。
3. 如修改默认值，必须保证测试通过，并说明对旧用户的影响。
4. 不要改变协议字段结构，除非有单独迁移文档。

验证命令：
- npm test -- --runInBand tests/utils/config.test.js tests/ai/client.test.js
- npm run check
```

## M6：产品能力

### P25：JSON 配置 MVP

**目标**：从可执行 JS 配置逐步迁移到可校验 JSON 配置，同时保留兼容读取。

```text
请执行 P25：JSON 配置 MVP。

重点：
1. 支持读取 code-ctx.config.json，优先级高于或低于 JS 配置需明确并文档化。
2. 增加轻量 schema 校验，不引入大型依赖；如引入 ajv，先说明依赖影响。
3. code-ctx.config.js 保留只读兼容，并提示未来迁移方向。
4. code-ctx init 可选择生成 JSON 或仍生成 JS；先做最小兼容方案。
5. Dashboard 保存配置优先写 JSON，或维持 JS 写入但文档说明；不要两边同时无规则写。
6. 文档更新 README/README_EN。

验证命令：
- npm test -- --runInBand tests/utils/config.test.js tests/commands/init.test.js tests/web/basic-api.test.js
- npm run check
```

### P26：插件系统 MVP

**目标**：允许用户扩展项目类型、扫描规则、场景模板和敏感信息规则。

```text
请执行 P26：插件系统 MVP。

重点：
1. 设计最小插件接口：
   - adapters
   - scenarios
   - sensitivePatterns
   - filePriority 或 scanPatterns
2. 支持 code-ctx.config 中配置 plugins 数组。
3. 插件加载失败不能破坏内置能力；输出可理解 warning。
4. 提供 examples/plugin-basic 或 docs/plugin-development.md。
5. 测试：
   - 加载一个本地测试插件；
   - 插件 adapter 可被识别；
   - 插件 scenarios 合并；
   - 插件失败时内置能力可用。

验证命令：
- npm test -- --runInBand
- npm run check
```

### P27：文档质量评分

**目标**：让用户知道 `ai-docs/` 是否足够发给 AI。

```text
请执行 P27：文档质量评分。

重点：
1. 在 doctor 中增加文档质量评分：
   - 完整度：overview/modules/api/database/notes 等核心 section。
   - 新鲜度：与代码变更时间或 last-scan 比较。
   - 风险：敏感信息、私有 URL、过短文档、缺失关键 section。
2. CLI 输出分为 OK / WARN / HIGH_RISK。
3. Dashboard Status 页展示评分和风险原因。
4. 不做复杂 AI 评审，先用规则评分。
5. 测试评分函数。

验证命令：
- npm test -- --runInBand tests/commands/doctor.test.js tests/web/status-update.test.js
- npm run build:web
- npm run check
```

### P28：Dashboard 安全状态页和 doctor 详情

**目标**：把安全和文档健康状态可视化。

```text
请执行 P28：Dashboard 安全状态页和 doctor 详情。

重点：
1. 后端增加或扩展 API：
   - /api/doctor 或 /api/status/detail 返回 doctor 结构化结果。
   - 复用 P14 的缓存，避免重复计算。
2. 前端 Status.vue 或新增 Security.vue：
   - 展示安全风险、文档缺失、敏感信息、配置问题。
   - 支持刷新。
   - 不展示密钥原文。
3. UI 保持现有 Dashboard 风格，不做大规模设计重写。
4. 测试 API；前端至少 build 验证。

验证命令：
- npm test -- --runInBand tests/web/status-update.test.js tests/commands/doctor.test.js
- npm run build:web
- npm run check
```

### P29：生成历史、prompt diff 和任务历史轮转

**目标**：让用户能回看生成记录，同时避免 JSONL 无限增长。

```text
请执行 P29：生成历史、prompt diff 和任务历史轮转。

重点：
1. 扩展 src/utils/task-history.js：
   - 记录 task、scenario、relatedProjects、promptPath 或 prompt hash、createdAt。
   - 默认保留最近 N 条或按文件大小轮转。
2. CLI use/update 记录历史时不保存完整敏感 prompt，或只保存路径/hash。
3. Dashboard 增加历史列表或在现有页面展示最近记录。
4. Prompt diff 先做简单文本 diff 或变更摘要，不引入复杂依赖。
5. 测试任务历史读写、轮转、敏感字段不落盘。

验证命令：
- npm test -- --runInBand tests/utils/task-history.test.js tests/commands/use.test.js
- npm run build:web
- npm run check
```

### P30：AI 客户端增强：流式、取消、token 预算、provider preset

**目标**：改善 AI 交互体验，但保持原有非流式接口兼容。

```text
请执行 P30：AI 客户端增强方案和 MVP。

注意：这是较大任务。请先输出方案，获得确认后只实现一个 MVP，推荐先做 provider preset + token 预算展示，不要一次做完流式和取消。

可选 MVP：
1. provider preset：
   - OpenAI、Anthropic、DeepSeek、Kimi、MiniMax。
   - 只填 baseUrl/protocol/model 默认值，不保存 key。
2. token 预算：
   - use/init/update 输出估算 token、maxTokens、是否可能超限。
3. 流式输出：
   - 保持 generateWithAI 原接口；
   - 新增 generateStream，不破坏旧测试。
4. 取消请求：
   - 使用 AbortController 或 Node http request destroy，需测试。

验证命令：
- npm test -- --runInBand tests/ai/client.test.js tests/commands/use.test.js
- npm run build:web
- npm run check
```

### P31：E2E smoke 和团队协作工作流

**目标**：覆盖真实 CLI 闭环和团队使用前检查。

```text
请执行 P31：E2E smoke 和团队协作工作流。

重点：
1. 新增不依赖真实 AI Key 的 E2E smoke：
   - 在临时目录创建小项目；
   - node bin/cli.js init --skip-ai；
   - node bin/cli.js use "新增登录" --stdout --no-ai-match 或等价非交互模式；
   - node bin/cli.js update --dry-run；
   - node bin/cli.js doctor。
2. 如果当前 CLI 缺少非交互能力，先补最小参数，保持兼容。
3. 增加 docs/team-workflow.md：
   - ai-docs 是否入库；
   - 提交前安全检查；
   - hook 使用策略；
   - 私有项目公开前检查。
4. package.json 增加 e2e:smoke 脚本，如合适。

验证命令：
- npm run e2e:smoke
- npm run check
- npm pack --dry-run
```

## 每个任务完成后的固定复盘提示词

任务执行完后，可以把下面这段发给同一个 AI 做自查。

```text
请对刚完成的改动做一次交付自查。

检查：
1. 是否严格只做了本任务包范围内的改动？
2. 是否有未说明的行为变化？
3. 是否有未覆盖测试的新增逻辑？
4. 是否有 .env、API Key、生成 prompt、私有 ai-docs 或本地 debug 文件被纳入 git？
5. 是否有 README、README_EN、SECURITY、CHANGELOG 或 docs 需要同步但未同步？
6. npm run check 是否通过？
7. npm pack --dry-run 是否仍只包含应发布文件？

输出：
- 风险列表，按高/中/低排序。
- 必须立即修复的问题。
- 可延后到哪个任务包的问题。
```

## 建议执行节奏

- 第 1 轮：P00。
- 第 2-4 轮：P01、P02、P03。
- 第 5-6 轮：P04、P05、P06。
- 第 7-10 轮：P07、P08、P09、P10/P11。
- 第 11-14 轮：P12、P13、P14、P15。
- 第 15-19 轮：P16、P17、P18、P19、P20。
- 第 20-23 轮：P21、P22、P23、P24。
- 第 24 轮以后：P25-P31，按你最想提升的产品能力选择，不必全部连续做。

## 暂不建议执行的事项

- 不建议在 P01-P06 前公开宣传或正式发 npm。
- 不建议同时升级 Vite、Jest、ESLint 多个大版本。
- 不建议立刻迁移全项目 ESM。
- 不建议在未完成输入校验和路径校验前增强 Dashboard 写入能力。
- 不建议把商业授权流程放进普通 issue/PR。
