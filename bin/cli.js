#!/usr/bin/env node

const { Command } = require('commander');
const { version } = require('../package.json');

const program = new Command();

program
  .name('code-ctx')
  .description('AI 开发上下文工具')
  .version(version);

program.addCommand(require('./commands/init'));
program.addCommand(require('./commands/use'));
program.addCommand(require('./commands/update'));
program.addCommand(require('./commands/fix'));
program.addCommand(require('./commands/status'));
program.addCommand(require('./commands/doctor'));
program.addCommand(require('./commands/watch'));
program.addCommand(require('./commands/hook'));
program.addCommand(require('./commands/dashboard'));

program
  .command('help')
  .description('显示帮助信息')
  .action(() => {
    console.log(`
code-ctx - AI 开发上下文工具

用法:
  code-ctx <command> [options]

命令:
  init              初始化项目，扫描结构生成 ai-docs/
  use [task]        生成开发 prompt
  update            检测变化，更新相关文档
  fix <alias>       重新生成指定子项目的文档
  status            查看 ai-docs 各文档的最后更新时间
  doctor            检查文档健康状态
  watch             监听文件变化，自动触发增量更新
  hook              管理 git post-commit hook
  help              显示此帮助信息

选项:
  -V, --version     显示版本号
  -h, --help        显示帮助

示例:
  code-ctx init
  code-ctx use "新增用户登录功能"
  code-ctx use -s B "商户后台新增优惠券管理"
  code-ctx update
  code-ctx fix web
  code-ctx status
  code-ctx doctor
`);
  });

program.parse();
