/**
 * Section marker utilities for incremental document updates.
 * Sections are marked with HTML comments: <!-- section:xxx --> ... <!-- /section:xxx -->
 */

/**
 * Extract content between <!-- section:xxx --> and <!-- /section:xxx -->
 * @param {string} content - Full document content
 * @param {string} sectionName - Name of the section to extract
 * @returns {string|null} Section content (without markers), or null if not found
 */
function extractSection(content, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<!--\\s*section:${escaped}\\s*-->\\s*\\n([\\s\\S]*?)\\n\\s*<!--\\s*\\/section:${escaped}\\s*-->`,
    'm'
  );
  const match = content.match(re);
  return match ? match[1] : null;
}

/**
 * Replace content between <!-- section:xxx --> and <!-- /section:xxx -->
 * Preserves the markers themselves.
 * @param {string} content - Full document content
 * @param {string} sectionName - Name of the section to replace
 * @param {string} newContent - New content to put inside the section
 * @returns {string} Updated content, or original if section not found
 */
function replaceSection(content, sectionName, newContent) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<!--\\s*section:${escaped}\\s*-->)\\s*\\n[\\s\\S]*?(\\n\\s*<!--\\s*\\/section:${escaped}\\s*-->)`,
    'm'
  );
  if (!re.test(content)) return content;
  return content.replace(re, `$1\n${newContent}$2`);
}

/**
 * List all section names found in the document.
 * @param {string} content - Full document content
 * @returns {string[]} Array of unique section names
 */
function listSections(content) {
  const names = new Set();
  const openRe = /<!--\s*section:(\S+)\s*-->/g;
  let match;
  while ((match = openRe.exec(content)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

module.exports = { extractSection, replaceSection, listSections };
