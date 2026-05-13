const path = require('path');
const { BaseAdapter } = require('../base');

class Vue2AdminAdapter extends BaseAdapter {
  get type() { return 'vue2-admin'; }

  detect(pkg) {
    return !!(pkg.dependencies?.vue && pkg.dependencies?.['element-ui']);
  }

  get scanPatterns() {
    return ['src/api/*.js', 'src/router/modules/*.js', 'src/store/modules/*.js', '.env.*'];
  }

  getPromptHints() {
    return '注意区分 views/ 和 components/，api/ 文件命名对应后端 Controller 名称';
  }

  extractKeyFiles(dir) {
    return [
      path.join(dir, 'src', 'main.js'),
      path.join(dir, 'src', 'router', 'index.js'),
      path.join(dir, 'vue.config.js'),
      path.join(dir, '.env.development'),
      path.join(dir, '.env.production')
    ];
  }
}

module.exports = Vue2AdminAdapter;
