const path = require('path');
const { BaseAdapter } = require('../base');

class Vue3AdminAdapter extends BaseAdapter {
  get type() { return 'vue3-admin'; }

  detect(pkg) {
    const version = pkg.dependencies?.vue || pkg.devDependencies?.vue;
    return !!version && !/^\s*[~^]?2(?:\.|$)/.test(version);
  }

  get scanPatterns() {
    return [
      'src/**/*.{vue,js,jsx,ts,tsx}',
      '*.{js,ts,mjs,cjs}',
      '.env.*'
    ];
  }

  get priorityKeywords() {
    return {
      'main.js': 1,
      'router/index': 2,
      '/api/': 3,
      'views': 4,
      'components': 5,
      'stores': 6,
      'vite.config': 7,
      '.env': 8
    };
  }

  getPromptHints() {
    return 'Vue3 组合式 API 项目，使用 Pinia 状态管理，注意 setup 语法糖和 defineProps/defineEmits';
  }

  extractKeyFiles(dir) {
    return [
      path.join(dir, 'src', 'main.js'),
      path.join(dir, 'src', 'router', 'index.js'),
      path.join(dir, 'vite.config.js'),
      path.join(dir, '.env.development'),
      path.join(dir, '.env.production')
    ];
  }
}

module.exports = Vue3AdminAdapter;
