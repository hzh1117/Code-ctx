请为以下所有子项目生成结构文档。每个子项目必须使用下述机器边界分隔，禁止用 Markdown 标题代替边界。

{{projectSections}}

对每个子项目请生成以下内容，每个部分必须用 section 标记包裹：

1. **项目概述** — 项目定位、核心功能、技术栈
2. **目录结构说明** — 关键目录和文件的作用
3. **核心模块说明** — 主要模块的职责、入口文件、关键函数
4. **API/接口清单** — 列出对外暴露的 API 接口（路由、方法、参数、返回值），如无接口则说明数据流向
5. **数据模型/存储** — 数据结构、数据库表、文件存储格式，如无则说明状态管理方式
6. **依赖关系** — 本项目依赖哪些其他子项目或外部库，以及被谁依赖
7. **开发注意事项** — 常见踩坑点、配置要求、环境依赖

输出格式要求：
- 每个部分用 HTML 注释标记包裹，标记名称必须使用下方示例中的固定 section ID
- 示例（以子项目 "my-app" 为例）：
<<<CODE_CTX_DOC my-app>>>

# my-app

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

<<<END_CODE_CTX_DOC my-app>>>

边界要求：
- 每个输入 alias 必须且只能出现一次
- 起始边界必须是 `<<<CODE_CTX_DOC alias>>>`
- 结束边界必须是 `<<<END_CODE_CTX_DOC alias>>>`，且 alias 与起始边界完全一致
- 不得输出输入列表之外的 alias
- 边界内部使用 Markdown，确保内容完整、准确
