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
program.addCommand(require('./commands/dashboard'));

program.parse();
