请为以下所有子项目生成结构文档，每个子项目用 ## 标题分隔。

{{projectSections}}

对每个子项目请生成以下内容，每个部分必须用 section 标记包裹：
1. 项目概述
2. 目录结构说明
3. 核心模块说明
4. 开发注意事项

输出格式要求：
- 每个部分用 HTML 注释标记包裹，格式：<!-- section:部分名称 --> ... <!-- /section:部分名称 -->
- 示例（以子项目 "my-app" 为例）：
## my-app

<!-- section:overview -->
项目概述内容...
<!-- /section:overview -->

<!-- section:structure -->
目录结构说明...
<!-- /section:structure -->

<!-- section:modules -->
核心模块说明...
<!-- /section:modules -->

<!-- section:notes -->
开发注意事项...
<!-- /section:notes -->

请用 Markdown 格式输出，每个子项目以 "## 子项目别名" 开头。
