const path = require('path');
const { BaseAdapter } = require('../base');

class GoBackendAdapter extends BaseAdapter {
  get type() {
    return 'go-backend';
  }

  detect(pkg, files) {
    return files.includes('go.mod');
  }

  get scanPatterns() {
    return ['**/handler/*.go', '**/service/*.go', '**/model/*.go', '**/middleware/*.go', 'main.go', 'go.mod'];
  }

  get priorityKeywords() {
    return {
      'main.go': 1,
      'go.mod': 2,
      handler: 3,
      middleware: 4,
      service: 5,
      model: 6,
      config: 7,
      util: 8
    };
  }

  getPromptHints() {
    return 'Go 后端项目，注意 handler-service-repository 分层，关注 go.mod 依赖版本，错误处理使用 error 接口';
  }

  extractKeyFiles(dir) {
    return [path.join(dir, 'main.go'), path.join(dir, 'go.mod'), path.join(dir, 'go.sum')];
  }
}

module.exports = GoBackendAdapter;
