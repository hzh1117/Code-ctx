const path = require('path');
const { BaseAdapter } = require('../base');

class UniappMiniprogramAdapter extends BaseAdapter {
  get type() { return 'uniapp-miniprogram'; }

  detect(pkg, files) {
    return !!(pkg.dependencies?.['uni-app'] || files.includes('manifest.json'));
  }

  get scanPatterns() {
    return ['api/*.js', 'pages.json', 'config/app.js', 'utils/request.js'];
  }

  getPromptHints() {
    return 'UniApp 跨端项目，注意 pages.json 路由配置，条件编译 #ifdef 区分平台差异';
  }

  extractKeyFiles(dir) {
    return [
      path.join(dir, 'pages.json'),
      path.join(dir, 'manifest.json'),
      path.join(dir, 'main.js'),
      path.join(dir, 'App.vue'),
      path.join(dir, 'uni.scss')
    ];
  }
}

module.exports = UniappMiniprogramAdapter;
