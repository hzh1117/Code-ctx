const path = require('path');
const { BaseAdapter } = require('../base');

class ReactAdapter extends BaseAdapter {
  get type() {
    return 'react';
  }

  detect(pkg) {
    return !!pkg.dependencies?.react;
  }

  get scanPatterns() {
    return [
      'src/components/**/*.{jsx,tsx}',
      'src/pages/**/*.{jsx,tsx}',
      'src/hooks/*.js',
      'src/App.{jsx,tsx}',
      'src/index.{jsx,tsx}'
    ];
  }

  get priorityKeywords() {
    return {
      '/app.': 1,
      '/index.': 2,
      pages: 3,
      components: 4,
      hooks: 5,
      store: 6,
      config: 7,
      util: 8
    };
  }

  getPromptHints() {
    return 'React 前端项目，注意组件 props 类型定义，关注自定义 Hooks 复用逻辑，状态管理方案（Redux/Zustand/Context）';
  }

  extractKeyFiles(dir) {
    return [
      path.join(dir, 'src', 'App.tsx'),
      path.join(dir, 'src', 'App.jsx'),
      path.join(dir, 'src', 'index.tsx'),
      path.join(dir, 'src', 'index.jsx'),
      path.join(dir, 'vite.config.js'),
      path.join(dir, 'craco.config.js')
    ];
  }
}

module.exports = ReactAdapter;
