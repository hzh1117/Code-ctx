请为以下项目生成一个总览文档（OVERVIEW.md）。

项目名称：{{projectName}}
子项目列表：
{{projectList}}

已生成的子项目文档摘要：
{{projectSummaries}}

请生成以下内容，每个部分必须用 section 标记包裹：
1. 项目概述（一句话描述）
2. 子项目列表及其职责
3. 技术栈说明
4. 项目关系图（哪个前端调用哪个后端）

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

请用 Markdown 格式输出。
