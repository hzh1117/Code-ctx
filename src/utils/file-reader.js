const fs = require('fs');
const path = require('path');
const chardet = require('chardet');
const iconv = require('iconv-lite');

const CJK_ENCODINGS = ['GBK', 'GB2312', 'GB18030', 'Big5'];

function readFileUTF8(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  
  if (isUTF8(buffer)) {
    return buffer.toString('utf8');
  }
  
  for (const encoding of CJK_ENCODINGS) {
    const decoded = iconv.decode(buffer, encoding);
    if (!hasReplacementChars(decoded)) {
      return decoded;
    }
  }
  
  const detected = chardet.detect(buffer);
  return iconv.decode(buffer, detected || 'UTF-8');
}

function isUTF8(buffer) {
  try {
    const str = buffer.toString('utf8');
    const encoded = Buffer.from(str, 'utf8');
    return buffer.equals(encoded);
  } catch {
    return false;
  }
}

function hasReplacementChars(str) {
  return str.includes('\uFFFD');
}

/**
 * Check that a file path resolves within an allowed directory.
 * Prevents path traversal via ../ or absolute paths.
 */
function isWithinDir(filePath, allowedDir) {
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(allowedDir);
  return resolved === resolvedDir || resolved.startsWith(resolvedDir + path.sep);
}

module.exports = { readFileUTF8, isWithinDir };
