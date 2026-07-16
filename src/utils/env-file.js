const fs = require('fs');
const path = require('path');

function updateEnvValue(content, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = new RegExp(`^${escapedKey}=.*$`, 'm');
  if (expression.test(content)) return content.replace(expression, `${key}=${value}`);
  return `${content}${content && !content.endsWith('\n') ? '\n' : ''}${key}=${value}\n`;
}

function saveEnvValues(rootDir, values) {
  const envPath = path.join(rootDir, '.env');
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  if (fs.existsSync(envPath)) fs.copyFileSync(envPath, `${envPath}.bak`);
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      content = updateEnvValue(content, key, String(value));
    }
  }
  const tempPath = `${envPath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, content, { mode: 0o600 });
  fs.renameSync(tempPath, envPath);
  return envPath;
}

function ensureEnvIgnored(rootDir) {
  const gitignorePath = path.join(rootDir, '.gitignore');
  let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const entries = content.split(/\r?\n/).map(line => line.trim());
  if (entries.some(line => line === '.env' || line === '.env*' || line === '.env.*')) {
    return false;
  }
  content = `${content}${content && !content.endsWith('\n') ? '\n' : ''}.env\n`;
  fs.writeFileSync(gitignorePath, content);
  return true;
}

module.exports = { updateEnvValue, saveEnvValues, ensureEnvIgnored };
