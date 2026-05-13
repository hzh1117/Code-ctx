const { BaseAdapter } = require('../base');

class Vue3AdminAdapter extends BaseAdapter {
  get type() { return 'vue3-admin'; }

  detect(pkg) {
    return !!(pkg.dependencies?.vue && pkg.dependencies?.['@element-plus']);
  }

  get scanPatterns() {
    return ['src/api/*.js', 'src/router/*.js', 'src/stores/*.js', '.env.*'];
  }
}

module.exports = Vue3AdminAdapter;
