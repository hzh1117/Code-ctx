// Provider presets — static defaults shown in the Dashboard so users can
// fill `baseUrl` / `protocol` / `model` for a known service with one click.
// These are non-sensitive metadata only — never API keys.
//
// Default model values follow what's encoded in src/utils/config.js (P24).
// Keep the two lists aligned when adjusting defaults.

const PRESETS = [
  {
    id: 'openai',
    name: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.5',
    maxTokens: 4096,
    description: 'OpenAI 官方 API'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    description: 'Anthropic 官方 API'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    maxTokens: 4096,
    description: 'DeepSeek（OpenAI 兼容）'
  },
  {
    id: 'kimi',
    name: 'Kimi for Coding',
    protocol: 'anthropic',
    baseUrl: 'https://api.kimi.com/coding/',
    model: 'kimi-for-coding',
    maxTokens: 256000,
    description: 'Moonshot Kimi for Coding（Anthropic 兼容）'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    protocol: 'openai',
    baseUrl: 'https://api.minimax.chat/v1',
    model: 'abab6.5s-chat',
    maxTokens: 8192,
    description: 'MiniMax（OpenAI 兼容）'
  }
];

function listPresets() {
  // Return a defensive copy so callers can't mutate the shared array.
  return PRESETS.map(p => ({ ...p }));
}

function getPreset(id) {
  const found = PRESETS.find(p => p.id === id);
  return found ? { ...found } : null;
}

module.exports = { listPresets, getPreset };
