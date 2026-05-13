const path = require('path');
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

  getPromptHints() {
    return 'Java 后端项目，注意 Controller-Service-Repository 分层，DTO 与 Entity 区分，关注 application.yml 配置';
  }

  extractKeyFiles(dir) {
    return [
      path.join(dir, 'pom.xml'),
      path.join(dir, 'build.gradle'),
      path.join(dir, 'src', 'main', 'resources', 'application.yml'),
      path.join(dir, 'src', 'main', 'resources', 'application.properties')
    ];
  }
}

module.exports = JavaBackendAdapter;
