const path = require('path');
const { buildSubprojectPrompt, buildOneShotPrompt } = require('../../src/generator/prompt-builder');

describe('prompt builder path privacy', () => {
  test('uses relative project paths in subproject and one-shot prompts', () => {
    const absolutePath = path.join(process.cwd(), 'packages', 'private-app');
    const project = {
      alias: 'private-app',
      name: 'private-app',
      type: 'node',
      path: absolutePath
    };
    const scanResult = { tree: '', sourceFiles: [], keyFiles: [] };

    const subproject = buildSubprojectPrompt({ project, scanResult, language: 'en' });
    const oneShot = buildOneShotPrompt({
      projects: [project],
      scanResults: { 'private-app': scanResult },
      language: 'en'
    });

    expect(subproject).not.toContain(absolutePath);
    expect(oneShot).not.toContain(absolutePath);
    expect(subproject).toContain('packages/private-app');
    expect(oneShot).toContain('packages/private-app');
  });
});
