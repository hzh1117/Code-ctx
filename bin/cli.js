#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();

program
  .name('code-ctx')
  .description('AI 开发上下文工具')
  .version('1.0.0');

// 后续添加命令
// program.addCommand(require('../src/commands/init'));
// program.addCommand(require('../src/commands/use'));

program.parse();
