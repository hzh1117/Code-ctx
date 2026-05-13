const path = require('path');
const { BaseAdapter } = require('../base');

class NodeBackendAdapter extends BaseAdapter {
  get type() { return 'node-backend'; }

  detect(pkg) {
    return !!(pkg.dependencies?.express || pkg.dependencies?.koa || pkg.dependencies?.['@nestjs/core']);
  }

  get scanPatterns() {
    return ['routes/*.js', 'controllers/*.js', 'app.js'];
  }

  getPromptHints() {
    return 'Node.js 后端项目，注意路由-控制器-中间件分层，关注错误处理和中间件链';
  }

  extractKeyFiles(dir) {
    return [
      path.join(dir, 'app.js'),
      path.join(dir, 'package.json')
    ];
  }
}

module.exports = NodeBackendAdapter;
