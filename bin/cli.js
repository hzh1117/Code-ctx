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
program.addCommand(require('./commands/config'));

program.parse();
