请为以下子项目生成结构文档。

项目名称：{{projectName}}
项目类型：{{projectType}}
项目路径：{{projectPath}}

目录结构：
{{tree}}

关键文件：
{{keyFiles}}

{{otherDocsSection}}

请生成以下内容，每个部分必须用 section 标记包裹：
1. 项目概述
2. 目录结构说明
3. 核心模块说明
4. 开发注意事项

输出格式要求：
- 每个部分用 HTML 注释标记包裹，格式：<!-- section:部分名称 --> ... <!-- /section:部分名称 -->
- 示例：
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

请用 Markdown 格式输出。
