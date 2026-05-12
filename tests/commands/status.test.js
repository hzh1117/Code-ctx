const { statusCommand } = require('../../src/commands/status');
const fs = require('fs');
const path = require('path');

describe('statusCommand', () => {
  const testDir = path.join(__dirname, '../fixtures/status-test');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, 'ai-docs'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'ai-docs/OVERVIEW.md'), '# Overview');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should show document status', async () => {
    const status = await statusCommand(testDir);
    expect(status.documents.length).toBeGreaterThan(0);
    expect(status.documents[0].name).toBe('OVERVIEW.md');
  });

  test('should return empty when ai-docs not exist', async () => {
    const noDocsDir = path.join(testDir, 'no-docs');
    fs.mkdirSync(noDocsDir, { recursive: true });

    const status = await statusCommand(noDocsDir);
    expect(status.documents).toEqual([]);
    expect(status.message).toBe('ai-docs/ 目录不存在');
  });

  test('should include file size and lastModified', async () => {
    const status = await statusCommand(testDir);
    expect(status.documents[0]).toHaveProperty('size');
    expect(status.documents[0]).toHaveProperty('lastModified');
  });
});
