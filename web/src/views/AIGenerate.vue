<template>
  <div class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">AI 生成</h1>
        <p class="page-desc">使用 AI 生成项目文档</p>
      </div>
    </header>

    <div class="generate-layout">
      <!-- Input Section -->
      <div class="input-section">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              生成配置
            </h2>
          </div>

          <div class="form-stack">
            <div class="input-group">
              <label class="input-label">选择场景</label>
              <div class="scenario-grid">
                <div 
                  v-for="scenario in scenarios" 
                  :key="scenario.id"
                  :class="['scenario-item', selectedScenario === scenario.id ? 'active' : '']"
                  @click="selectedScenario = scenario.id"
                >
                  <div class="scenario-id">{{ scenario.id }}</div>
                  <div class="scenario-name">{{ scenario.name }}</div>
                </div>
              </div>
            </div>

            <div class="input-group">
              <label class="input-label">
                任务描述
                <span class="required">*</span>
              </label>
              <textarea 
                v-model="taskDescription" 
                class="input textarea" 
                placeholder="描述你要开发的功能，例如：新增用户登录功能，支持手机号和邮箱登录"
                rows="4"
              ></textarea>
            </div>

            <button 
              class="btn btn-primary btn-generate" 
              @click="generate" 
              :disabled="generating || !taskDescription"
            >
              <svg v-if="!generating" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <div v-else class="btn-spinner"></div>
              {{ generating ? '生成中...' : '生成 Prompt' }}
            </button>
          </div>
        </div>

        <!-- Generated Prompt -->
        <transition name="slide-fade">
          <div v-if="generatedPrompt" class="card">
            <div class="card-header">
              <h2 class="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                生成的 Prompt
              </h2>
              <button class="btn btn-secondary btn-sm" @click="copyPrompt">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                复制
              </button>
            </div>
            <div class="prompt-content">
              <pre>{{ generatedPrompt }}</pre>
            </div>
          </div>
        </transition>
      </div>

      <!-- Output Section -->
      <div class="output-section">
        <div class="card card-output">
          <div class="card-header">
            <h2 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              AI 响应
            </h2>
            <span v-if="aiResponse" class="badge badge-success">已完成</span>
          </div>

          <div v-if="aiResponse" class="response-content">
            <div class="response-text">{{ aiResponse }}</div>
          </div>

          <div v-else-if="generating" class="response-loading">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>AI 正在思考中...</p>
          </div>

          <div v-else class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h3>等待生成</h3>
            <p>配置场景和任务描述后，点击生成按钮</p>
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
      scenarios: [],
      selectedScenario: 'A',
      taskDescription: '',
      generatedPrompt: '',
      aiResponse: '',
      generating: false,
      toast: {
        show: false,
        message: '',
        type: 'success'
      }
    };
  },
  async mounted() {
    await this.loadScenarios();
  },
  methods: {
    async loadScenarios() {
      try {
        const res = await axios.get('/api/scenarios');
        this.scenarios = res.data;
      } catch (err) {
        // 使用默认场景
        this.scenarios = [
          { id: 'A', name: '新增功能' },
          { id: 'B', name: '后台功能' },
          { id: 'C', name: '平台功能' },
          { id: 'D', name: '数据模型' },
          { id: 'E', name: '修改功能' },
          { id: 'F', name: '排查 Bug' },
          { id: 'G', name: '后端改动' },
          { id: 'H', name: '跨端功能' }
        ];
      }
    },
    async generate() {
      if (!this.taskDescription) {
        this.showToast('请输入任务描述', 'error');
        return;
      }

      this.generating = true;
      this.generatedPrompt = '';
      this.aiResponse = '';

      try {
        // 生成 prompt
        const promptRes = await axios.post('/api/generate-prompt', {
          scenario: this.selectedScenario,
          task: this.taskDescription
        });
        this.generatedPrompt = promptRes.data.prompt;

        // 调用 AI
        const aiRes = await axios.post('/api/ai/generate', {
          prompt: this.generatedPrompt
        });

        if (aiRes.data.success) {
          this.aiResponse = aiRes.data.content;
          this.showToast('生成完成', 'success');
        } else {
          this.showToast('AI 调用失败: ' + aiRes.data.error, 'error');
        }
      } catch (err) {
        this.showToast('生成失败: ' + err.message, 'error');
      } finally {
        this.generating = false;
      }
    },
    copyPrompt() {
      navigator.clipboard.writeText(this.generatedPrompt);
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
  height: calc(100vh - 64px);
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
  margin-bottom: 24px;
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

.generate-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  height: calc(100% - 80px);
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.output-section {
  display: flex;
  flex-direction: column;
}

.card {
  display: flex;
  flex-direction: column;
}

.card-output {
  flex: 1;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Scenario Grid */
.scenario-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.scenario-item {
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
  text-align: center;
}

.scenario-item:hover {
  border-color: var(--text-muted);
  transform: translateY(-1px);
}

.scenario-item.active {
  border-color: var(--accent-primary);
  background: #00F5A008;
  box-shadow: 0 0 10px #00F5A022;
}

.scenario-id {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-primary);
  margin-bottom: 4px;
}

.scenario-item.active .scenario-id {
  text-shadow: 0 0 10px var(--accent-primary);
}

.scenario-name {
  font-size: 11px;
  color: var(--text-muted);
}

/* Textarea */
.textarea {
  min-height: 120px;
  resize: vertical;
  line-height: 1.6;
}

/* Generate Button */
.btn-generate {
  width: 100%;
  padding: 14px;
  font-size: 15px;
  font-weight: 600;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: var(--bg-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Prompt Content */
.prompt-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
}

.prompt-content pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Response */
.response-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.response-text {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Loading */
.response-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.response-loading p {
  font-size: 14px;
  color: var(--text-muted);
}

.typing-indicator {
  display: flex;
  gap: 6px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: var(--accent-primary);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Slide Fade Transition */
.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  transform: translateY(20px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.required {
  color: var(--danger);
}
</style>
