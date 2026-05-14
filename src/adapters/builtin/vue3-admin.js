const path = require('path');
const { BaseAdapter } = require('../base');

class Vue3AdminAdapter extends BaseAdapter {
  get type() { return 'vue3-admin'; }

  detect(pkg) {
    return !!(pkg.dependencies?.vue && pkg.dependencies?.['element-plus']);
  }

  get scanPatterns() {
    return ['src/api/*.js', 'src/router/*.js', 'src/stores/*.js', '.env.*'];
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
