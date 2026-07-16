const fs = require('fs');
const path = require('path');
const { filterSensitive, scanDirectory } = require('../utils/sensitive-filter');
const { listSections } = require('../core/section');

function createValidationService(dependencies = {}) {
  const fileSystem = dependencies.fs || fs;
  const pathImpl = dependencies.path || path;
  const filter = dependencies.filterSensitive || filterSensitive;
  const scan = dependencies.scanDirectory || scanDirectory;
  const logger = dependencies.logger;

  return {
    sanitize(content) {
      return filter(content).content;
    },
    listSections,
    expectedSections(templateName) {
      const templatePath = pathImpl.join(__dirname, '../../templates', templateName);
      if (!fileSystem.existsSync(templatePath)) return [];
      return listSections(fileSystem.readFileSync(templatePath, 'utf8'))
        .filter(section => /^[a-z][a-z0-9-]*$/.test(section));
    },
    inspect(outputDir) {
      logger.step('7/7', '敏感信息检查');
      logger.verbose('扫描目录:', outputDir);
      const warnings = scan(outputDir);
      if (warnings.length > 0) {
        logger.log('\n检测到 ai-docs/ 中可能包含敏感信息：');
        warnings.forEach(warning => logger.log(`  - ${warning.file}: ${warning.field}`));
        logger.log('建议运行 code-ctx doctor 查看详细报告');
      } else {
        logger.verbose('未发现敏感信息');
      }
      return warnings;
    }
  };
}

module.exports = { createValidationService };
