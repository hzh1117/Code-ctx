const { BaseAdapter } = require('../base');

class UniappMiniprogramAdapter extends BaseAdapter {
  get type() { return 'uniapp-miniprogram'; }

  detect(pkg, files) {
    return !!(pkg.dependencies?.['uni-app'] || files.includes('manifest.json'));
  }

  get scanPatterns() {
    return ['api/*.js', 'pages.json', 'config/app.js', 'utils/request.js'];
  }
}

module.exports = UniappMiniprogramAdapter;
