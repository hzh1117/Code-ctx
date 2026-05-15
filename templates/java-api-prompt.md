请为以下 Java 后端项目生成 API 接口文档。

项目名称：{{projectName}}
项目类型：{{projectType}}
项目路径：{{projectPath}}

目录结构：
{{tree}}

Controller 文件：
{{controllerFiles}}

Service 文件：
{{serviceFiles}}

请生成完整的 API 接口文档，包含以下内容：

1. **API 概览**
   - API 基础路径（Base URL）
   - 认证方式说明
   - 通用响应格式

2. **接口列表**
   对每个接口，请列出：
   - 接口名称
   - HTTP 方法（GET/POST/PUT/DELETE）
   - 完整路径
   - 请求参数（Query/Path/Body）
   - 请求示例
   - 响应数据结构
   - 响应示例
   - 业务说明

3. **错误码说明**
   - 业务错误码列表
   - HTTP 状态码说明

4. **接口调用示例**
   - 常用接口的 cURL 示例
   - 请求/响应完整示例

输出格式要求：
- 使用 Markdown 格式
- 接口按模块或功能分组
- 每个接口使用表格或代码块清晰展示
- 确保示例代码可直接使用

<!-- section:api-overview -->
API 概览内容...
<!-- /section:api-overview -->

<!-- section:api-list -->
接口列表...
<!-- /section:api-list -->

<!-- section:error-codes -->
错误码说明...
<!-- /section:error-codes -->

<!-- section:api-examples -->
接口调用示例...
<!-- /section:api-examples -->
