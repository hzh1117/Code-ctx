const { BaseAdapter } = require('../base');

class Vue2AdminAdapter extends BaseAdapter {
  get type() { return 'vue2-admin'; }

  detect(pkg) {
    return !!(pkg.dependencies?.vue && pkg.dependencies?.['element-ui']);
  }

  get scanPatterns() {
    return ['src/api/*.js', 'src/router/modules/*.js', 'src/store/modules/*.js', '.env.*'];
  }
}

module.exports = Vue2AdminAdapter;
