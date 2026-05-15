# Code-ctx 项目完善路线图

> 基于 `docs/` 下 10 份分析报告整理。优先级以“先可安全公开、再好用、最后可扩展”为原则。

## 当前判断

Code-ctx 的方向是成立的：它把“给 AI 解释项目背景”沉淀为可复用的 `ai-docs/`、场景模板和 prompt 生成流程。架构上已经有 CLI、扫描器、适配器、模板、AI 客户端、Dashboard 和测试基础。

但在做成更完整的公开项目之前，当前最重要的不是继续加新功能，而是先把安全、测试和发布边界补齐。`docs/综合分析报告-comprehensive-analysis-report.md` 给出的综合健康度为 5.9/10，主要短板是安全 4.2、性能 5.3、测试 5.6。

## 外部资料校准

本路线图已补充外部资料判断：

- [OSI Open Source Definition](https://opensource.org/osd) 要求开源许可证不能限制商业或特定领域使用，因此 Code-ctx 当前应对外称为“源码公开 / 非商业使用”，不要称为 OSI 意义上的开源项目。
- [GitHub Private vulnerability reporting 文档](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository)建议公开仓库开启私有漏洞报告，为安全研究者提供私有、结构化的报告通道。
- [Express 5 API 文档](https://expressjs.com/en/5x/api.html)明确 `req.body` 是用户控制输入；Dashboard API 应统一做输入校验、请求体大小限制和四参数错误处理中间件。

## 第一优先级：公开前必须补齐

### 1. P0 安全修复

目标：消除直接影响公开发布可信度的问题。

必须处理：

- 配置执行链路：`loadConfigWithVM()` 不能注入 `require` 和 `process`。
- 命令执行链路：dashboard、git-utils 不使用 shell 字符串拼接。
- Dashboard 写配置：`/api/config` 必须白名单和结构校验。
- AI baseUrl：已完成字面地址和 DNS 解析后的 localhost、内网、metadata 阻断；敏感 AI API 已有基础内存限流。后续可补更细的 token/IP 策略和分布式部署方案。
- 文件路径：所有 docName、alias、请求参数拼路径处都做 allowedDir 校验。
- 错误返回：Web API 不直接返回内部 `err.message`。
- AI API：基础速率限制、save-key 长度校验、`.env` 写入权限。

验收：

- 新增安全测试。
- `npm test -- --runInBand` 通过。
- `npm run build:web` 通过。

### 2. 许可证和发布边界

目标：避免“开源但禁止商业使用”在文档里自相矛盾。

已采用方向：

- 对外表述为“源码公开 / 非商业使用”。
- LICENSE 使用项目专用非商业源码许可。
- README、README_EN、CONTRIBUTING、SECURITY、CHANGELOG 同步非商业边界。

后续建议：

- 如果未来要上 npm，确认 npm 页面和 package 元数据都明确非商业使用限制。
- 如需商业授权，单独准备商业许可流程，不通过普通 PR 处理。

### 3. 测试补齐

目标：先覆盖最容易回归的核心模块。

优先测试：

- `core/section.js`
- `core/doc-resolver.js`
- `web/middleware/security.js`
- `utils/git-utils.js`
- AI retry / continuation
- update section 写回和备份恢复

验收：

- 文件级覆盖从约 48% 提升到 65% 以上。
- 增加 coverage 命令或 CI 覆盖率输出。

## 第二优先级：明显改善体验

### 4. AI 生成性能

当前瓶颈是 AI 串行调用。对用户来说，`init` 和 `update --apply` 的等待时间最明显。

建议：

- `init` 使用并发池，默认并发度 2。
- `update --apply` 同一文档的 section 并发生成，最后统一写回。
- 失败的项目或 section 记录错误，不影响其他项目继续处理。
- 加入 token 预算和重试退避，避免触发模型服务限流。

### 5. Dashboard 状态页性能

当前 `/api/status` 类接口存在读取全文和触发完整 doctor 的风险。

建议：

- 状态接口默认只读文件 stats。
- section 列表按需读取。
- doctor 报告 30 秒 TTL 缓存。
- 前端路由懒加载。
- Vite vendor chunk 分割。

### 6. 配置体验

当前 `.env` + `code-ctx.config.js` + 运行时 JSON 状态分散。

短期建议：

- `.env.example` 完整列出所有环境变量。
- Dashboard 配置保存只允许安全字段。
- provider preset 明确列出 DeepSeek、Kimi、MiniMax、OpenAI、Anthropic。

中期建议：

- 引入 `code-ctx.config.json` + schema 校验。
- 保留 `code-ctx.config.js` 只读兼容，并提示迁移。

## 第三优先级：让项目更完整

### 7. 插件系统

Code-ctx 最适合扩展的点是项目类型、扫描规则和场景模板。

MVP：

- `code-ctx.plugins` 配置项。
- 插件导出 adapters、scenarios、sensitivePatterns。
- 插件加载失败时不影响内置能力。
- 提供一个示例插件。

### 8. 文档质量评分

目标：让用户知道 `ai-docs/` 是否值得发给 AI。

可做：

- `code-ctx doctor` 输出每份文档的完整度评分。
- 检查是否缺少 overview、modules、api、database、notes 等核心 section。
- 检查是否包含明显密钥、私有 URL、过期路径。
- Dashboard 显示“可用 / 待更新 / 高风险”。

### 9. AI 交互增强

可做：

- 流式输出。
- 取消生成。
- 生成历史和复用。
- Prompt diff 预览。
- Provider preset 和连通性诊断，明确 OpenAI 兼容、Anthropic、DeepSeek、Kimi、MiniMax 的协议差异。
- AI provider 测试结果明细。
- 低置信度场景匹配解释。

### 10. 团队协作

可做：

- `ai-docs/` 提交前检查清单。
- `code-ctx hook install` 默认只提示，不自动修改。
- 团队共享场景模板。
- 任务历史 JSONL 轮转，避免无限增长。

## 建议执行顺序

具体执行提示词见 [后续 AI 执行提示词手册](AI后续执行提示词手册-ai-execution-playbook.md)。建议按任务包推进：

1. `P00`：当前状态复核和任务拆分校准。
2. `P01-P06`：公开前安全加固。
3. `P07-P11`：测试体系补齐。
4. `P12-P15`：性能优化。
5. `P16-P20`：架构和代码质量。
6. `P21-P24`：发布工程。
7. `P25-P31`：产品能力。

## 不建议现在做

- 不建议先做大规模 UI 重写。Dashboard 已经可用，当前瓶颈是安全和质量。
- 不建议为了追新直接迁移全项目 ESM。chalk、clipboardy 的 CJS/ESM 问题可以先锁版本。
- 不建议一次性升级 Vite、Jest、ESLint 多个大版本。应拆成独立 PR，并使用 `ctx7` 查最新迁移说明。
- 不建议在 P0 安全修复前发布 npm 或公开宣传。
