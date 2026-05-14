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

1. **项目概述** — 项目定位、核心功能、技术栈
2. **目录结构说明** — 关键目录和文件的作用
3. **核心模块说明** — 主要模块的职责、入口文件、关键函数
4. **API/接口清单** — 列出对外暴露的 API 接口（路由、方法、参数、返回值），如无接口则说明数据流向
5. **数据模型/存储** — 数据结构、数据库表、文件存储格式，如无则说明状态管理方式
6. **依赖关系** — 本项目依赖哪些其他子项目或外部库，以及被谁依赖
7. **开发注意事项** — 常见踩坑点、配置要求、环境依赖

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

<!-- section:api -->
API/接口清单...
<!-- /section:api -->

<!-- section:data -->
数据模型/存储...
<!-- /section:data -->

<!-- section:dependencies -->
依赖关系...
<!-- /section:dependencies -->

<!-- section:notes -->
开发注意事项...
<!-- /section:notes -->

请用 Markdown 格式输出。确保内容完整、准确，方便开发者快速上手。
