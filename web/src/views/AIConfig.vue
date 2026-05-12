<template>
  <div class="ai-config">
    <h1>AI 配置</h1>
    
    <div class="config-section">
      <h2>当前配置</h2>
      <div v-if="loading">加载中...</div>
      <div v-else>
        <p><strong>协议：</strong>{{ config.protocol }}</p>
        <p><strong>API 地址：</strong>{{ config.baseUrl }}</p>
        <p><strong>模型：</strong>{{ config.model }}</p>
        <p><strong>API Key：</strong>{{ config.hasApiKey ? '已配置' : '未配置' }}</p>
      </div>
    </div>
    
    <div class="config-section">
      <h2>测试连接</h2>
      <button @click="testConnection" :disabled="testing">
        {{ testing ? '测试中...' : '测试连接' }}
      </button>
      <div v-if="testResult" :class="testResult.success ? 'success' : 'error'">
        {{ testResult.success ? '连接成功' : `连接失败: ${testResult.error}` }}
      </div>
    </div>
    
    <div class="config-section">
      <h2>配置说明</h2>
      <p>API Key 配置在项目根目录的 <code>.env</code> 文件中：</p>
      <pre>
# Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-xxx

# OpenAI 兼容 API Key
OPENAI_API_KEY=sk-xxx
      </pre>
      <p>其他配置在 <code>code-ctx.config.js</code> 中：</p>
      <pre>
module.exports = {
  ai: {
    protocol: 'openai',  // 'openai' | 'anthropic'
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    maxTokens: 4096
  }
}
      </pre>
    </div>
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
      testResult: null
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
        console.error('加载配置失败:', err);
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
      } catch (err) {
        this.testResult = { success: false, error: err.message };
      } finally {
        this.testing = false;
      }
    }
  }
};
</script>

<style scoped>
.ai-config {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.config-section {
  margin-bottom: 30px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.success {
  color: green;
  margin-top: 10px;
}

.error {
  color: red;
  margin-top: 10px;
}

pre {
  background: #333;
  color: #fff;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
}

code {
  background: #e0e0e0;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
