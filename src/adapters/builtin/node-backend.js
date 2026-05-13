const { BaseAdapter } = require('../base');

class NodeBackendAdapter extends BaseAdapter {
  get type() { return 'node-backend'; }

  detect(pkg) {
    return !!(pkg.dependencies?.express || pkg.dependencies?.koa || pkg.dependencies?.['@nestjs/core']);
  }

  get scanPatterns() {
    return ['routes/*.js', 'controllers/*.js', 'app.js'];
  }
}

module.exports = NodeBackendAdapter;
