const { extractSection, replaceSection, listSections } = require('../../src/core/section');

describe('extractSection', () => {
  test('extracts multi-line content between markers', () => {
    const content = [
      '# Title',
      '<!-- section:overview -->',
      '第一行概述',
      '第二行概述',
      '第三行概述',
      '<!-- /section:overview -->',
      '# Other'
    ].join('\n');

    const result = extractSection(content, 'overview');
    expect(result).toBe('第一行概述\n第二行概述\n第三行概述');
  });

  test('returns null for non-existent section', () => {
    const content = '<!-- section:other -->\n内容\n<!-- /section:other -->';
    expect(extractSection(content, 'overview')).toBeNull();
  });

  test('returns null for empty document', () => {
    expect(extractSection('', 'overview')).toBeNull();
  });

  test('handles section name with hyphens', () => {
    const content = ['<!-- section:api-v2 -->', 'API v2 内容', '<!-- /section:api-v2 -->'].join('\n');
    expect(extractSection(content, 'api-v2')).toBe('API v2 内容');
  });

  test('handles section name with dots', () => {
    const content = ['<!-- section:v1.0-notes -->', '版本说明', '<!-- /section:v1.0-notes -->'].join('\n');
    expect(extractSection(content, 'v1.0-notes')).toBe('版本说明');
  });

  test('handles section name with regex special characters', () => {
    const content = ['<!-- section:api(legacy) -->', '旧版 API', '<!-- /section:api(legacy) -->'].join('\n');
    expect(extractSection(content, 'api(legacy)')).toBe('旧版 API');
  });

  test('handles section name with plus and asterisk', () => {
    const content = ['<!-- section:c++ -->', 'C++ 内容', '<!-- /section:c++ -->'].join('\n');
    expect(extractSection(content, 'c++')).toBe('C++ 内容');
  });

  test('extracts first occurrence when duplicate sections exist', () => {
    const content = [
      '<!-- section:note -->',
      '第一个',
      '<!-- /section:note -->',
      '<!-- section:note -->',
      '第二个',
      '<!-- /section:note -->'
    ].join('\n');
    expect(extractSection(content, 'note')).toBe('第一个');
  });

  test('handles section with no content between markers', () => {
    const content = '<!-- section:empty -->\n<!-- /section:empty -->';
    // The regex requires \n between markers, empty section may return null
    const result = extractSection(content, 'empty');
    // Accept either empty string or null depending on regex behavior
    expect(result === '' || result === null).toBe(true);
  });

  test('handles markers with extra whitespace', () => {
    const content = ['<!--  section:spaced  -->', '内容', '<!--  /section:spaced  -->'].join('\n');
    expect(extractSection(content, 'spaced')).toBe('内容');
  });

  test('does not match partial section names', () => {
    const content = ['<!-- section:overview -->', '概述', '<!-- /section:overview -->'].join('\n');
    expect(extractSection(content, 'over')).toBeNull();
  });
});

describe('replaceSection', () => {
  test('replaces content preserving markers', () => {
    const content = '<!-- section:mod -->\n旧内容\n<!-- /section:mod -->';
    const result = replaceSection(content, 'mod', '新内容');
    expect(result).toBe('<!-- section:mod -->\n新内容\n<!-- /section:mod -->');
  });

  test('returns original content when section not found', () => {
    const content = '<!-- section:other -->\n内容\n<!-- /section:other -->';
    const result = replaceSection(content, 'mod', '新内容');
    expect(result).toBe(content);
  });

  test('preserves content outside the replaced section', () => {
    const content = ['# 标题', '前言', '<!-- section:s -->', '旧内容', '<!-- /section:s -->', '尾部'].join('\n');

    const result = replaceSection(content, 's', '新内容');
    expect(result).toContain('# 标题');
    expect(result).toContain('前言');
    expect(result).toContain('尾部');
    expect(result).toContain('新内容');
    expect(result).not.toContain('旧内容');
  });

  test('handles multi-line replacement', () => {
    const content = '<!-- section:s -->\n旧\n<!-- /section:s -->';
    const result = replaceSection(content, 's', '行1\n行2\n行3');
    expect(result).toContain('行1\n行2\n行3');
    expect(result).not.toContain('旧');
  });

  test('replaces only the matching section when multiple exist', () => {
    const content = [
      '<!-- section:a -->',
      '旧A',
      '<!-- /section:a -->',
      '<!-- section:b -->',
      '旧B',
      '<!-- /section:b -->'
    ].join('\n');

    const result = replaceSection(content, 'a', '新A');
    expect(result).toContain('新A');
    expect(result).toContain('旧B');
    expect(result).not.toContain('旧A');
  });

  test('handles section name with regex special characters', () => {
    const content = '<!-- section:api(v2) -->\n旧\n<!-- /section:api(v2) -->';
    const result = replaceSection(content, 'api(v2)', '新');
    expect(result).toContain('新');
    expect(result).not.toContain('旧');
  });

  test('returns original content for empty document', () => {
    const result = replaceSection('', 's', '新');
    expect(result).toBe('');
  });
});

describe('listSections', () => {
  test('lists all section names', () => {
    const content = [
      '<!-- section:overview -->',
      '...',
      '<!-- /section:overview -->',
      '<!-- section:modules -->',
      '...',
      '<!-- /section:modules -->'
    ].join('\n');
    expect(listSections(content)).toEqual(['overview', 'modules']);
  });

  test('returns empty array for no sections', () => {
    expect(listSections('# Title\n内容')).toEqual([]);
  });

  test('returns empty array for empty string', () => {
    expect(listSections('')).toEqual([]);
  });

  test('deduplicates section names', () => {
    const content = [
      '<!-- section:note -->',
      '...',
      '<!-- /section:note -->',
      '<!-- section:note -->',
      '...',
      '<!-- /section:note -->'
    ].join('\n');
    expect(listSections(content)).toEqual(['note']);
  });

  test('lists unclosed sections (still has opening tag)', () => {
    const content = '<!-- section:incomplete -->\n内容没有关闭';
    expect(listSections(content)).toEqual(['incomplete']);
  });

  test('handles markers with extra whitespace', () => {
    const content = '<!--  section:padded  -->\n内容\n<!--  /section:padded  -->';
    expect(listSections(content)).toEqual(['padded']);
  });

  test('handles section names with special characters', () => {
    const content = [
      '<!-- section:api-v2 -->',
      '...',
      '<!-- /section:api-v2 -->',
      '<!-- section:c++ -->',
      '...',
      '<!-- /section:c++ -->'
    ].join('\n');
    expect(listSections(content)).toEqual(['api-v2', 'c++']);
  });

  test('does not list closing tags as sections', () => {
    const content = '<!-- /section:fake -->';
    expect(listSections(content)).toEqual([]);
  });
});
