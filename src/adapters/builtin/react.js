const { BaseAdapter } = require('../base');

class ReactAdapter extends BaseAdapter {
  get type() { return 'react'; }

  detect(pkg) {
    return !!pkg.dependencies?.react;
  }

  get scanPatterns() {
    return [
      'src/components/**/*.{jsx,tsx}',
      'src/pages/**/*.{jsx,tsx}',
      'src/hooks/*.js',
      'src/App.{jsx,tsx}',
      'src/index.{jsx,tsx}'
    ];
  }
}

module.exports = ReactAdapter;
