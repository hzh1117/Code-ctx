const { parseOneShotDocuments } = require('../../src/generator/one-shot-parser');

describe('one-shot document parser', () => {
  test('parses strict alias-paired machine boundaries', () => {
    const result = parseOneShotDocuments([
      'preamble ignored',
      '<<<CODE_CTX_DOC web>>>',
      '# Web',
      '<<<END_CODE_CTX_DOC web>>>',
      '<<<CODE_CTX_DOC api>>>',
      '# API',
      '<<<END_CODE_CTX_DOC api>>>'
    ].join('\n'), ['web', 'api']);

    expect(result.errors.size).toBe(0);
    expect(result.documents.get('web')).toBe('# Web');
    expect(result.documents.get('api')).toBe('# API');
  });

  test('rejects duplicate, missing, unknown, and unclosed project blocks', () => {
    const result = parseOneShotDocuments([
      '<<<CODE_CTX_DOC web>>>one<<<END_CODE_CTX_DOC web>>>',
      '<<<CODE_CTX_DOC web>>>two<<<END_CODE_CTX_DOC web>>>',
      '<<<CODE_CTX_DOC broken>>>never closed',
      '<<<CODE_CTX_DOC unknown>>>x<<<END_CODE_CTX_DOC unknown>>>'
    ].join('\n'), ['web', 'api', 'broken']);

    expect(result.documents.size).toBe(0);
    expect(result.errors.get('web')).toMatch(/重复/);
    expect(result.errors.get('api')).toMatch(/缺少/);
    expect(result.errors.get('broken')).toMatch(/未正确闭合/);
    expect(result.errors.get('unknown')).toMatch(/未知/);
  });
});
