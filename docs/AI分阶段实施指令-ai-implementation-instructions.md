# Code-ctx AI 分阶段实施指令

> 用途：把下面任一阶段的指令直接复制给 AI 编程助手执行。每个阶段都要求 AI 先阅读 `docs/`，再基于当前代码验证，不允许只按报告猜测修改。
>
> 如果你需要更细粒度、逐任务执行的提示词，请优先使用 [后续 AI 执行提示词手册](AI后续执行提示词手册-ai-execution-playbook.md)。

## 使用方式

1. 每次只复制一个阶段，避免一次改动过大。
2. 每个阶段都要求 AI 输出修改文件、验证命令和剩余风险。
3. 如果 AI 遇到报告与代码不一致，以当前代码为准，并在结果中说明差异。
4. 涉及库、框架、SDK、CLI 或云服务文档时，必须按本仓库 AGENTS.md 规则使用 `ctx7` 获取最新文档。

---

## 外部资料补充规则

- 许可证和公开表述：已用 Firecrawl 查询 [OSI Open Source Definition](https://opensource.org/osd)。因为本项目禁止商业使用，不应自称 OSI 意义上的 open source；统一使用“源码公开 / source-available / 非商业使用”。
- 安全披露：已用 Firecrawl 查询 [GitHub Private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository)。公开仓库建议开启 GitHub 私有漏洞报告；未开启时，报告者按 SECURITY.md 联系维护者。
- 技术文档：已用 Context7 查询 [Express 5 API 文档](https://expressjs.com/en/5x/api.html)。修改 Dashboard API 时必须把 `req.body` 视为不可信输入，`express.json()` 设置合理 `limit`，错误处理中间件使用 `(err, req, res, next)` 四参数签名。
- 后续涉及 Vite、Jest、ESLint、commander、npm package 发布等工具时，继续按 AGENTS.md 先用 `ctx7` 获取当前文档。

---

## 通用前置指令

```text
你正在维护 D:\workspace\codecontext 的 Code-ctx 项目。

先完整阅读 docs/ 目录下所有文档，至少包括：
- docs/项目分析报告-project-analysis-report.md
- docs/架构分析报告-architecture-analysis-report.md
- docs/代码质量报告-code-quality-report.md
- docs/安全审计报告-security-audit-report.md
- docs/性能分析报告-performance-analysis-report.md
- docs/测试质量报告-test-quality-report.md
- docs/依赖配置报告-dependency-config-report.md
- docs/综合分析报告-comprehensive-analysis-report.md
- docs/问题跟踪清单-issue-tracker.md
- docs/改进修复计划-repair-plan.md

阅读后再检查当前代码，不要假设报告仍完全准确。以当前代码为最终依据。

项目约束：
- Node.js + CommonJS 项目，CLI 入口在 bin/cli.js。
- Dashboard 后端在 src/web/，前端在 web/。
- 不提交 .env、API Key、生成 prompt、私有项目文档。
- 当前许可证为非商业源码许可，禁止商业使用；不要把文档写成 MIT 或 OSI 标准开源。
- 所有行为变更都要补测试或说明无法补测试的原因。
- 修改后至少运行 npm test -- --runInBand；涉及前端时运行 npm run build:web；最后尽量运行 npm run check。

输出要求：
- 列出改动文件。
- 列出验证命令和结果。
- 列出未处理风险和建议的下一阶段。
```

---

## 阶段 1：P0 安全修复

```text
请执行 Code-ctx 第一阶段 P0 安全修复。

目标：处理 docs/安全审计报告-security-audit-report.md、docs/问题跟踪清单-issue-tracker.md、docs/改进修复计划-repair-plan.md 中的 P0/P1 安全风险，优先解决可导致 RCE、命令注入、SSRF、路径穿越、错误信息泄露和 API 滥用的问题。

必须先阅读 docs/ 全部文档，然后核对当前代码。

重点任务：
1. 修复 SEC-001：src/utils/config.js 中 loadConfigWithVM 不得向 vm 沙箱注入 require、process、__dirname、__filename 等高风险对象。保留现有简单 module.exports 配置能力；如果现有配置依赖 require，需要给出兼容方案或迁移说明。
2. 修复 SEC-002 和 SEC-004：bin/commands/dashboard.js、src/utils/git-utils.js 中不要用字符串拼接执行 shell 命令；改为 spawnSync、execFile 或安全参数数组。路径和端口必须校验。
3. 修复 SEC-003：src/web/api/config.js 的 PUT /api/config 添加配置白名单和结构校验，防止原型污染和任意键写入。
4. 修复 SEC-005：AI baseUrl 增加 validateBaseUrl，禁止 localhost、127.0.0.1、0.0.0.0、169.254.*、10.*、172.16-31.*、192.168.*、::1 等内网地址。正常 OpenAI/Anthropic/DeepSeek/Kimi 兼容地址不应被误伤。
5. 修复 SEC-006：Web API 不应直接返回内部 err.message。添加统一错误处理或逐路由改造，客户端返回通用错误，服务端日志保留排查信息。
6. 按 Express 5 文档补强 API 安全基线：所有 req.body、query、params 使用前校验；express.json 设置 limit；错误处理中间件保持 (err, req, res, next) 四参数签名；静态文件 root 固定，不能由请求参数决定。
7. 修复 SEC-007：所有从请求参数、docName、alias 拼接文件路径的地方使用 path.resolve + allowedDir 前缀校验。
8. 修复 SEC-008、SEC-009、CODE-007：为敏感 AI API 添加基础内存速率限制；save-key 增加长度和换行校验；写 .env 时使用 0o600 权限。

测试要求：
- 为新增安全逻辑补充单元测试或 Web API 测试。
- 覆盖恶意配置不能 require child_process。
- 覆盖特殊字符路径不会注入命令。
- 覆盖内网 baseUrl 被拒绝、正常 https baseUrl 通过。
- 覆盖未授权或超限请求返回合理状态。

验证命令：
- npm test -- --runInBand
- npm run build:web
- npm run check

不要做范围外的大重构；如果某项需要大迁移，先实现最小安全修复并记录后续计划。
```

---

## 阶段 2：核心测试补齐

```text
请执行 Code-ctx 第二阶段核心测试补齐。

目标：根据 docs/测试质量报告-test-quality-report.md 和 docs/问题跟踪清单-issue-tracker.md，补齐当前最高风险但缺少直接测试的模块。

必须先阅读 docs/ 全部文档，然后核对当前代码。

重点任务：
1. 新增 tests/core/section.test.js，覆盖 extractSection、replaceSection、listSections：
   - 正常多行提取；
   - 不存在 section；
   - section 名含连字符等特殊字符；
   - 多 section 列表；
   - 重复 section；
   - 替换后保留标记和外围内容。
2. 新增 tests/core/doc-resolver.test.js，覆盖 findRelatedDoc、groupChangesByProject：
   - 按项目目录分组；
   - 忽略 ai-docs；
   - 找到关联文档；
   - 无匹配返回空结果；
   - Windows 风格路径和 POSIX 风格路径。
3. 新增 tests/web/security.test.js，覆盖 localhostOnly、tokenAuth 或 createServer 下的实际 API 行为：
   - localhost 请求允许；
   - DASHBOARD_TOKEN 设置后无 token 拒绝；
   - token 错误拒绝；
   - token 正确通过。
4. 新增 tests/utils/git-utils.test.js，mock child_process，覆盖：
   - hasGitRepo；
   - getCurrentCommitHash；
   - getChangedFilesSince；
   - invalid commit hash；
   - git 命令失败降级。
5. 提取重复的 Web API requestJson helper 到 tests/helpers/http.js，并改造现有重复测试文件。
6. 删除或合并与 tests/ai/client.test.js 完全重复的 tests/integration/ai-api.test.js，前提是确认无额外覆盖价值。

验证要求：
- npm test -- --runInBand
- 如果 package.json 没有 coverage 脚本，可运行 npm test -- --runInBand --coverage 并说明覆盖率变化。

不要修改生产逻辑，除非测试暴露真实 bug；如需改生产逻辑，保持最小变更并说明原因。
```

---

## 阶段 3：性能优化

```text
请执行 Code-ctx 第三阶段性能优化。

目标：根据 docs/性能分析报告-performance-analysis-report.md 和 docs/改进修复计划-repair-plan.md，优先解决用户可感知的分钟级延迟和 Dashboard 状态 API 过慢问题。

必须先阅读 docs/ 全部文档，然后核对当前代码。

重点任务：
1. init 文档生成引入保守并发池，默认 concurrency=2。保留现有状态恢复和错误记录语义，不能因为一个项目失败导致全部失败。
2. update --apply 的同一文档 section 更新可并行请求 AI，最后统一写回成功结果；失败 section 必须记录，不得破坏原文档。
3. hash 模式文件变化检测使用 mtime 预筛选，只对 mtime 变化的文件计算 hash；更新 .last-scan.json 时保存必要的 hash 和 mtime 信息，并兼容旧格式。
4. /api/status 不要默认读取所有文档全文；只返回 stats，section 可按需读取。
5. Dashboard 中 runDoctor({ silent: true }) 添加短 TTL 缓存或按需触发，避免每次 status 请求完整检查。
6. config、template、getToolDirectory、sensitive-filter 正则等适合缓存的路径添加 mtime 或模块级缓存。
7. web/src/main.js 使用路由懒加载；web/vite.config.js 可配置 vendor chunk 分割；移除全局 * transition 造成的渲染压力。

测试要求：
- 保持现有命令行为兼容。
- 新增或更新测试覆盖并发失败、旧 .last-scan.json 兼容、status API 不读全文等关键行为。

验证命令：
- npm test -- --runInBand
- npm run build:web
- npm run check

输出中请给出性能改动的理论收益和未做基准测试的限制。
```

---

## 阶段 4：代码质量和架构整理

```text
请执行 Code-ctx 第四阶段代码质量和架构整理。

目标：根据 docs/代码质量报告-code-quality-report.md、docs/架构分析报告-architecture-analysis-report.md 和 docs/问题跟踪清单-issue-tracker.md，在不改变外部行为的前提下提升可维护性。

必须先阅读 docs/ 全部文档，然后核对当前代码。

重点任务：
1. 拆分 src/commands/init.js 中过长的 initCommand，使主函数只负责编排，阶段函数包括目录校验、项目检测、扫描、配置生成、文档生成、安全检查和结果输出。
2. 扁平化 src/commands/update.js，提取 detectChangedFiles、loadLastScan、saveLastScan、buildUpdateResult 等函数，减少嵌套。
3. doctorCommand 拆成独立检查函数，并避免重复读取配置。
4. 消除空 catch 块，至少记录可操作的 warn。
5. 提取 bin/commands/update.js 和 use.js 的 prompt 输出公共逻辑。
6. fix.js 使用统一配置加载方式，避免 require 缓存。
7. 将场景关键词从 matcher 硬编码迁移到 templates/scenarios.json，并保持旧数据兼容。
8. 将 Java 特定文件优先级逐步下沉到适配器，避免影响 Go/Python/Node 项目扫描。
9. 清理无意义 re-export 或空模块；如果保留 src/index.js，需要导出明确公共 API。

测试要求：
- 重构前后公开命令行为不变。
- 对拆出的纯函数补充 focused tests。

验证命令：
- npm test -- --runInBand
- npm run build:web
- npm run check

不要顺手做大规模格式化，避免无关 diff。
```

---

## 阶段 5：依赖、配置和发布准备

```text
请执行 Code-ctx 第五阶段依赖、配置和发布准备。

目标：根据 docs/依赖配置报告-dependency-config-report.md、README、LICENSE 和 package.json，让项目更适合公开发布，但仍保持非商业使用限制。

必须先阅读 docs/ 全部文档，然后核对当前代码。

重点任务：
1. package.json license 字段与 LICENSE 保持一致，不再标注 MIT。
2. package-lock.json 顶层 license 同步。
3. .env.example 补充 AI_TIMEOUT、DASHBOARD_TOKEN、AI_DEBUG、AI_DEBUG_RESPONSE、OPENAI_BASE_URL、OPENAI_MODEL、ANTHROPIC_BASE_URL、ANTHROPIC_MODEL 等说明。
4. package.json files 字段补充 .env.example、README_EN.md、CHANGELOG.md、SECURITY.md 等必要发布文档；不要包含 .env、ai-docs 私有产物或本地 debug 文件。
5. concurrently 移到 devDependencies，确认 dashboard --dev 仍正常。
6. clipboardy、express 可考虑锁定精确版本，避免 CJS/ESM 或 Express v5 小版本变动风险。
7. 增加基础 ESLint 配置，让 npm run lint 实际可用。
8. 谨慎升级低风险依赖；涉及 Vite、Jest、ESLint 大版本升级时必须使用 ctx7 查询最新迁移说明，并单独提交。
9. README 和 README_EN 同步当前真实能力、已知风险、非商业许可和开发命令。
10. README 中链接到 docs/ 的公开入口应确保随 npm pack 发布；未随包发布的深度审计报告可作为仓库内维护材料说明。

验证命令：
- npm install 或 npm ci
- npm test -- --runInBand
- npm run build:web
- npm run check
- npm pack --dry-run

输出中说明 npm 发布包会包含哪些关键文件，以及哪些文件被排除。
```

---

## 阶段 6：产品完善和长期能力

```text
请执行 Code-ctx 第六阶段产品完善分析和方案落地。

目标：在前五阶段安全和质量基础完成后，把 Code-ctx 做得更完整、更好。

必须先阅读 docs/ 全部文档，然后核对当前代码和 README。

请先输出一份方案，再按优先级实现最小闭环：
1. 插件系统：支持自定义项目类型适配器、场景模板、文件优先级和敏感信息规则。
2. 配置现代化：从 code-ctx.config.js 逐步迁移到 code-ctx.config.json + schema 校验，保留兼容读取。
3. AI 客户端能力：流式输出、取消请求、token 预算展示、provider preset、重试和限流可配置。
4. Dashboard 能力：安全状态页、doctor 详情页、任务历史、生成记录、文档 diff 预览、项目扫描进度。
5. 文档质量：生成文档评分、缺失 section 自动提示、团队协作规范、ai-docs 公开前检查清单。
6. 测试体系：E2E 覆盖 init -> use -> update -> doctor -> dashboard；覆盖率门禁；安全回归用例。
7. 发布工程：npm pack 验证、release checklist、Dependabot/Renovate、npm audit、GitHub Actions matrix。

要求：
- 不要一次性做所有长期能力。
- 先选 1-2 个性价比最高、风险最低的功能做 MVP。
- 每个功能必须有 README 或 docs 说明。
- 每个功能必须有测试或可复现手动验证。

验证命令：
- npm test -- --runInBand
- npm run build:web
- npm run check
```
