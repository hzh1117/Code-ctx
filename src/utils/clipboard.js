const fs = require('fs');
const os = require('os');
const path = require('path');
const clipboardy = require('clipboardy');

async function writeToClipboard(content) {
  try {
    await clipboardy.write(content);
    const actual = await clipboardy.read();
    if (actual.length < content.length * 0.9) {
      throw new Error('剪贴板写入不完整');
    }
    return { success: true };
  } catch (err) {
    const fallbackPath = path.join(os.tmpdir(), '.ai-prompt.md');
    fs.writeFileSync(fallbackPath, content);
    return { success: false, fallbackPath, error: err.message };
  }
}

module.exports = { writeToClipboard };
