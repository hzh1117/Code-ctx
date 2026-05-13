const { BaseAdapter } = require('../base');

class PythonBackendAdapter extends BaseAdapter {
  get type() { return 'python-backend'; }

  detect(pkg, files) {
    return files.includes('requirements.txt') || files.includes('pyproject.toml');
  }

  get scanPatterns() {
    return [
      '**/views.py',
      '**/models.py',
      '**/serializers.py',
      '**/urls.py',
      'app.py',
      'requirements.txt'
    ];
  }
}

module.exports = PythonBackendAdapter;
