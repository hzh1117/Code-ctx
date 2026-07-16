<template>
  <div class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">AI 配置</h1>
        <p class="page-desc">配置大模型 API 连接</p>
      </div>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <span>加载配置中...</span>
    </div>

    <div v-else class="ai-content">
      <div class="status-bar">
        <div class="status-segments">
          <div class="status-seg" :class="{ active: !testResult, success: testResult?.success, fail: testResult && !testResult.success }">
            <span class="seg-dot"></span>
            <span class="seg-label">{{ testResult ? (testResult.success ? 'connected' : 'failed') : 'untested' }}</span>
          </div>
        </div>
        <div class="status-detail" v-if="testResult && !testResult.success">
          <span class="mono-dim">{{ testResult.error }}</span>
        </div>
        <button class="btn btn-secondary btn-sm" @click="testConnection" :disabled="testing">
          {{ testing ? 'testing...' : '测试连接' }}
        </button>
      </div>

      <div class="card preset-card" v-if="presets.length">
        <div class="card-header">
          <h2 class="card-title">服务商模板</h2>
          <span class="mono-dim">一键填充 baseUrl / model / maxTokens</span>
        </div>
        <div class="preset-row">
          <button
            v-for="p in presets"
            :key="p.id"
            class="btn btn-secondary btn-sm preset-btn"
            @click="applyPreset(p)"
            :title="p.description"
          >{{ p.name }}</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            协议配置
          </h2>
          <div class="protocol-tabs">
            <button
              :class="['tab-btn', { active: activeTab === 'openai' }]"
              @click="activeTab = 'openai'"
            >OpenAI 兼容</button>
            <button
              :class="['tab-btn', { active: activeTab === 'anthropic' }]"
              @click="activeTab = 'anthropic'"
            >Anthropic</button>
          </div>
        </div>

        <div class="active-badge" v-if="config.protocol === activeTab">
          <span class="active-dot"></span>
          <span class="mono-sm">当前启用</span>
        </div>

        <div v-show="activeTab === 'openai'" class="form-stack">
          <div class="input-group">
            <label class="input-label">base_url</label>
            <input v-model="config.providers.openai.baseUrl" class="input" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="input-group">
            <label class="input-label">model</label>
            <input v-model="config.providers.openai.model" class="input" placeholder="gpt-5.5" />
          </div>
          <div class="input-group">
            <label class="input-label">max_tokens</label>
            <input v-model.number="config.providers.openai.maxTokens" type="number" class="input" placeholder="4096" />
          </div>
          <div class="input-group">
            <label class="input-label">api_key</label>
            <div class="input-with-action">
              <input :type="showOpenAIKey ? 'text' : 'password'" v-model="apiKeys.openai" class="input" :placeholder="keyPlaceholders.openai" />
              <button class="btn btn-secondary btn-sm" @click="showOpenAIKey = !showOpenAIKey">
                {{ showOpenAIKey ? '隐藏' : '显示' }}
              </button>
            </div>
            <span class="input-hint">保存到 .env 的 OPENAI_API_KEY</span>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="setProtocol('openai')" :disabled="config.protocol === 'openai'">
              {{ config.protocol === 'openai' ? '已启用' : '设为启用' }}
            </button>
          </div>
        </div>

        <div v-show="activeTab === 'anthropic'" class="form-stack">
          <div class="input-group">
            <label class="input-label">base_url</label>
            <input v-model="config.providers.anthropic.baseUrl" class="input" placeholder="https://api.anthropic.com" />
          </div>
          <div class="input-group">
            <label class="input-label">model</label>
            <input v-model="config.providers.anthropic.model" class="input" placeholder="claude-sonnet-4-5-20250929" />
          </div>
          <div class="input-group">
            <label class="input-label">max_tokens</label>
            <input v-model.number="config.providers.anthropic.maxTokens" type="number" class="input" placeholder="4096" />
          </div>
          <div class="input-group">
            <label class="input-label">api_key</label>
            <div class="input-with-action">
              <input :type="showAnthropicKey ? 'text' : 'password'" v-model="apiKeys.anthropic" class="input" :placeholder="keyPlaceholders.anthropic" />
              <button class="btn btn-secondary btn-sm" @click="showAnthropicKey = !showAnthropicKey">
                {{ showAnthropicKey ? '隐藏' : '显示' }}
              </button>
            </div>
            <span class="input-hint">保存到 .env 的 ANTHROPIC_API_KEY</span>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="setProtocol('anthropic')" :disabled="config.protocol === 'anthropic'">
              {{ config.protocol === 'anthropic' ? '已启用' : '设为启用' }}
            </button>
          </div>
        </div>

        <div class="card-footer">
          <button class="btn btn-primary" @click="saveAll" :disabled="saving">
            {{ saving ? '保存中...' : '保存配置' }}
          </button>
        </div>
      </div>
    </div>

    <transition name="page-fade">
      <div v-if="toast.show" :class="['global-toast', `toast-${toast.type}`]">
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      config: {},
      defaultProviders: {
        openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.5', maxTokens: 4096 },
        anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-6', maxTokens: 4096 }
      },
      loading: true,
      testing: false,
      saving: false,
      testResult: null,
      activeTab: 'openai',
      showOpenAIKey: false,
      showAnthropicKey: false,
      apiKeys: { openai: '', anthropic: '' },
      presets: [],
      toast: { show: false, message: '', type: 'success' }
    };
  },
  async mounted() {
    await Promise.all([this.loadConfig(), this.loadPresets()]);
    this.activeTab = this.config.protocol || 'openai';
  },
  computed: {
    keyPlaceholders() {
      const keys = this.config.keys || {};
      return {
        openai: keys.openai?.apiKey ? `已配置: ${keys.openai.apiKey}` : '输入 API Key',
        anthropic: keys.anthropic?.apiKey ? `已配置: ${keys.anthropic.apiKey}` : '输入 API Key'
      };
    }
  },
  methods: {
    getErrorMessage(err) {
      return err?.response?.data?.error || err?.response?.data?.message || err.message || '请求失败';
    },
    normalizeConfig(data) {
      const providers = data.providers || {};
      return {
        ...data,
        protocol: data.protocol || 'openai',
        providers: {
          openai: { ...this.defaultProviders.openai, ...(providers.openai || {}) },
          anthropic: { ...this.defaultProviders.anthropic, ...(providers.anthropic || {}) }
        }
      };
    },
    async loadConfig() {
      try {
        const res = await axios.get('/api/ai/config');
        this.config = this.normalizeConfig(res.data);
      } catch (err) {
        this.showToast('加载配置失败', 'error');
      } finally {
        this.loading = false;
      }
    },
    async loadPresets() {
      try {
        const res = await axios.get('/api/ai/presets');
        this.presets = res.data.presets || [];
      } catch (err) {
        // Presets are an enhancement — silently skip if unavailable.
      }
    },
    applyPreset(p) {
      // Only fill the matching protocol's fields so we never silently replace
      // settings the user just typed for the other protocol.
      if (!this.config.providers) this.config.providers = { ...this.defaultProviders };
      if (p.protocol === 'openai') {
        this.config.providers.openai = { baseUrl: p.baseUrl, model: p.model, maxTokens: p.maxTokens };
        this.activeTab = 'openai';
      } else if (p.protocol === 'anthropic') {
        this.config.providers.anthropic = { baseUrl: p.baseUrl, model: p.model, maxTokens: p.maxTokens };
        this.activeTab = 'anthropic';
      }
      this.config.protocol = p.protocol;
      this.showToast(`已应用模板：${p.name}`, 'success');
    },
    setProtocol(p) {
      this.config.protocol = p;
    },
    async testConnection() {
      this.testing = true;
      this.testResult = null;
      try {
        const res = await axios.post('/api/ai/test');
        this.testResult = res.data;
        this.showToast(res.data.success ? '连接成功' : '连接失败: ' + res.data.error, res.data.success ? 'success' : 'error');
      } catch (err) {
        this.testResult = { success: false, error: err.message };
        this.showToast('测试失败: ' + err.message, 'error');
      } finally {
        this.testing = false;
      }
    },
    async saveApiKey(protocol) {
      const apiKey = this.apiKeys[protocol];
      if (!apiKey) return;
      await axios.post('/api/ai/save-key', { apiKey, protocol });
      this.apiKeys[protocol] = '';
    },
    async saveAll() {
      this.saving = true;
      try {
        await axios.put('/api/ai/config', {
          protocol: this.config.protocol,
          openai: this.config.providers.openai,
          anthropic: this.config.providers.anthropic
        });
        await this.saveApiKey('openai');
        await this.saveApiKey('anthropic');
        await this.loadConfig();
        this.showToast('配置已保存', 'success');
      } catch (err) {
        this.showToast('保存失败: ' + this.getErrorMessage(err), 'error');
      } finally {
        this.saving = false;
      }
    },
    showToast(message, type = 'success') {
      this.toast = { show: true, message, type };
      setTimeout(() => { this.toast.show = false; }, 3000);
    }
  }
};
</script>

<style scoped>
.ai-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preset-card .preset-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.preset-btn {
  font-family: var(--font-mono);
}
.mono-dim {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.status-segments {
  display: flex;
  gap: 2px;
}

.status-seg {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-base);
  border: 1px solid var(--border);
  transition: all 120ms;
}

.status-seg.active {
  color: var(--text-secondary);
  border-color: var(--border-active);
}

.status-seg.success {
  color: var(--success);
  border-color: var(--success-border);
  background: var(--success-dim);
}

.status-seg.fail {
  color: var(--danger);
  border-color: var(--danger-border);
  background: var(--danger-dim);
}

.seg-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.seg-label {
  text-transform: lowercase;
}

.status-detail {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
}

.mono-dim {
  font-family: var(--font-mono);
  color: var(--text-muted);
  font-size: 12px;
}

.protocol-tabs {
  display: flex;
  gap: 2px;
  background: var(--bg-base);
  border-radius: 4px;
  padding: 2px;
  border: 1px solid var(--border);
}

.tab-btn {
  padding: 5px 12px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 80ms;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.active-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  margin-bottom: 12px;
}

.active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
}

.mono-sm {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--success);
}

.input-with-action {
  display: flex;
  gap: 8px;
}

.input-with-action .input {
  flex: 1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--border);
}
</style>
