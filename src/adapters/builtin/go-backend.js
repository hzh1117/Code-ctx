const { BaseAdapter } = require('../base');

class GoBackendAdapter extends BaseAdapter {
  get type() { return 'go-backend'; }

  detect(pkg, files) {
    return files.includes('go.mod');
  }

  get scanPatterns() {
    return [
      '**/handler/*.go',
      '**/service/*.go',
      '**/model/*.go',
      '**/middleware/*.go',
      'main.go',
      'go.mod'
    ];
  }
}

module.exports = GoBackendAdapter;
