# Code-ctx 技术问题优先级清单

> 审查范围：开源项目质量、技术实现、开发者体验、测试与 CI。
> 不包含商业化、定价、市场或盈利分析。
> 优先级定义：`P0` 阻断核心价值或可能造成数据/状态错误；`P1` 严重影响正确性、可靠性或主要用户流程；`P2` 影响扩展性、维护成本或次要体验；`P3` 工程完善项。

## 总览

> 执行状态（2026-07-16）：P0（7/7）、P1（15/15）、P2（17/17）和 P3（10/10）已全部完成。每个问题均经过针对性测试、独立提交并推送 Gitee；最终质量门禁和生产依赖审计均通过。
> 各问题中的“证据”与行号保留原始审查快照，不代表当前实现；请以完成记录中的提交和当前测试为准。

| 优先级 | 数量 | 处理原则 |
|---|---:|---|
| P0 | 7 | 发布下一稳定版本前必须解决 |
| P1 | 15 | 紧随 P0 修复，不能长期积压 |
| P2 | 17 | 纳入近期架构和 DevEx 迭代 |
| P3 | 10 | 持续改善 |

### 完成记录

| 问题 | 提交 | 问题 | 提交 |
|---|---|---|---|
| P0-01 | `f93837b` | P0-02 | `12754a8` |
| P0-03 | `9ffaf5e` | P0-04 | `399d2aa` |
| P0-05 | `d3a428c` | P0-06 | `cbcbfa5` |
| P0-07 | `6b22d8c` | P1-01 | `403216a` |
| P1-02 | `6ad1a63` | P1-03 | `eaecfaa` |
| P1-04 | `a0f189f` | P1-05 | `28531e1` |
| P1-06 | `dad179b` | P1-07 | `12bb75c` |
| P1-08 | `8b9cc3b` | P1-09 | `c96889f` |
| P1-10 | `2981660` | P1-11 | `71a19f3` |
| P1-12 | `341f623` | P1-13 | `847df8a` |
| P1-14 | `5418171` | P1-15 | `800a2d1` |

| 问题 | 提交 | 问题 | 提交 |
|---|---|---|---|
| P2-01 | `b06e638` | P2-02 | `dc665a3` |
| P2-03 | `47e66f1` | P2-04 | `f1a7eaf` |
| P2-05 | `46101cf` | P2-06 | `ec446d9` |
| P2-07 | `0af688a` | P2-08 | `5dd1f42` |
| P2-09 | `aa3cae3` | P2-10 | `f00e7cf` |
| P2-11 | `fa34fd9` | P2-12 | `16661bc` |
| P2-13 | `8799c19` | P2-14 | `cd25644` |
| P2-15 | `d5419da` | P2-16 | `6d4146b` |
| P2-17 | `097fdaa` | P3-01 | `da1a809` |
| P3-02 | `eb9c668` | P3-03 | `4a53238` |
| P3-04 | `1e9f90f` | P3-05 | `bd590ca` |
| P3-06 | `fa74918` | P3-07 | `65957a0` |
| P3-08 | `4386b63` | P3-09 | `8053c3b` |
| P3-10 | `0960509` |  |  |

## P0：核心能力阻断

### P0-01 扫描结果没有向 AI 提供源码内容（已完成）

- **影响**：AI 无法看到函数、路由、依赖声明、数据模型或业务逻辑，只能根据目录名和文件名猜测。生成文档无法保证事实正确。
- **证据**：`src/scanner/file-scanner.js:66-80` 读取文件内容只用于估算 token；`src/scanner/file-scanner.js:40-45` 返回的 `keyFiles` 仍是路径数组；`src/generator/prompt-builder.js:139-146` 仅把路径 `join('\n')` 后放入 Prompt。
- **完成标准**：Scanner 输出包含相对路径、语言、hash、脱敏后源码片段和截断信息的结构化快照；Prompt 中包含真实源码证据；增加测试断言源码内容而非仅文件名进入请求。

### P0-02 增量更新 Prompt 不包含 diff 或变化后的源码（已完成）

- **影响**：AI 收到的只有变化文件名和旧文档，无法知道代码究竟改了什么；所谓增量更新在语义上不可成立。
- **证据**：`src/commands/update.js:205-210` 只传入 `changedFiles` 和 `sectionContent`；`templates/update-prompt.md:1-9` 没有源码或 patch 占位符。
- **完成标准**：Git 模式传入受限大小的 patch；hash 模式传入新旧摘要或当前源码；删除文件必须带明确删除事件；Prompt 预算超限时进行确定性分块。

### P0-03 更新状态在文档实际更新前提交（已完成）

- **影响**：默认 `update`、API Key 缺失、AI 失败或写盘失败后，变化都可能被标记为已经处理，下一次运行不再重试。
- **证据**：`src/commands/update.js:369-370` 在 CLI 决定是否 `--apply` 之前写入 `.last-scan.json`；真正的 AI 更新直到 `bin/commands/update.js:69-70` 才发生；`src/commands/watch.js:34-50` 也复用同一错误顺序。
- **完成标准**：将检测状态、生成状态和已提交状态分离；只有全部目标文档成功原子写入后才更新扫描基线；部分失败保留逐文件/逐 section 的待重试状态。

### P0-04 默认 `update` 在有 section 时可能什么都不输出，却消费变化（已完成）

- **影响**：存在 section 标记时，`prompt` 被设为 `null`；不加 `--apply` 的默认命令只打印 section 列表，不复制 Prompt、不更新文档，但扫描状态已经前移。
- **证据**：`src/commands/update.js:363-367` 仅在没有 section 更新时构造全量 Prompt；`bin/commands/update.js:79-86` 只在 `result.prompt` 非空时输出。
- **完成标准**：明确默认语义。建议默认生成可执行的合并 Prompt且不提交状态；`--apply` 成功后才提交状态；或者要求显式选择 `--prompt/--apply` 并对无动作返回非零或清晰警告。

### P0-05 `init` 吞掉 AI 失败并无条件报告成功（已完成）

- **影响**：网络、鉴权、Token 超限或模型错误不会反映为失败退出码；自动化和用户都会误以为文档已经生成。
- **证据**：`src/commands/init.js:521-564` 捕获异常后不重新抛出；`src/commands/init.js:599-605` 无条件打印“初始化完成”；`src/commands/init.js:628` 忽略 `generateDocuments` 返回的 `failedDocs`。
- **完成标准**：生成失败时返回结构化失败结果并设置非零退出码；部分成功应明确列出成功、失败和可重试对象；不得在零文档或有失败时打印无条件成功。

### P0-06 根项目不会被探测，零项目仍可“成功初始化”（已完成）

- **影响**：普通单项目仓库是最常见输入，但探测器只检查根目录的子目录。工具可能创建空 `ai-docs/` 和空配置后宣告成功。
- **证据**：`src/scanner/project-detector.js:93-107` 仅对目录 entry 调用检测，从未检测 `rootDir`；`src/commands/init.js:149-179` 对零项目不报错；当前仓库 `ai-docs/.last-scan.json:4` 实际记录 `projects: []`。
- **完成标准**：优先检测根目录自身；支持“根项目 + monorepo 子项目”；无法识别时提供 generic 项目或交互式选择；零项目必须给出可操作错误。

### P0-07 文档质量体系无法识别事实错误（已完成）

- **影响**：章节齐全、mtime 较新且没有敏感词的幻觉文档可以获得 `OK`，质量分会给用户错误信心。
- **证据**：`src/utils/doc-quality.js:37-43` 只按 section 完整度评分；`src/utils/doc-quality.js:76-93` 只考虑 mtime 和简单风险；`src/utils/doc-quality.js:199-206` 据此生成总分和等级。
- **完成标准**：增加可验证事实指标，例如文件/符号引用可解析率、路由和依赖与源码的一致率、来源引用覆盖率；将“格式健康”和“事实可信度”拆成不同维度。

## P1：严重正确性与可靠性问题

### P1-01 文档映射依赖旧文档中的目录名子串（已完成）

- **影响**：变化文件可能匹配错误文档；同名目录、多层 monorepo 和根目录文件无法可靠处理。
- **证据**：`src/core/doc-resolver.js:13-18` 使用顶层目录名和 `docContent.includes(dirName)` 决定归属。
- **完成标准**：以配置中的规范化项目根路径做最长前缀匹配；文档 manifest 明确记录项目 ID 和源路径，禁止通过正文猜归属。

### P1-02 每次增量更新会刷新猜中文档的全部 section（已完成）

- **影响**：一次局部改动最多触发七次 AI 请求，成本高且会无谓改写无关内容，引入文档漂移。
- **证据**：`src/commands/update.js:197-213` 遍历 `listSections()` 的所有结果，没有影响分析。
- **完成标准**：建立文件类型/符号到 section 的确定性映射；无法判断时只标记待确认，或用单次规划请求选择受影响 section。

### P1-03 hash 模式无法识别删除文件（已完成）

- **影响**：删除 API、模型或模块后，文档会永久保留旧信息。
- **证据**：`src/commands/update.js:122-128` 只遍历 `currentFiles`，没有比较旧状态中已消失的 key。
- **完成标准**：计算新增、修改、删除三类集合；为删除事件保留旧路径、旧 hash 和所属项目。

### P1-04 `--dry-run --apply` 仍会写文档（已完成）

- **影响**：违反 CLI 的最基本安全预期，用户以为只预览却可能触发外部 API 和文件写入。
- **证据**：`bin/commands/update.js:14` 只把 dry-run 传给检测函数；`bin/commands/update.js:46-70` 仍独立执行 apply 分支。
- **完成标准**：Commander 参数层将两者设为互斥；业务层再次拒绝冲突组合；增加端到端负向测试。

### P1-05 `--apply` 缺少 API Key 时会输出空 Prompt并丢失更新（已完成）

- **影响**：section 模式下 `result.prompt` 通常为 `null`，未配置 Key 时复制的是空字符串，状态却已经提交。
- **证据**：`bin/commands/update.js:59-65` 使用 `result.prompt || ''`；状态前移见 `src/commands/update.js:369-370`。
- **完成标准**：配置校验必须发生在任何状态变更之前；始终能够生成包含全部 section 请求的手工 Prompt；空 Prompt 必须视为错误。

### P1-06 section 写盘失败仍可能计为成功（已完成）

- **影响**：`success` 在实际写盘前累计；写盘失败后虽然尝试恢复备份，返回统计仍会报告成功。
- **证据**：`src/commands/update.js:323-338` 先增加 `success`，后调用 `applySectionUpdates`；`src/commands/update.js:339-349` 写入失败未修正结果状态。
- **完成标准**：只有原子 rename 成功后才能将结果标为成功；写入或恢复失败必须覆盖所有相关 section 的最终状态。

### P1-07 Token 截断续写依赖模型自觉输出标记（已完成）

- **影响**：模型不输出 `<<<CONTINUE>>>` 时，因长度限制截断的文档会被当作完整文档。
- **证据**：`src/ai/client.js:511-537` 只检查文本标记，不读取 provider 的 finish/stop reason。
- **完成标准**：解析 OpenAI `finish_reason` 和 Anthropic stop reason；基于结构完整性和输出状态决定续写；达到续写上限时明确失败。

### P1-08 Token 预算与真正发送的数据不一致（已完成）

- **影响**：程序读取完整源码计算最高 500000 token，却实际只发送路径；策略选择、性能预期和警告都失真。未来加入源码后又可能直接超出模型上下文。
- **证据**：`src/scanner/file-scanner.js:59-83` 按源码估算；`src/commands/init.js:262-282` 据此选策略；`src/utils/constants.js:16-19` 默认上限为 500000；`CONTEXT_LIMITS` 定义于 `src/utils/constants.js:8-14` 但没有消费者。
- **完成标准**：对最终序列化 Prompt 做预算；输入和输出预算分离；所有限制常量必须在生产路径中实际生效。

### P1-09 配置写入绝对项目路径，无法跨机器复用（已完成）

- **影响**：提交到 Git 后会暴露本机路径并在其他开发者机器上失效，也与 README 示例不一致。
- **证据**：`src/scanner/project-detector.js:102-106` 保存绝对 `projectDir`；`src/commands/init.js:230-235` 原样写入配置；测试在 `tests/commands/init.test.js:86-97` 将绝对路径固化为预期。
- **完成标准**：持久化路径一律相对根目录；运行时再 resolve；加载旧配置时提供迁移和越界校验。

### P1-10 `skip-ai` 不会生成可用的确定性文档（已完成）

- **影响**：它被描述为“只扫描项目结构”，实际扫描结果随后被丢弃，`ai-docs/` 只剩状态文件，无法作为离线降级方案。
- **证据**：`src/commands/init.js:506-507` 直接返回空生成结果；`src/commands/init.js:590-596` 最终状态仅保存项目 alias，不保存树或文件清单。
- **完成标准**：`--skip-ai` 应输出确定性的项目 manifest/Markdown，包括项目、技术栈证据、目录树和关键文件，且无需模型即可被 `use` 消费。

### P1-11 项目类型覆盖过窄且模式硬编码（已完成）

- **影响**：普通 Vue 3、Fastify、TypeScript Express、非标准目录、现代 Next.js JS/JSX 文件等会漏扫或只扫到极少文件。
- **证据**：Vue3 强制要求 Element Plus，见 `src/adapters/builtin/vue3-admin.js:7-12`；Node 仅扫描三个 JS 模式，见 `src/adapters/builtin/node-backend.js:7-12`；Next.js 只扫描 TS API/lib，见 `src/adapters/builtin/nextjs.js:12-16`。
- **完成标准**：框架识别和 UI 库识别解耦；提供 generic JS/TS、generic backend 和 unknown adapter；扫描模式支持配置覆盖并有真实 fixture。

### P1-12 输入 Prompt 未经过统一隐私过滤（已完成）

- **影响**：初始化 Prompt 包含绝对路径和其他项目文档摘要，可能向外部模型泄露用户名、目录结构或已有敏感上下文；过滤发生在模型输出之后。
- **证据**：`src/generator/prompt-builder.js:141-146` 放入项目绝对路径和关键文件；`src/commands/init.js:344-347` 调用 AI 后才执行 `filterSensitive`。
- **完成标准**：所有出站 Prompt 经过同一 redaction gateway；默认仅发送相对路径；输出审计报告说明哪些字段被移除。

### P1-13 one-shot 文档拆分依赖脆弱的模型标题格式（已完成）

- **影响**：模型稍微改变标题、重复 alias 或输出额外二级标题，就可能拆分失败并写入“文档生成中”占位文件。
- **证据**：`src/commands/init.js:349-363` 使用正则按 `## alias` 切分自由文本。
- **完成标准**：要求结构化 JSON 或明确的机器边界；每个子项目独立校验后写入；失败不得写成 completed。

### P1-14 AI 请求最长可能长时间无响应且无法取消（已完成）

- **影响**：单请求默认 180 秒并可重试三次，CLI 没有 AbortSignal 或用户取消机制，首次使用很像卡死。
- **证据**：`src/utils/constants.js:27-32` 定义超时和重试；`src/ai/client.js:233-305` 使用递归定时重试，没有取消信号。
- **完成标准**：支持 AbortController、总耗时上限和 Ctrl+C 清理；区分单次超时与整个操作 deadline。

### P1-15 调试脚本会输出 API Key 前缀（已完成）

- **影响**：日志、截图或 CI 输出会泄露密钥的前 10 个字符，与仓库安全规范冲突。
- **证据**：`test-api-debug.js:9-16` 打印配置并截取 API Key；`CONTRIBUTING.md:44-50` 明确要求不提交 API Key 和本地调试脚本。
- **完成标准**：删除脚本或改造成正式、全脱敏的 `doctor --check-ai`；任何日志只输出 provider/key 是否存在和不可逆指纹末尾少量字符。

## P2：架构、维护性与测试缺口

### P2-01 `init.js` 是职责过载的流程巨石（已完成）

- **影响**：扫描、策略、AI、状态、并发、校验和写盘耦合在 600 多行文件中，难以替换组件或精确测试事务边界。
- **证据**：`src/commands/init.js:1-636`；主函数在 `src/commands/init.js:608-633` 直接编排所有副作用。
- **完成标准**：拆为 discovery、snapshot、planning、generation、validation、commit 六个服务；通过依赖注入提供 AI、FS、clock 和 state store。

### P2-02 Adapter 存在未使用的扩展点（已完成）

- **影响**：贡献者实现 `getPromptHints()`、`extractKeyFiles()` 不会产生任何效果，接口具有误导性。
- **证据**：定义见 `src/adapters/base.js:36-41`，各内置适配器均实现；生产代码只使用 registry 的 detect、scanPatterns 和 priority，见 `src/adapters/registry.js:17-35`。
- **完成标准**：要么接入扫描和 Prompt 规划，要么从公共接口删除；为每个扩展点增加契约测试。

### P2-03 插件 Adapter 校验契约自相矛盾（已完成）

- **影响**：鸭子类型对象能通过插件校验，却会被 registry 的 `instanceof BaseAdapter` 拒绝。
- **证据**：`src/plugins/loader.js:164-166` 与 `src/adapters/registry.js:10-13`。
- **完成标准**：统一为显式 schema/接口校验或统一继承要求；错误应在加载前一次性报告。

### P2-04 插件使用进程级全局可变状态（已完成）

- **影响**：Dashboard 多项目、程序化 API 和并行测试可能发生跨 root 污染；重新注册 Adapter 后 registry 本身也不会随 `_reset()` 清空。
- **证据**：`src/plugins/state.js:10-18` 保存单例状态；`src/plugins/loader.js:269-275` reset state 后向全局 `defaultRegistry` 注册。
- **完成标准**：创建每个 root/request 独立的运行上下文和 registry；插件加载结果可缓存但必须不可变且按 root 键控。

### P2-05 配置 schema 只警告，不阻止无效配置进入运行路径（已完成）

- **影响**：类型或字段错误可能在更深层以难懂异常爆炸，schema 的“安全”承诺有限。
- **证据**：`src/utils/config.js:120-127` 只 `console.warn` 后继续返回配置。
- **完成标准**：区分可迁移警告与阻断错误；CLI 提供 `config validate`；写入和加载共享同一严格 schema。

### P2-06 JS 配置仍执行动态代码（已完成）

- **影响**：VM 并非可靠安全边界，项目自己也把它列为已知风险；插件和旧配置共同扩大执行面。
- **证据**：`src/utils/config.js:130-142` 使用 `vm.runInNewContext`；`README.md:280-283` 仍将沙箱边界列为风险。
- **完成标准**：默认停止生成 JS 配置，给出迁移工具；长期移除执行式配置或只解析受限数据语法。

### P2-07 更新扫描忽略用户配置的 excludeDirs（已完成）

- **影响**：大型仓库会遍历 coverage、vendor、缓存或生成目录，造成性能和错误变更噪声。
- **证据**：`src/commands/update.js:15` 使用硬编码列表；`src/commands/update.js:37-51` 全量递归，不读取项目配置。
- **完成标准**：统一 ignore engine，合并 `.gitignore`、默认规则和 `excludeDirs`；Scanner、update、doctor、watch 共用。

### P2-08 大量同步文件系统操作阻塞 CLI 和 Dashboard（已完成）

- **影响**：大仓库中 `readdirSync/readFileSync/statSync` 会阻塞事件循环，Dashboard 请求期间尤为明显。
- **证据**：`src/scanner/file-scanner.js:68`、`src/commands/update.js:41-48`、`src/commands/update.js:103-119`。
- **完成标准**：使用受控并发的异步 IO；大文件先 stat 和采样；为扫描设置时间、文件数和字节预算。

### P2-09 token 限制算法会因一个大文件提前停止（已完成）

- **影响**：遇到超预算文件后直接 `break`，后面大量更小、更关键的文件不会被考虑；第一个文件即使超预算仍会被加入。
- **证据**：`src/scanner/file-scanner.js:73-80`。
- **完成标准**：先按价值/大小规划；超大文件分段或跳过并继续；返回被跳过原因。

### P2-10 生成配置存在内存配置与磁盘配置不一致（已完成）

- **影响**：已有配置且未 force 时，函数不加载磁盘内容，而是返回本轮新构造的默认配置；后续 overview 可能忽略已有 label、插件或自定义项目信息。
- **证据**：`src/commands/init.js:223-247` 在配置存在时直接返回局部 `config`。
- **完成标准**：读取并规范化现有配置，与新探测结果执行可审计 merge；明确冲突策略。

### P2-11 Overview 只取子文档前 20 行却要求推断全局关系（已完成）

- **影响**：API、依赖和数据流常位于后续 section，模型依据残缺摘要生成依赖矩阵，容易幻觉。
- **证据**：`src/generator/prompt-builder.js:88-99`；模板要求架构和依赖矩阵见 `templates/scan-prompt-overview.md:10-16`。
- **完成标准**：按 section 提取结构化摘要；关系必须从 import、workspace、调用配置等证据生成并带引用。

### P2-12 `use` 的压缩策略固定丢弃关键 section（已完成）

- **影响**：Prompt 超过 8000 字符后，只保留 overview、modules、notes，API、data、dependencies 等任务关键内容会消失。
- **证据**：`src/commands/use.js:13-18` 定义固定 section；`src/commands/use.js:94-119` 执行压缩。
- **完成标准**：根据任务场景选择 section；按 token 而不是字符预算；输出被删除内容的摘要和原因。

### P2-13 英文 Prompt 压缩后可能退回中文标签（已完成）

- **影响**：`compactPrompt` 重建 Prompt 时没有把 `language` 传给 `buildUsePrompt`，英文工作流在触发压缩后语言不一致。
- **证据**：`src/commands/use.js:94-119` 缺少 language 参数；调用处 `src/commands/use.js:194-196` 也未传入。
- **完成标准**：压缩函数接收完整构建上下文；增加英文超阈值测试。

### P2-14 Web 生成 Prompt 重复执行上下文构建（已完成）

- **影响**：先调用 `useCommand`，随后又调用 `buildContext`，重复场景解析和文件读取，且两个结果存在漂移风险。
- **证据**：`src/web/api/handlers/generate-prompt.js:12-28`。
- **完成标准**：一次调用返回最终 Prompt、场景和预算；Web 和 CLI 使用同一 application service。

### P2-15 集成测试绕过真实核心链路（已完成）

- **影响**：被命名为 Full Flow 的测试无法发现源码未进入 Prompt、模型响应不兼容或文档事实错误。
- **证据**：`tests/integration/full-flow.test.js:21-40` 使用 `skipAi: true`；`tests/commands/init-continuation.test.js:4-9` 完全 mock AI。
- **完成标准**：使用本地兼容 HTTP server 跑 `init -> docs -> update --apply -> use`；断言实际请求体含源码/diff和最终 Markdown 事实。

### P2-16 update 测试存在明显假阳性（已完成）

- **影响**：“生成增量 Prompt”用例仅检查属性存在，不要求非空、含 diff 或可执行，因此当前默认无输出缺陷仍能通过。
- **证据**：`tests/commands/update.test.js:81-98`；文件级 mock 见 `tests/commands/update.test.js:2-8`。
- **完成标准**：断言 Prompt 内容、状态提交时机、失败重试、删除文件、dry-run 纯度和 CLI 退出码。

### P2-17 没有真实模型或可选兼容性 smoke test（已完成）

- **影响**：本地 HTTP 测试能证明重试传输，却不能证明当前默认模型、请求字段和返回格式在真实提供商可用。
- **证据**：AI 测试全部使用 mock 或本地 server，例如 `tests/ai/client.test.js:324-448`。
- **完成标准**：增加默认关闭、由 secret 驱动的 nightly/provider smoke tests；保存脱敏契约快照，不把实时调用放入普通 PR 必跑路径。

## P3：工程质量与体验完善

### P3-01 安装流程不符合常见 npm CLI 预期（已完成）

- **影响**：首次使用需要 clone、根目录安装、Web 安装与构建、`npm link`，五分钟上手困难。
- **证据**：`README.md:55-63`。
- **完成标准**：README 首选 `npm install -g code-ctx` 或 `npx code-ctx`；源码开发流程移到贡献章节；发布前增加 `npm pack` smoke test。

### P3-02 快速开始在配置 API Key 之前要求运行 init（已完成）

- **影响**：用户按顺序操作会得到空文档和误导性成功消息。
- **证据**：初始化步骤在 `README.md:65-71`，Key 配置到 `README.md:120-135` 才出现。
- **完成标准**：提供 setup 向导；快速开始按安装、配置、连接测试、init、检查产物排序。

### P3-03 AI 阶段缺少进度、取消和请求摘要（已完成）

- **影响**：长时间等待时用户无法区分正常生成、限流重试和卡死。
- **证据**：`src/commands/init.js:332-346` one-shot 阶段只有普通日志；底层重试只打印等待秒数，见 `src/ai/client.js:239-247`。
- **完成标准**：显示阶段、项目、请求序号、累计耗时和 deadline；非 TTY 输出结构化日志；支持 Ctrl+C。

### P3-04 自定义 help 漏掉 dashboard（已完成）

- **影响**：命令已经注册，但手写帮助清单不完整，帮助信息存在两个事实来源。
- **证据**：注册见 `bin/cli.js:13-21`；手写命令列表见 `bin/cli.js:33-42`。
- **完成标准**：删除手写重复清单或从 Commander 元数据自动生成；增加 help 快照测试。

### P3-05 `npm run check` 不包含 lint（已完成）

- **影响**：贡献指南和 PR 模板要求运行 check，但它无法发现 lint 问题。
- **证据**：`package.json:24-29`；PR 模板只要求 `npm run check`，见 `.github/PULL_REQUEST_TEMPLATE.md:14-17`。
- **完成标准**：`check` 至少包含 lint、test、coverage threshold、Web build 和 package smoke test。

### P3-06 lint 脚本没有检查 Web 源码（已完成）

- **影响**：ESLint 配置虽包含 Web override，脚本只扫描 `src/ bin/`，前端代码不会进入 lint。
- **证据**：`package.json:27` 与 `.eslintrc.json:35-40`。
- **完成标准**：根 lint 覆盖 `web/src`，或在 Web package 定义独立 lint 并由根 check/CI 调用。

### P3-07 没有格式化、类型检查和覆盖率门槛（已完成）

- **影响**：大量 CommonJS/JSDoc 代码只能靠运行时测试，风格和接口漂移缺少自动门禁；覆盖率下降不会阻断 CI。
- **证据**：`package.json:24-32` 没有 format/typecheck；`package.json:72-78` 只有 coverage ignore，没有 threshold。
- **完成标准**：增加 Prettier 检查、TypeScript `checkJs` 或迁移计划、分层覆盖率阈值。

### P3-08 CI 平台和 Node 矩阵与声明不一致（已完成）

- **影响**：只在 Ubuntu 测试一个高度依赖路径和剪贴板行为的跨平台 CLI；同时测试不受支持的 Node 18。
- **证据**：`package.json:55-56` 要求 Node 20；`.github/workflows/ci.yml:14-21` 矩阵含 18；注释还声称 engines 为 `>=16`。
- **完成标准**：主矩阵改为 Node 20/22；增加 Windows smoke job；修正文档注释。

### P3-09 高危依赖审计不阻断 CI（已完成）

- **影响**：即使根 CLI 或 Dashboard 出现 high severity 漏洞，主分支仍可保持绿色。
- **证据**：`.github/workflows/ci.yml:52-56` 设置 `continue-on-error: true`。
- **完成标准**：生产依赖 high/critical 阻断；允许的例外必须有带到期日的审计清单。

### P3-10 第二次“深度扫描”实际是无效调用（已完成）

- **影响**：代码和注释误导维护者，以为存在第二阶段 monorepo 扫描；根目录已在 visited 中，第二次调用立即返回。
- **证据**：visited 判断见 `src/scanner/project-detector.js:82-84`；第二次调用见 `src/scanner/project-detector.js:119-122`。
- **完成标准**：删除无效第二遍，或实现清晰的 breadth-first 深度策略并测试扫描边界。

## 建议实施顺序

1. 先完成 P0-01、P0-02：建立真实源码快照、出站脱敏和 diff 输入。
2. 再完成 P0-03、P0-04、P1-03 至 P1-06：重写 update 为事务流程。
3. 完成 P0-05、P0-06、P1-09 至 P1-11：修复首次 init、根项目和离线降级。
4. 完成 P0-07、P1-07、P1-08、P1-13：建立结构化生成、截断检测和事实校验。
5. 用 P2-15 至 P2-17 的集成测试锁定上述行为，再处理模块拆分与插件契约。
6. 最后统一安装、help、进度、check 和 CI 矩阵。

## 发布门槛建议

- `init` 对单项目、monorepo、未知项目都有明确且可验证的产物。
- 任意生成文档中的函数、路由、依赖和数据模型都能追溯到相对源码路径。
- `update --dry-run` 零副作用；`update --apply` 失败不会推进状态；删除文件可被检测。
- 无 API Key、401、429、超时、Token 截断和磁盘失败均有非零退出码或明确的部分失败状态。
- CI 至少覆盖 Ubuntu + Windows、Node 20/22、lint、test、coverage threshold、Web build 和 npm package smoke test。
- 本地兼容 server 的端到端测试必须覆盖 `init -> update -> use`，并验证请求体确实包含源码证据。
