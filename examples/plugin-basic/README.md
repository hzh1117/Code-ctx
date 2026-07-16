# plugin-basic

Code-ctx 最小插件示例。展示一个插件如何贡献：

- 一个项目适配器（`my-stack`）
- 一个自定义场景（`I` — Internal-Tools）
- 一个内部敏感数据正则（脱敏与扫描）

## 启用

在被管理项目的 `code-ctx.config.json` 中：

```json
{
  "plugins": ["./examples/plugin-basic/index.js"]
}
```

或安装为 npm 包后填 `"my-plugin"`。

插件是普通 Node.js 模块，加载时会执行代码。只启用已经审查并信任的插件；配置文件中的 `plugins` 字段不是数据隔离边界。

首次在交互式终端加载插件时，Code-ctx 会要求确认，并将同意的配置项写入 `~/.code-ctx/allowed-plugins.json`。CI 或其他非交互环境不会弹出确认，必须显式提供精确匹配的临时信任项：

```bash
CODE_CTX_PLUGINS_ALLOW=./examples/plugin-basic/index.js code-ctx doctor
```

PowerShell：

```powershell
$env:CODE_CTX_PLUGINS_ALLOW = './examples/plugin-basic/index.js'
code-ctx doctor
```

`CODE_CTX_PLUGINS_ALLOW_ALL=1` 会放行配置中的所有插件，仅适合配置已由调用方审查的隔离测试环境，不建议用于日常或生产运行。

## 接口约定

```js
module.exports = {
  name: 'my-plugin',           // 必填：唯一名称（用于日志）
  adapters: [AdapterClass],    // 可选：每项是继承 BaseAdapter 的类或实例
  scenarios: [                 // 可选：数组中每项至少包含 id 字段
    { id: 'I', name: '...', description: '...', keywords: [...], template: '...' }
  ],
  sensitivePatterns: [         // 可选：用于 filterSensitive 的脱敏
    { pattern: /myorg-secret-[A-Z]+/g, replacement: '[FILTERED:myorg]' }
  ],
  sensitiveDetectionPatterns: [// 可选：用于 scanDirectory 的检测
    { regex: /myorg-secret/, name: 'myorg_secret' }
  ]
};
```

- 插件可以导出对象，或导出工厂函数（返回相同形状的对象）。
- 加载失败不会破坏内置能力，只会输出 warning。
- 插件场景的 `id` 与内置冲突时，**插件覆盖**内置，便于二次定制。
- `CODE_CTX_PLUGINS_ALLOW` 比较的是配置中填写的原始字符串；本地路径、npm 包名和作用域包名必须与 `plugins` 数组中的值完全一致。
