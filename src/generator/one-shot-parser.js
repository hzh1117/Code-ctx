const DOC_BLOCK_PATTERN = /<<<CODE_CTX_DOC ([A-Za-z0-9-]+)>>>\s*([\s\S]*?)\s*<<<END_CODE_CTX_DOC \1>>>/g;
const START_PATTERN = /<<<CODE_CTX_DOC ([A-Za-z0-9-]+)>>>/g;

function parseOneShotDocuments(output, expectedAliases) {
  const expected = new Set(expectedAliases || []);
  const documents = new Map();
  const errors = new Map();
  const matchedStarts = new Set();

  for (const match of String(output || '').matchAll(DOC_BLOCK_PATTERN)) {
    const alias = match[1];
    const document = match[2].trim();
    matchedStarts.add(alias);
    if (!expected.has(alias)) {
      errors.set(alias, `AI 响应包含未知项目 alias: ${alias}`);
      continue;
    }
    if (documents.has(alias)) {
      documents.delete(alias);
      errors.set(alias, `AI 响应重复包含项目: ${alias}`);
      continue;
    }
    if (!document) {
      errors.set(alias, `AI 响应中的项目文档为空: ${alias}`);
      continue;
    }
    documents.set(alias, document);
  }

  for (const start of String(output || '').matchAll(START_PATTERN)) {
    const alias = start[1];
    if (!matchedStarts.has(alias) && expected.has(alias)) {
      errors.set(alias, `项目 ${alias} 的机器边界未正确闭合`);
    }
  }

  for (const alias of expected) {
    if (!documents.has(alias) && !errors.has(alias)) {
      errors.set(alias, `AI 响应中缺少项目文档: ${alias}`);
    }
  }

  return { documents, errors };
}

module.exports = { parseOneShotDocuments, DOC_BLOCK_PATTERN };
