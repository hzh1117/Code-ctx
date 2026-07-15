const path = require('path');
const { BaseAdapter } = require('../base');

class NodeBackendAdapter extends BaseAdapter {
  get type() { return 'node-backend'; }

  detect(pkg) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    return !!(
      deps.express || deps.koa || deps.fastify || deps.restify ||
      deps['@hapi/hapi'] || deps['@nestjs/core']
    );
  }

  get scanPatterns() {
    return [
      '{src,server,app,routes,controllers,middleware,services,models}/**/*.{js,cjs,mjs,ts,tsx}',
      '*.{js,cjs,mjs,ts}'
    ];
  }

  get priorityKeywords() {
    return {
      'app.js': 1,
      'routes': 2,
      'controllers': 3,
      'middleware': 4,
      'service': 5,
      'model': 6,
      'config': 7,
      'util': 8
    };
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
