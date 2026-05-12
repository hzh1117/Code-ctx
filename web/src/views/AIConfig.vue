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

    <div v-else class="ai-config-content">
      <!-- 连接状态 -->
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
        <button class="btn btn-secondary" @click="testConnection" :disabled="testing">
          {{ testing ? '测试中...' : '测试连接' }}
        </button>
      </div>

      <!-- API 配置 -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" />
              <path d="M2 17L12 22L22 17" />
              <path d="M2 12L12 17L22 12" />
            </svg>
            API 配置
          </h2>
        </div>

        <div class="form-grid">
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

          <div class="input-group full-width">
            <label class="input-label">API Key</label>
            <div class="input-with-action">
              <input 
                :type="showApiKey ? 'text' : 'password'" 
                v-model="apiKey" 
                class="input"
                :placeholder="config.apiKey ? `已配置: ${config.apiKey}` : '输入 API Key'"
              />
              <button class="btn btn-secondary btn-sm" @click="showApiKey = !showApiKey">
                {{ showApiKey ? '隐藏' : '显示' }}
              </button>
            </div>
            <span class="input-hint">API Key 将保存到 .env 文件中，不会提交到版本控制</span>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" @click="saveAll" :disabled="saving">
            {{ saving ? '保存中...' : '保存配置' }}
          </button>
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
      saving: false,
      testResult: null,
      showApiKey: false,
      apiKey: '',
      toast: {
        show: false,
        message: '',
        type: 'success'
      }
    };
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
    async saveApiKey() {
      if (!this.apiKey) return;
      try {
        await axios.post('/api/ai/save-key', { apiKey: this.apiKey });
        this.config.hasApiKey = true;
      } catch (err) {
        console.error('保存 API Key 失败:', err);
      }
    },
    async saveAll() {
      this.saving = true;
      try {
        // 保存 API Key
        if (this.apiKey) {
          await this.saveApiKey();
        }
        this.showToast('配置已保存', 'success');
      } catch (err) {
        this.showToast('保存失败: ' + err.message, 'error');
      } finally {
        this.saving = false;
      }
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
  box-shadow: 0 0 20px var(--accent-primary)22;
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
  background: var(--accent-primary)11;
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

/* Form */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.full-width {
  grid-column: 1 / -1;
}

.input-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.input-with-action {
  display: flex;
  gap: 8px;
}

.input-with-action .input {
  flex: 1;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
  white-space: nowrap;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .status-card {
    flex-direction: column;
    text-align: center;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
