const { BaseAdapter } = require('../../src/plugins/loader');

class MyStackAdapter extends BaseAdapter {
  get type() { return 'my-stack'; }

  detect(pkg) {
    return !!(pkg && pkg.dependencies && pkg.dependencies['my-stack-runtime']);
  }

  get scanPatterns() {
    return ['src/**/*.mystack', 'apps/**/*.mystack'];
  }

  getPromptHints() {
    return 'my-stack 自研栈：关注组件 schema 与运行时编排';
  }
}

module.exports = {
  name: 'plugin-basic',
  adapters: [MyStackAdapter],
  scenarios: [
    {
      id: 'I',
      key: 'I',
      name: 'Internal-Tools',
      description: '组织内部工具/平台需求',
      keywords: ['内部工具', 'internal-tools', '工具平台'],
      template: '请基于组织内部工具规范完成：{{taskDescription}}'
    }
  ],
  sensitivePatterns: [
    { pattern: /myorg-secret-[A-Z0-9]{6,}/g, replacement: '[FILTERED:myorg-secret]' }
  ],
  sensitiveDetectionPatterns: [
    { regex: /myorg-secret-/i, name: 'myorg_secret' }
  ]
};
