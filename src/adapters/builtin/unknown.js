const { BaseAdapter } = require('../base');

class UnknownAdapter extends BaseAdapter {
  get type() { return 'unknown'; }

  // Unknown is an explicit detector fallback and must not claim child folders.
  detect() { return false; }

  get scanPatterns() {
    return [
      'package.json', 'pom.xml', 'build.gradle', 'settings.gradle',
      'go.mod', 'Cargo.toml', 'pyproject.toml', 'requirements*.txt',
      'Dockerfile', 'Makefile',
      '*.{js,jsx,ts,tsx,py,java,go,rs,php,rb,cs,c,cc,cpp}',
      '{src,app,lib,server,cmd,internal,pkg}/**/*.{js,jsx,ts,tsx,vue,svelte,py,java,kt,go,rs,php,rb,cs,c,cc,cpp}'
    ];
  }

  get priorityKeywords() {
    return {
      'package.json': 1,
      'pyproject.toml': 1,
      'pom.xml': 1,
      'go.mod': 1,
      'cargo.toml': 1,
      '/index.': 2,
      '/main.': 2,
      '/app.': 3,
      '/route': 4,
      '/controller': 5,
      '/model': 6
    };
  }
}

module.exports = UnknownAdapter;
