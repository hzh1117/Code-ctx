const fs = require('fs');
const path = require('path');
const { writeToClipboard } = require('./clipboard');

/**
 * Output a prompt to stdout / file / clipboard with consistent fallback handling.
 *
 * Priority: --stdout > --out > clipboard. When clipboard write fails,
 * writeToClipboard degrades to a temp file and we report the path.
 *
 * @param {string} prompt
 * @param {{ stdout?: boolean, out?: string }} cliOptions - parsed CLI flags
 * @param {{ successMessage?: string, fallbackPrefix?: string }} [opts]
 *   - successMessage: message shown on clipboard success
 *   - fallbackPrefix: string prepended to the fallback message (e.g. '\n' for spacing)
 */
async function outputPrompt(prompt, cliOptions = {}, opts = {}) {
  const successMessage = opts.successMessage || '✓ 已复制到剪贴板';
  const fallbackPrefix = opts.fallbackPrefix || '';

  if (cliOptions.stdout) {
    process.stdout.write(prompt);
    return;
  }
  if (cliOptions.out) {
    fs.writeFileSync(path.resolve(cliOptions.out), prompt);
    console.log(`✓ 已写入 ${cliOptions.out}`);
    return;
  }
  const clipResult = await writeToClipboard(prompt);
  if (clipResult.success) {
    console.log(successMessage);
  } else {
    console.log(`${fallbackPrefix}⚠ 剪贴板写入失败，已降级输出到 ${clipResult.fallbackPath}`);
  }
}

module.exports = { outputPrompt };
