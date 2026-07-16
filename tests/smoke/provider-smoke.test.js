const fs = require('fs');
const path = require('path');
const { generateWithAI } = require('../../src/ai/client');
const { getAIProviders } = require('../../src/utils/config');

const enabled = process.env.RUN_PROVIDER_SMOKE === '1';
const openAIKey = process.env.OPENAI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
const providers = getAIProviders({});

describe('provider compatibility smoke tests', () => {
  test('stored contract snapshot is value-free', () => {
    const snapshotPath = path.join(__dirname, 'provider-contracts.snapshot.json');
    const raw = fs.readFileSync(snapshotPath, 'utf8');
    const snapshot = JSON.parse(raw);

    expect(snapshot.redacted).toBe(true);
    expect(snapshot.openai.requestKeys).toEqual(expect.arrayContaining(['model', 'messages']));
    expect(snapshot.anthropic.requestKeys).toEqual(expect.arrayContaining(['model', 'messages']));
    expect(raw).not.toMatch(/sk-[a-z0-9]{8,}/i);
    expect(raw).not.toMatch(/api[_-]?key\s*[=:]/i);
  });

  (enabled ? test : test.skip)('at least one provider secret is configured', () => {
    expect(Boolean(openAIKey || anthropicKey)).toBe(true);
  });

  (enabled && openAIKey ? test : test.skip)(
    'default OpenAI contract is accepted',
    async () => {
      const result = await generateWithAI('Reply with CODE_CTX_SMOKE_OK.', {
        apiKey: openAIKey,
        protocol: 'openai',
        baseUrl: process.env.OPENAI_BASE_URL || providers.openai.baseUrl,
        model: process.env.OPENAI_SMOKE_MODEL || process.env.OPENAI_MODEL || providers.openai.model,
        maxTokens: 32,
        timeout: 30000,
        deadlineMs: 60000
      });

      expect(typeof result).toBe('string');
      expect(result.trim().length).toBeGreaterThan(0);
    },
    70000
  );

  (enabled && anthropicKey ? test : test.skip)(
    'default Anthropic contract is accepted',
    async () => {
      const result = await generateWithAI('Reply with CODE_CTX_SMOKE_OK.', {
        apiKey: anthropicKey,
        protocol: 'anthropic',
        baseUrl: process.env.ANTHROPIC_BASE_URL || providers.anthropic.baseUrl,
        model: process.env.ANTHROPIC_SMOKE_MODEL || process.env.ANTHROPIC_MODEL || providers.anthropic.model,
        maxTokens: 32,
        timeout: 30000,
        deadlineMs: 60000
      });

      expect(typeof result).toBe('string');
      expect(result.trim().length).toBeGreaterThan(0);
    },
    70000
  );
});
