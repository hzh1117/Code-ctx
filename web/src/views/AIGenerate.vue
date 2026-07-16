<template>
  <div class="page page-generate">
    <header class="page-header">
      <div>
        <h1 class="page-title">AI 生成</h1>
        <p class="page-desc">使用 AI 生成项目文档</p>
      </div>
    </header>

    <div class="generate-layout">
      <div class="input-col">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              生成配置
            </h2>
          </div>
          <div class="form-stack">
            <div class="input-group">
              <label class="input-label">scenario</label>
              <select v-model="selectedScenario" class="input">
                <option v-for="s in scenarios" :key="s.id" :value="s.id">{{ s.id }} - {{ s.name }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">task <span class="required">*</span></label>
              <textarea
                v-model="taskDescription"
                class="input textarea"
                placeholder="描述你要开发的功能..."
                rows="5"
              ></textarea>
            </div>
            <button class="btn btn-primary btn-generate" @click="generate" :disabled="generating || !taskDescription">
              <span v-if="generating" class="btn-spinner"></span>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              {{ generating ? '生成中...' : '生成 Prompt' }}
            </button>
          </div>
        </div>

        <div v-if="generatedPrompt" class="card prompt-card">
          <div class="card-header">
            <h2 class="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Generated Prompt
            </h2>
            <button class="btn btn-secondary btn-sm" @click="copyPrompt">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              复制
            </button>
          </div>
          <div v-if="tokenBudget" class="token-budget" :class="tokenBudgetClass">
            token 估算 ~{{ tokenBudget.estimate }}
            <template v-if="tokenBudget.maxTokens"> / {{ tokenBudget.maxTokens }}</template>
            <template v-if="tokenBudget.status === 'over'">（超出预算，可能被截断）</template>
            <template v-else-if="tokenBudget.status === 'warn'">（接近上限）</template>
          </div>
          <div class="code-block prompt-block">{{ generatedPrompt }}</div>
        </div>
      </div>

      <div class="output-col">
        <div class="card output-card">
          <div class="card-header">
            <h2 class="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              AI 响应
            </h2>
            <div class="response-meta">
              <span v-if="aiResponse" class="badge badge-success">done</span>
              <span v-if="responseError" class="badge badge-danger">error</span>
              <button class="btn btn-secondary btn-sm" @click="copyPrompt" :disabled="!generatedPrompt">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                复制 Prompt
              </button>
              <button class="btn btn-secondary btn-sm" @click="exportPrompt" :disabled="!generatedPrompt">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                导出 .md
              </button>
              <button class="btn btn-secondary btn-sm" @click="copyResponse" :disabled="!aiResponse">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                复制响应
              </button>
            </div>
          </div>

          <div v-if="aiResponse" class="response-body">
            <pre class="response-text">{{ aiResponse }}</pre>
          </div>

          <div v-else-if="responseError" class="response-body response-error">
            <pre class="response-text">{{ responseError }}</pre>
          </div>

          <div v-else-if="generating" class="response-loading">
            <div class="loading-dots"><span></span><span></span><span></span></div>
            <span class="mono-dim">processing...</span>
          </div>

          <div v-else class="response-empty">
            <div class="term-prompt-line">
              <span class="term-prompt">&gt;</span>
              <span class="term-placeholder">等待任务输入...</span>
              <span class="cursor-blink"></span>
            </div>
          </div>
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
      scenarios: [],
      selectedScenario: 'A',
      taskDescription: '',
      generatedPrompt: '',
      tokenBudget: null,
      aiResponse: '',
      responseError: '',
      generating: false,
      toast: { show: false, message: '', type: 'success' }
    };
  },
  computed: {
    tokenBudgetClass() {
      const status = this.tokenBudget?.status;
      if (status === 'over') return 'token-over';
      if (status === 'warn') return 'token-warn';
      return 'token-ok';
    }
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
      this.responseError = '';
      try {
        const promptRes = await axios.post('/api/generate-prompt', {
          scenario: this.selectedScenario,
          task: this.taskDescription
        });
        this.generatedPrompt = promptRes.data.prompt;
        this.tokenBudget = promptRes.data.tokenBudget || null;
        const aiRes = await axios.post('/api/ai/generate', { prompt: this.generatedPrompt });
        if (aiRes.data.success) {
          this.aiResponse = aiRes.data.content;
          this.showToast('生成完成', 'success');
        } else {
          this.responseError = 'AI 调用失败: ' + (aiRes.data.error || '未知错误');
          this.showToast(this.responseError, 'error');
        }
      } catch (err) {
        this.responseError = '生成失败: ' + err.message;
        this.showToast(this.responseError, 'error');
      } finally {
        this.generating = false;
      }
    },
    async copyPrompt() {
      try {
        await navigator.clipboard.writeText(this.generatedPrompt);
        this.showToast('已复制', 'success');
      } catch {
        this.showToast('复制失败', 'error');
      }
    },
    async copyResponse() {
      try {
        await navigator.clipboard.writeText(this.aiResponse);
        this.showToast('已复制', 'success');
      } catch {
        this.showToast('复制失败', 'error');
      }
    },
    exportPrompt() {
      if (!this.generatedPrompt) return;
      const blob = new Blob([this.generatedPrompt], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prompt-${Date.now()}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      this.showToast('已导出', 'success');
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
.page-generate {
  height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
}

.generate-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 24px;
  flex: 1;
  min-height: 0;
}

.input-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.output-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.output-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

.token-budget {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 3px;
  margin-bottom: 8px;
  display: inline-block;
}
.token-ok {
  color: var(--text-secondary);
  background: var(--bg-hover);
  border: 1px solid var(--border);
}
.token-warn {
  color: var(--warning);
  background: var(--warning-dim);
  border: 1px solid var(--warning-border);
}
.token-over {
  color: var(--danger);
  background: var(--danger-dim);
  border: 1px solid var(--danger-border);
}

.prompt-card {
  flex-shrink: 0;
}

.prompt-block {
  max-height: 200px;
  overflow-y: auto;
}

.btn-generate {
  width: 100%;
  padding: 10px;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--accent-dim);
  border-top-color: var(--accent-text);
  border-radius: 50%;
  animation: spin 600ms linear infinite;
  display: inline-block;
}

.response-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.response-body {
  flex: 1;
  overflow-y: auto;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 14px;
}

.response-text {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.response-error {
  border-color: var(--danger-border);
  background: var(--danger-dim);
}

.response-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  animation: dotPulse 1.2s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.15s;
}
.loading-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes dotPulse {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

.mono-dim {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}

.response-empty {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 20px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.term-prompt-line {
  display: flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 13px;
}

.term-prompt {
  color: var(--accent);
  margin-right: 8px;
}

.term-placeholder {
  color: var(--text-muted);
}

.textarea {
  min-height: 100px;
  resize: vertical;
}

.required {
  color: var(--danger);
}

@media (max-width: 768px) {
  .page-generate {
    height: auto;
  }
  .generate-layout {
    grid-template-columns: 1fr;
    height: auto;
  }
}
</style>
