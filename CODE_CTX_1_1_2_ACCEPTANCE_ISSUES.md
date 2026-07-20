# Code-ctx v1.1.2 实机验收问题清单

> 审查日期：2026-07-20  
> 审查版本：`code-ctx@1.1.2`，提交 `a6ffafe`  
> 验收环境：Windows PowerShell、Node.js 20+、官方 npm registry、DeepSeek 官方 OpenAI 兼容接口、`deepseek-v4-flash`  
> 被扫描项目：Code-ctx 自身仓库  
> 审查范围：项目探测、源码证据、AI 文档生成、事实校验、Prompt 组装、敏感扫描、Provider 配置和发布回归测试。  
> 不包含商业化、定价或市场分析。

## 结论

`v1.1.2` 的 npm 安装、CLI、生产 Dashboard、DeepSeek 连接和 AI 请求链路均可运行，但生成文档的事实正确性验收不通过。一次真实 `init --force` 完成 6 次 AI 请求并生成 5 个项目文档和 `OVERVIEW.md`，随后 `doctor` 给出 `HIGH_RISK`、综合分 70；其中 `OVERVIEW.md` 得分 22、事实可信度 0，并出现 Node.js `>=18` 与仓库实际 `>=20` 冲突。

真实 API Key 经精确值扫描确认未进入任何 Markdown 文档。当前安全告警是字段名/示例值误报，不是已确认的密钥泄漏；但误报会把整体质量强制降为 `HIGH_RISK`。

当前版本不应把“`init` 成功”解释为“文档可信”。在 P0 问题完成前，不建议将 AI 生成文档作为无人审核的事实来源。

## 优先级定义

| 优先级 | 定义                                           | 数量 | 处理要求               |
| ------ | ---------------------------------------------- | ---: | ---------------------- |
| P0     | 阻断核心文档正确性，或让成功状态与实际质量相反 |    5 | 下一补丁版本发布前完成 |
| P1     | 严重削弱主要 Prompt/安全诊断流程               |    2 | P0 后立即完成          |
| P2     | Provider 兼容性或明显交互/诊断缺陷             |    4 | 纳入近期补丁或小版本   |
| P3     | 防止同类回归的工程门禁完善                     |    1 | 与上述修复同步落地     |

## 总览

| 编号  | 问题                                          | 直接后果                               | 状态 |
| ----- | --------------------------------------------- | -------------------------------------- | ---- |
| P0-01 | 项目探测产生重叠边界并纳入测试夹具            | 文档对象、成本和依赖关系全部失真       | Open |
| P0-02 | Overview Prompt 与 manifest 校验契约不一致    | `OVERVIEW.md` 很容易固定为事实可信度 0 | Open |
| P0-03 | `init` 不执行事实质量门禁却报告成功           | `HIGH_RISK` 文档仍显示“初始化完成”     | Open |
| P0-04 | 关键 manifest 文件按前 4000 字符截断          | `engines.node` 等关键事实未进入 Prompt | Open |
| P0-05 | 事实校验不覆盖运行时版本等核心声明            | Node `>=18` 错误未被针对性识别         | Open |
| P1-01 | 场景绑定旧业务 alias，Bug 场景只加载 Overview | 具体任务 Prompt 缺少相关项目文档       | Open |
| P1-02 | 敏感扫描把字段名和示例值判为真实凭据          | 无泄漏文档被判 `HIGH_RISK`             | Open |
| P2-01 | 占位符正则把所有中文方头括号识别为占位符      | 章节标题进入填写流程                   | Open |
| P2-02 | DeepSeek Provider 预设未跟进当前官方模型      | 一键配置得到过时模型和过小输出预算     | Open |
| P2-03 | Dashboard 将 `maxTokens` 硬限制为 200000      | 无法表达官方最大 384K 输出能力         | Open |
| P2-04 | Doctor 对事实和敏感告警打印空修复建议         | 用户看到风险但没有可执行动作           | Open |
| P3-01 | 发布门禁没有覆盖真实 AI 输出质量契约          | 结构测试全绿仍可发布不可用文档链路     | Open |

## P0：核心正确性阻断

### P0-01 项目探测产生重叠边界并纳入测试夹具

- **实机证据**：Code-ctx 自身被探测为 `code-ctx`、`src-web`、`tests-fixtures-multi`、`tests-fixtures-mul-2`、`web` 共 5 个项目。`tests/fixtures/multi-project-test/*` 明确是测试夹具；`src/web` 是根 CLI 的内部模块，不是独立部署项目。
- **影响**：根项目扫描已经包含 `src/web`，子项目扫描又重复发送相同源码；测试夹具也触发单独 AI 请求。最终 Overview 把测试夹具写入正式架构和依赖矩阵，增加调用成本并污染事实边界。
- **代码证据**：
  - `src/scanner/project-detector.js:6-31` 的默认跳过目录不包含 `tests` 或 `fixtures`。
  - `src/scanner/project-detector.js:100-146` 检测根项目后仍递归任意未忽略目录，并把任何可被 adapter 识别的目录追加为项目。
  - `src/utils/ignore-engine.js:36-53` 只合并通用默认项、已有配置和 `.gitignore`；首次初始化没有项目边界语义。
  - `tests/scanner/project-detector.test.js:236-285` 只证明可发现深层项目；`tests/scanner/project-detector.test.js:313-336` 固化“根项目 + 子项目”共存，却没有覆盖重叠源码根或测试夹具负例。
- **根因**：探测器把“目录看起来像一个项目”等同于“目录应成为独立项目”，没有 workspace 声明、包清单、部署边界、用户配置或祖先项目包含关系的判定。
- **完成标准**：
  - 默认忽略标准测试夹具路径，如 `test/fixtures`、`tests/fixtures`、`__fixtures__`。
  - 根项目存在时，只自动纳入由 workspace/明确包清单/标准 `apps`、`packages` 结构证明的子项目。
  - 输出项目源码根必须不重叠；确需嵌套时要有明确 ownership 规则，父项目扫描排除子项目根。
  - 在 Code-ctx 仓库上默认结果应为根 CLI 与 `web`，不应包含 `src/web` 和测试夹具。
- **必需测试**：加入真实仓库形状 fixture，断言测试夹具不被发现、内部 server 目录不被拆分、父子扫描文件集合不重叠。

### P0-02 Overview Prompt 与 manifest 校验契约不一致

- **实机证据**：`doctor` 报告 `OVERVIEW.md 仅引用 0/5 个 manifest 项目`，事实可信度 0。
- **影响**：即使模型准确复述项目名称和职责，Overview 仍可能无法通过自身事实校验；质量分和生成契约互相矛盾。
- **代码证据**：
  - `src/generator/prompt-builder.js:181-204` 只向 Overview Prompt 提供 `alias / label / type` 和文档摘要，没有提供每个项目的 `sourcePath` 与 `document`。
  - `templates/scan-prompt-overview.md:3-21` 要求生成项目列表和职责，但没有要求输出 manifest 的 `id / sourcePath / document` 三元组。
  - `src/utils/fact-verifier.js:76-104` 只有当正文同时包含 `project.id`、`project.sourcePath`、`project.document` 时才把一个项目计为已验证。
- **根因**：生成端和验证端没有共享结构化 schema；验证器要求模型输出 Prompt 中未提供的字段。
- **完成标准**：
  - Overview Prompt 显式传入并要求保留每个项目的 `id / sourcePath / document`。
  - 优先把机器可验证映射作为确定性 section 生成，不让模型自由改写。
  - 生成后立即执行 `verifyOverviewFacts`，覆盖率不足时不得提交完成状态。
- **必需测试**：使用真实 manifest 构造 Overview Prompt，断言所需三元组全部出现；生成 fixture 必须达到 100% manifest mapping。

### P0-03 `init` 不执行事实质量门禁却报告成功

- **实机证据**：`init --force` 输出“成功生成 5 个子项目文档 + OVERVIEW.md”和“✓ 初始化完成”，紧接着 `doctor` 返回 `HIGH_RISK`、事实可信度 74，Overview 事实可信度 0。
- **影响**：自动化、Dashboard 和用户会把网络请求成功、section 齐全误认为内容可信；错误文档被写盘并推进 `.last-scan.json`。
- **代码证据**：
  - `src/init/validation-service.js:25-36` 的 `inspect` 只运行敏感扫描，不调用 `scoreDocs`、`verifyOverviewFacts` 或 `verifyProjectFacts`。
  - `src/commands/init.js:56-72` 在敏感检查后直接调用 commit，并把 `generation.success` 返回给 CLI。
  - `src/init/commit-service.js:23-56` 只依据生成请求是否成功决定写入扫描基线和打印“初始化完成”。
  - `src/utils/doc-quality.js:183-215` 的事实校验只在后续质量评分路径中运行。
- **根因**：生成成功、格式成功、事实成功被建模为同一个布尔值；质量体系是事后报告器，不是提交事务的一部分。
- **完成标准**：
  - 将生成、结构校验、事实校验、敏感校验拆成明确状态。
  - `HIGH_RISK`、Overview manifest mapping 不完整、关键事实冲突时不得打印无条件成功或提交扫描基线。
  - 返回结构化 `quality` 和非零退出码；允许明确的 `--accept-warnings`，但不得默认放行事实无效。
- **必需测试**：注入 section 完整但事实可信度 0 的 AI 输出，断言 init 失败、状态不提交、CLI 不打印成功。

### P0-04 关键 manifest 文件按前 4000 字符截断

- **实机证据**：本地复现 `scanProjectAsync` 后，`package.json` 被纳入 `sourceFiles` 但标记为截断，源码片段和最终 Prompt 均不包含真实的 `engines.node: >=20.0.0`。AI 文档随后写成 Node.js `>=18`。
- **影响**：依赖、scripts、engines、workspace 等结构化关键事实可能仅因字段位于文件后半段而消失；模型只能猜测，manifest/hash 存在也不能恢复被删内容。
- **代码证据**：
  - `src/utils/constants.js:8-14` 把单文件源码片段限制为 4000 字符。
  - `src/scanner/file-scanner.js:120-155` 和异步路径 `src/scanner/file-scanner.js:429-437` 都只保留文件开头 `slice(0, includedChars)`。
  - `src/scanner/file-scanner.js:44-50` 虽把 `package.json` 等列为项目 manifest，却没有结构化解析或专属预算。
  - `tests/scanner/file-scanner.test.js:299-312` 只覆盖短 manifest，不覆盖关键字段位于截断边界之后。
- **根因**：结构化 manifest 与普通源码使用同一种“截取文件头”策略。
- **完成标准**：
  - 使用 JSON/XML/Gradle 等结构化解析提取包名、版本、engines、scripts、workspace 和依赖摘要。
  - manifest 证据独立于源码字符预算，并标明字段来源。
  - 无法解析时采用头尾采样或明确报未验证，不能默默缺字段。
- **必需测试**：构造大于 4000 字符且 `engines` 位于尾部的 `package.json`，断言 Prompt 仍包含准确 Node 要求。

### P0-05 事实校验不覆盖运行时版本等核心声明

- **实机证据**：生成文档把 Node.js `>=20` 写成 `>=18`；doctor 只给出总体事实低分，没有报告明确的运行时版本冲突。
- **影响**：用户可能按错误版本安装环境；类似数据库版本、框架版本、构建命令和 package scripts 的错误也可能漏过。
- **代码证据**：
  - `src/utils/fact-verifier.js:107-199` 只检查 manifest 映射、文件/hash、显式符号引用、路由和依赖名称覆盖率。
  - `src/utils/fact-verifier.js:45-53` 读取依赖名但不校验版本，也不读取 `engines` 或 scripts。
  - `src/utils/doc-quality.js:102-117` 只能消费现有 verifier 结果，无法识别未建模的事实类别。
- **根因**：事实模型仍以引用覆盖率为主，没有为高价值结构化声明建立 claim/evidence 对照。
- **完成标准**：
  - 从 manifest 提取 Node/Java/Python/Go 版本、框架版本、scripts 和 workspace 等确定性事实。
  - 文档中的版本与命令声明必须可追溯到结构化证据；冲突应给出字段级错误。
  - 高价值事实冲突直接标记 `invalid`，而不是被其他 100 分指标平均稀释。
- **必需测试**：文档声明 Node `>=18`、manifest 声明 `>=20` 时，断言返回明确 `runtime-version-mismatch`。

## P1：主要流程严重缺陷

### P1-01 场景绑定旧业务 alias，Bug 场景只加载 Overview

- **实机证据**：任务“排查 Dashboard 从 npm 安装后无法启动的问题”被正确识别为场景 F，但输出显示只加载 `OVERVIEW.md`；没有加载最相关的 `code-ctx.md`、`src-web.md` 或 `web.md`。
- **影响**：Prompt 虽声称提供项目上下文，实际缺少实现文件、模块职责和启动链路，后续编码模型仍需猜测。
- **代码证据**：
  - `templates/scenarios.json:38-64` 中 E/F 的 `relatedProjects` 为空，其他场景硬编码 `mp / mer / plat / api` 等特定业务 alias。
  - `src/commands/use.js:54-89` 只加载 `OVERVIEW.md`、场景静态 alias 对应文档和可选 `api-contracts.md`；没有基于任务文本、manifest 或源码路径选择文档。
  - `src/commands/use.js:12` 将压缩阈值固定为 2000 tokens；`src/commands/use.js:146-174` 再按场景 section 删除上下文。
  - `tests/commands/use.test.js:51-58` 只验证硬编码商户 alias；`tests/commands/use.test.js:62-71` 没有断言 Bug 场景加载任何项目文档。
- **根因**：场景模板仍耦合旧电商项目拓扑，与“任意代码库上下文工具”的定位不一致。
- **完成标准**：
  - 场景只描述任务类型，不硬编码项目 alias。
  - 通过 manifest、任务关键词、文件/模块索引选择相关项目，并允许用户显式 `--project` 覆盖。
  - Bug 场景至少加载一个证据相关项目；无法确定时清晰列出候选，而不是静默只给 Overview。
- **必需测试**：针对 Dashboard/npm 启动任务，断言加载 CLI、Web server 或前端文档，而不是仅 Overview。

### P1-02 敏感扫描把字段名和示例值判为真实凭据

- **实机证据**：`code-ctx.md` 和 `OVERVIEW.md` 因 `api_key` 被判风险，但使用 `.env` 中真实 Key 做精确扫描时无任何命中。最小复现 `OPENAI_API_KEY=your-api-key` 也会触发 `api_key`。
- **影响**：无泄漏文档被强制标记 `HIGH_RISK`，风险轴从 100 降到 40，用户无法区分真实泄漏与配置字段说明；长期会导致告警疲劳。
- **代码证据**：
  - `src/utils/sensitive-filter.js:23-35` 的检测正则只要求字段名、等号和任意非空值，不判断占位符、熵、长度或 `[FILTERED]`。
  - `src/utils/sensitive-filter.js:78-101` 只返回文件和字段类型，不返回安全定位、置信度或“示例/真实值”分类。
  - `src/utils/doc-quality.js:81-117` 把任何命中视为 hard risk；`src/utils/doc-quality.js:227-251` 再把整体风险扣 60 并强制 `HIGH_RISK`。
- **根因**：用于出站替换的保守模式被直接复用于发布后泄漏判定；两个场景需要不同的误报容忍度和证据输出。
- **完成标准**：
  - 保持出站过滤保守，但将文档泄漏检测拆成独立规则。
  - 识别 `your-key`、`example`、空值、环境变量名、`[FILTERED]` 等占位内容；对真实 token 使用长度、格式和熵信号。
  - 报告行号、脱敏片段、置信度和命中规则，绝不回显实际 secret。
- **必需测试**：占位符和字段说明不应触发 hard risk；长高熵 Key、JWT、Bearer 和连接串必须继续触发。

## P2：兼容性与体验缺陷

### P2-01 占位符正则把所有中文方头括号识别为占位符

- **实机证据**：CLI 报告 4 个占位符，其中包含 `【第一部分：项目上下文】` 和 `【第二部分：任务模板】` 两个章节标题，真正待填写字段只有 3 个。
- **代码证据**：`bin/commands/use.js:8-24` 使用 `/【[^】]+】/g` 匹配所有方头括号内容，并把填写结果继续包回方头括号。
- **影响**：交互填写流程要求用户填写不可编辑的结构标题；替换后仍保留括号，无法区分已填写与未填写。
- **完成标准**：只识别 `【待填写...】` 或显式机器占位符；填写后替换为裸值；中英文模板使用统一 placeholder schema。
- **必需测试**：章节标题不进入列表，三个 `待填写` 字段进入列表且替换后不再被识别。

### P2-02 DeepSeek Provider 预设未跟进当前官方模型

- **实机证据**：官方验收配置使用 `deepseek-v4-flash`、OpenAI Base URL `https://api.deepseek.com`，输出上限 384K；内置一键预设仍为旧模型和 4096 输出上限。
- **代码证据**：`src/ai/presets.js:28-34` 固定 `deepseek-chat` 与 `maxTokens: 4096`；`tests/ai/presets.test.js:3-35` 只验证字段形状和 URL 包含 `deepseek`，不校验官方当前值。
- **影响**：用户点击官方 Provider 模板后得到过时配置，需要手工覆盖，Provider preset 的主要价值失效。
- **完成标准**：发布前重新核对 DeepSeek 官方模型 ID、协议、默认思考模式和输出限制；预设版本化或标注校验日期；测试固定经确认的官方值。

### P2-03 Dashboard 将 `maxTokens` 硬限制为 200000

- **实机证据**：DeepSeek V4 Flash 官方最大输出为 384K，但 Dashboard 不能保存超过 200000 的整数。
- **代码证据**：`src/web/api/ai.js:29-33` 硬编码上限 200000；`tests/web/ai-config.test.js:95-109` 只覆盖负数，没有覆盖高能力模型的合法上限。
- **影响**：模型能力提升后必须修改应用代码才能配置；CLI/JSON 与 Dashboard 可能形成不一致体验。
- **完成标准**：上限来自 Provider 能力或采用足够安全的通用整数边界；同时校验输入+输出不超过上下文；UI 显示“输出上限”而非上下文长度。

### P2-04 Doctor 对事实和敏感告警打印空修复建议

- **实机证据**：doctor 输出“💡 修复建议：”后没有任何内容，尽管上方有敏感误报和 manifest 覆盖失败。
- **代码证据**：`src/commands/doctor.js:356-379` 无条件打印标题，但只为缺失、过期和未配置三类问题生成建议；事实校验和 sensitive 风险没有分支。
- **影响**：用户知道文档不可用，却不知道应检查哪一行、重新生成还是修改配置；容易误用 `doctor --fix` 并重复产生 AI 费用。
- **完成标准**：仅在存在建议时打印标题；为敏感命中、manifest mismatch、低引用覆盖率和事实冲突提供不泄密的具体动作；明确哪些问题不能由 `--fix` 自动解决。

## P3：工程门禁

### P3-01 发布门禁没有覆盖真实 AI 输出质量契约

- **现状**：`npm run check` 覆盖 67 个测试套件、Web 构建和 tarball Dashboard smoke，但 `v1.1.2` 仍能在真实 AI 流程中生成事实可信度 0 的 Overview 并报告成功。
- **代码证据**：
  - `tests/commands/init-pipeline.test.js:4-69` 使用注入的成功 generation/validation 结果，只验证服务调用顺序。
  - `tests/utils/doc-quality.test.js:66-153` 使用人工构造的理想文档验证评分器，没有把真实生成模板与 verifier 契约连在一起。
  - `scripts/package-smoke.js` 验证安装、离线初始化、配置和 Dashboard 启动，不验证 AI 输出质量；真实 Provider smoke 必须保持显式 opt-in，但契约回归不应依赖外网。
- **完成标准**：
  - 增加录制/固定的 AI 输出 fixture，覆盖错误 Node 版本、缺 manifest 映射、敏感字段说明和不相关子项目。
  - 在无网络测试中贯通 `Prompt -> fixture response -> write -> fact verification -> commit decision`。
  - CI 必须断言事实无效时 init 非成功，事实有效时才提交状态。

## 建议实施顺序

1. 先修 P0-02 和 P0-04，建立生成端可见、验证端可消费的确定性事实契约。
2. 修 P0-05，扩展结构化事实模型；随后修 P0-03，把事实校验纳入 init 提交事务。
3. 修 P0-01，重新生成干净的项目边界和 manifest，避免继续用污染输入验证后续步骤。
4. 修 P1-01，使 `use` 真正加载任务相关文档；修 P1-02，恢复安全评分信噪比。
5. 完成 P2 交互和 Provider 兼容项。
6. 用 P3-01 的端到端契约测试封住全部回归，再准备下一个 npm 补丁版本。

## 发布完成标准

- Code-ctx 自扫描默认不包含 `tests/fixtures` 或 `src/web` 独立项目，父子源码集合不重叠。
- 出站 Prompt 明确包含 `engines.node >=20.0.0`，生成文档不得写成 `>=18`。
- Overview manifest mapping 为 100%，所有项目映射由确定性 section 提供。
- 事实无效的 AI 输出不会得到成功退出码，也不会提交 `.last-scan.json`。
- Bug 场景至少加载一个任务相关项目文档。
- API Key 字段说明不触发 hard risk，真实高熵 secret 仍会被发现且不回显。
- 占位符列表只包含真实待填写字段。
- Provider 配置与经确认的 DeepSeek 官方能力一致。
- 全量测试、覆盖率、Web build、tarball Dashboard smoke 和新增 AI 质量契约测试全部通过。
