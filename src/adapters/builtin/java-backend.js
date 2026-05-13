const { BaseAdapter } = require('../base');

class JavaBackendAdapter extends BaseAdapter {
  get type() { return 'java-backend'; }

  detect(pkg, files) {
    return files.includes('pom.xml') || files.includes('build.gradle');
  }

  get scanPatterns() {
    return [
      '**/controller/**/*.java',
      '**/service/**/*.java',
      '**/entity/**/*.java',
      'application.yml',
      'application.properties'
    ];
  }
}

module.exports = JavaBackendAdapter;
