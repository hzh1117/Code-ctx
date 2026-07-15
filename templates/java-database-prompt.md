请为以下 Java 后端项目生成数据库结构设计文档。

项目名称：{{projectName}}
项目类型：{{projectType}}
项目路径：{{projectPath}}

目录结构：
{{tree}}

Entity/Model 文件：
{{entityFiles}}

Repository/Mapper 文件：
{{repositoryFiles}}

配置文件（application.yml/properties）：
{{configFiles}}

源码证据（内容可能因预算截断；只能依据证据陈述事实）：
{{sourceEvidence}}

请生成完整的数据库结构设计文档，包含以下内容：

1. **数据库概览**
   - 数据库类型（MySQL/PostgreSQL/Oracle 等）
   - 数据库名称
   - 字符集和排序规则
   - 连接配置说明

2. **表结构清单**
   对每张表，请列出：
   - 表名
   - 表注释/说明
   - 字段列表（字段名、类型、长度、是否可空、默认值、注释）
   - 主键
   - 索引
   - 外键关系

3. **ER 关系图（文字描述）**
   - 实体之间的关系（一对一、一对多、多对多）
   - 关系说明

4. **数据字典**
   - 枚举值说明
   - 状态字段取值范围
   - 特殊字段含义解释

5. **SQL 建表语句**
   - 完整的 CREATE TABLE 语句
   - 索引创建语句

6. **数据迁移注意事项**
   - 字段变更历史
   - 数据迁移脚本建议

输出格式要求：
- 使用 Markdown 格式
- 表结构使用表格展示
- SQL 语句使用代码块
- 确保内容准确、完整

<!-- section:db-overview -->
数据库概览内容...
<!-- /section:db-overview -->

<!-- section:table-list -->
表结构清单...
<!-- /section:table-list -->

<!-- section:er-diagram -->
ER 关系图...
<!-- /section:er-diagram -->

<!-- section:data-dictionary -->
数据字典...
<!-- /section:data-dictionary -->

<!-- section:sql-ddl -->
SQL 建表语句...
<!-- /section:sql-ddl -->

<!-- section:migration-notes -->
数据迁移注意事项...
<!-- /section:migration-notes -->
