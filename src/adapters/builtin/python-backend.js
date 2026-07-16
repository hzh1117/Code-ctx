const path = require('path');
const { BaseAdapter } = require('../base');

class PythonBackendAdapter extends BaseAdapter {
  get type() {
    return 'python-backend';
  }

  detect(pkg, files) {
    return files.includes('requirements.txt') || files.includes('pyproject.toml');
  }

  get scanPatterns() {
    return ['**/views.py', '**/models.py', '**/serializers.py', '**/urls.py', 'app.py', 'requirements.txt'];
  }

  get priorityKeywords() {
    return {
      'manage.py': 1,
      'app.py': 2,
      'urls.py': 3,
      'views.py': 4,
      'models.py': 5,
      'serializers.py': 6,
      'requirements.txt': 7,
      'pyproject.toml': 7
    };
  }

  getPromptHints() {
    return 'Python 后端项目，注意 View-Model-Serializer 分层，关注路由 URL 配置和中间件设置';
  }

  extractKeyFiles(dir) {
    return [
      path.join(dir, 'requirements.txt'),
      path.join(dir, 'pyproject.toml'),
      path.join(dir, 'app.py'),
      path.join(dir, 'manage.py')
    ];
  }
}

module.exports = PythonBackendAdapter;
