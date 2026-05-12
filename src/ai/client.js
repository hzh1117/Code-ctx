async function generateWithAI(prompt, options = {}) {
  const { apiKey, model = 'claude-3-sonnet-20240229', provider = 'anthropic' } = options;

  if (!apiKey) {
    throw new Error('需要配置 API key');
  }

  if (provider === 'anthropic') {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    return message.content[0].text;
  }

  throw new Error(`不支持的 provider: ${provider}`);
}

module.exports = { generateWithAI };
