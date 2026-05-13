const chalk = require('chalk');

const isVerbose = process.argv.includes('--verbose') || process.env.CODE_CTX_VERBOSE === '1';

function success(msg) {
  console.log(chalk.green('✓ ') + msg);
}

function warn(msg) {
  console.log(chalk.yellow('⚠ ') + msg);
}

function error(msg) {
  console.log(chalk.red('✗ ') + msg);
}

function info(msg) {
  console.log(chalk.blue('ℹ ') + msg);
}

function debug(msg) {
  if (isVerbose) {
    console.log(chalk.gray('  [debug] ') + msg);
  }
}

module.exports = { success, warn, error, info, debug };
