<template>
  <div class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">AI 配置</h1>
        <p class="page-desc">配置大模型 API 连接</p>
      </div>
      <button class="btn btn-secondary" @click="testConnection" :disabled="testing">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        {{ testing ? '测试中...' : '测试连接' }}
      </button>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <span>加载配置中...</span>
    </div>

    <div v-else class="ai-config-content">
      <!-- Connection Status -->
      <div :class="['status-card', testResult?.success ? 'success' : '']">
        <div class="status-icon">
          <svg v-if="!testResult" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <svg v-else-if="testResult.success" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <div class="status-info">
          <div class="status-title">
            {{ testResult ? (testResult.success ? '连接成功' : '连接失败') : '未测试' }}
          </div>
          <div class="status-desc">
            {{ testResult ? (testResult.success ? 'API 服务正常响应' : testResult.error) : '点击"测试连接"检查 API 配置' }}
          </div>
        </div>
        <div :class="['status-indicator', testResult?.success ? 'active' : '']"></div>
      </div>

      <!-- Config Cards -->
      <div class="grid grid-2">
        <!-- Protocol Config -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17" />
                <path d="M2 12L12 17L22 12" />
              </svg>
              协议配置
            </h2>
          </div>

          <div class="form-stack">
            <div class="input-group">
              <label class="input-label">协议类型</label>
              <select v-model="config.protocol" class="input">
                <option value="openai">OpenAI 兼容</option>
                <option value="anthropic">Anthropic</option>
              </select>
              <span class="input-hint">
                {{ config.protocol === 'openai' ? '适用于 DeepSeek、Kimi、MiniMax 等' : '适用于 Claude 系列' }}
              </span>
            </div>

            <div class="input-group">
              <label class="input-label">API 地址</label>
              <input 
                v-model="config.baseUrl" 
                class="input" 
                placeholder="https://api.deepseek.com"
              />
            </div>
          </div>
        </div>

        <!-- Model Config -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              模型配置
            </h2>
          </div>

          <div class="form-stack">
            <div class="input-group">
              <label class="input-label">模型名称</label>
              <input 
                v-model="config.model" 
                class="input" 
                :placeholder="config.protocol === 'openai' ? 'deepseek-chat' : 'claude-3-5-sonnet-20241022'"
              />
            </div>

            <div class="input-group">
              <label class="input-label">最大 Tokens</label>
              <input 
                v-model.number="config.maxTokens" 
                type="number" 
                class="input" 
                placeholder="4096"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- API Key Status -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
            API Key 状态
          </h2>
          <span :class="['badge', config.hasApiKey ? 'badge-success' : 'badge-warning']">
            {{ config.hasApiKey ? '已配置' : '未配置' }}
          </span>
        </div>

        <div class="api-key-info">
          <div class="info-item">
            <div class="info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div class="info-text">
              API Key 存储在项目根目录的 <code>.env</code> 文件中，不会提交到版本控制
            </div>
          </div>
          
          <div class="env-template">
            <div class="env-header">
              <span class="env-filename">.env</span>
              <button class="btn-copy" @click="copyEnvTemplate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                复制
              </button>
            </div>
            <pre class="env-content"><code>{{ envTemplate }}</code></pre>
          </div>
        </div>
      </div>

      <!-- Supported Providers -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            支持的服务商
          </h2>
        </div>

        <div class="providers-grid">
          <div 
            v-for="provider in providers" 
            :key="provider.name"
            :class="['provider-item', config.baseUrl?.includes(provider.domain) ? 'active' : '']"
            @click="selectProvider(provider)"
          >
            <div class="provider-name">{{ provider.name }}</div>
            <div class="provider-model">{{ provider.model }}</div>
          </div>
        </div>
      </div>
    </div>

    <transition name="fade">
      <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
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
      loading: true,
      testing: false,
      testResult: null,
      toast: {
        show: false,
        message: '',
        type: 'success'
      },
      providers: [
        { name: 'DeepSeek', domain: 'api.deepseek.com', protocol: 'openai', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
        { name: 'Kimi', domain: 'api.moonshot.cn', protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
        { name: 'MiniMax', domain: 'api.minimax.chat', protocol: 'openai', baseUrl: 'https://api.minimax.chat', model: 'abab6.5-chat' },
        { name: '智谱 AI', domain: 'open.bigmodel.cn', protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4' },
        { name: '百川', domain: 'api.baichuan-ai.com', protocol: 'openai', baseUrl: 'https://api.baichuan-ai.com/v1', model: 'Baichuan4' },
        { name: 'Claude', domain: 'api.anthropic.com', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-20241022' }
      ]
    };
  },
  computed: {
    envTemplate() {
      if (this.config.protocol === 'anthropic') {
        return '# Anthropic API Key\nANTHROPIC_API_KEY=your-api-key-here';
      }
      return '# OpenAI 兼容 API Key\nOPENAI_API_KEY=your-api-key-here';
    }
  },
  async mounted() {
    await this.loadConfig();
  },
  methods: {
    async loadConfig() {
      try {
        const res = await axios.get('/api/ai/config');
        this.config = res.data;
      } catch (err) {
        this.showToast('加载配置失败', 'error');
      } finally {
        this.loading = false;
      }
    },
    async testConnection() {
      this.testing = true;
      this.testResult = null;
      try {
        const res = await axios.post('/api/ai/test');
        this.testResult = res.data;
        if (res.data.success) {
          this.showToast('连接成功', 'success');
        } else {
          this.showToast('连接失败: ' + res.data.error, 'error');
        }
      } catch (err) {
        this.testResult = { success: false, error: err.message };
        this.showToast('测试失败: ' + err.message, 'error');
      } finally {
        this.testing = false;
      }
    },
    selectProvider(provider) {
      this.config.protocol = provider.protocol;
      this.config.baseUrl = provider.baseUrl;
      this.config.model = provider.model;
    },
    copyEnvTemplate() {
      navigator.clipboard.writeText(this.envTemplate);
      this.showToast('已复制到剪贴板', 'success');
    },
    showToast(message, type = 'success') {
      this.toast = { show: true, message, type };
      setTimeout(() => {
        this.toast.show = false;
      }, 3000);
    }
  }
};
</script>

<style scoped>
.page {
  max-width: 900px;
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 32px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.page-desc {
  font-size: 14px;
  color: var(--text-muted);
}

.ai-config-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Status Card */
.status-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all var(--transition-normal);
}

.status-card.success {
  border-color: var(--accent-primary);
  box-shadow: 0 0 20px #00F5A022;
}

.status-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  border-radius: 12px;
  color: var(--text-muted);
}

.status-card.success .status-icon {
  color: var(--accent-primary);
  background: #00F5A011;
}

.status-info {
  flex: 1;
}

.status-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.status-desc {
  font-size: 13px;
  color: var(--text-muted);
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: all var(--transition-normal);
}

.status-indicator.active {
  background: var(--accent-primary);
  box-shadow: 0 0 12px var(--accent-primary);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Form */
.form-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* API Key Info */
.api-key-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
}

.info-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  margin-top: 2px;
}

.info-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.info-text code {
  font-family: var(--font-mono);
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--accent-primary);
}

.env-template {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.env-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
}

.env-filename {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-copy:hover {
  background: var(--bg-card-hover);
  color: var(--text-primary);
}

.env-content {
  padding: 16px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* Providers Grid */
.providers-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.provider-item {
  padding: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.provider-item:hover {
  border-color: var(--text-muted);
  transform: translateY(-2px);
}

.provider-item.active {
  border-color: var(--accent-primary);
  background: #00F5A008;
}

.provider-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.provider-model {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.grid {
  display: grid;
  gap: 20px;
}

.grid-2 {
  grid-template-columns: repeat(2, 1fr);
}
</style>
