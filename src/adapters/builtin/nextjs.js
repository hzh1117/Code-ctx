const path = require('path');
const { BaseAdapter } = require('../base');

class NextjsAdapter extends BaseAdapter {
  get type() { return 'nextjs'; }

  detect(pkg, files) {
    if (!pkg.dependencies?.next && !pkg.devDependencies?.next) return false;
    return files.includes('app') || files.includes('pages');
  }

  get scanPatterns() {
    return [
      'app/api/**/*.ts',
      'pages/api/**/*.ts',
      'lib/**/*.ts'
    ];
  }

  get priorityKeywords() {
    return {
      'next.config': 1,
      'middleware': 2,
      'app/api': 3,
      'pages/api': 4,
      'lib': 5,
      'app/': 6,
      'pages/': 7
    };
  }

  getPromptHints() {
    return 'Next.js 项目，注意区分 App Router (app/) 和 Pages Router (pages/)，' +
      'Server Components 与 Client Components 的区别，' +
      'API Routes 放在 app/api/ 或 pages/api/ 下，' +
      '关注 middleware.ts 中间件配置和 next.config.js 构建选项';
  }

  extractKeyFiles(dir) {
    return [
      path.join(dir, 'next.config.js'),
      path.join(dir, 'next.config.mjs'),
      path.join(dir, 'middleware.ts'),
      path.join(dir, 'middleware.js')
    ];
  }
}

module.exports = NextjsAdapter;
