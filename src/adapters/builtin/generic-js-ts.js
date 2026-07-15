const { BaseAdapter } = require('../base');

class GenericJsTsAdapter extends BaseAdapter {
  get type() { return 'generic-js-ts'; }

  get detectionPriority() { return 900; }

  detect(_pkg, files) {
    return files.includes('package.json');
  }

  get scanPatterns() {
    return [
      '{src,app,lib,test,tests}/**/*.{js,cjs,mjs,jsx,ts,tsx}',
      '*.{js,cjs,mjs,jsx,ts,tsx}',
      'tsconfig*.json'
    ];
  }

  get priorityKeywords() {
    return {
      'package.json': 1,
      'tsconfig': 2,
      '/index.': 3,
      '/main.': 3,
      '/app.': 4,
      '/src/': 5,
      '/test': 8
    };
  }
}

module.exports = GenericJsTsAdapter;
