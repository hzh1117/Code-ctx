请为以下项目生成一个总览文档（OVERVIEW.md）。

项目名称：{{projectName}}
子项目列表：
{{projectList}}

已生成的子项目文档摘要：
{{projectSummaries}}

请生成以下内容，每个部分必须用 section 标记包裹：
1. **项目概述** — 一句话描述项目定位和核心价值
2. **子项目列表及其职责** — 每个子项目的名称、类型、核心职责
3. **技术栈说明** — 前端框架、后端语言、数据库、构建工具等
4. **项目关系图** — 哪个前端调用哪个后端，数据流向，服务间依赖
5. **跨项目依赖矩阵** — 子项目之间的依赖关系表格
6. **开发快速上手** — 如何启动各子项目、常用命令

输出格式要求：
- 每个部分用 HTML 注释标记包裹，格式：<!-- section:部分名称 --> ... <!-- /section:部分名称 -->
- 示例：
<!-- section:overview -->
项目概述内容...
<!-- /section:overview -->

<!-- section:subprojects -->
子项目列表及职责...
<!-- /section:subprojects -->

<!-- section:tech-stack -->
技术栈说明...
<!-- /section:tech-stack -->

<!-- section:architecture -->
项目关系图...
<!-- /section:architecture -->

<!-- section:dependencies -->
跨项目依赖矩阵...
<!-- /section:dependencies -->

<!-- section:quickstart -->
开发快速上手...
<!-- /section:quickstart -->

请用 Markdown 格式输出。确保内容完整，方便新开发者快速理解项目全貌。
