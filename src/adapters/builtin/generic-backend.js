const { BaseAdapter } = require('../base');

class GenericBackendAdapter extends BaseAdapter {
  get type() {
    return 'generic-backend';
  }

  get detectionPriority() {
    return 800;
  }

  detect(pkg, files) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    return !!(
      deps['@apollo/server'] ||
      deps['apollo-server'] ||
      deps['graphql-yoga'] ||
      deps['socket.io'] ||
      files.includes('server.js') ||
      files.includes('server.ts')
    );
  }

  get scanPatterns() {
    return [
      '{src,server,app,api,routes,controllers,handlers,services,models}/**/*.{js,cjs,mjs,ts,tsx}',
      '*.{js,cjs,mjs,ts}'
    ];
  }

  get priorityKeywords() {
    return {
      '/server.': 1,
      '/app.': 2,
      '/route': 3,
      '/controller': 4,
      '/handler': 4,
      '/service': 5,
      '/model': 6
    };
  }
}

module.exports = GenericBackendAdapter;
