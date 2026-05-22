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
