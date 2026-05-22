<template>
  <div class="page dashboard-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-desc">项目文档状态与常用操作</p>
      </div>
      <button class="btn btn-secondary" @click="loadStatus" :disabled="loading">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>
        刷新
      </button>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <span>加载状态中...</span>
    </div>

    <div v-else class="dashboard-grid">
      <section class="metrics-grid">
        <div class="metric-card card">
          <span class="metric-label">文档数量</span>
          <strong class="metric-value">{{ status.docCount || 0 }}</strong>
          <span class="metric-note">ai-docs markdown</span>
        </div>
        <div class="metric-card card">
          <span class="metric-label">最后扫描时间</span>
          <strong class="metric-value metric-time">{{ formatDate(status.lastScanTime) }}</strong>
          <span class="metric-note">.last-scan.json</span>
        </div>
        <div class="metric-card card">
          <span class="metric-label">健康状态</span>
          <strong :class="['metric-value', healthClass]">{{ status.healthStatus || '未初始化' }}</strong>
          <span class="metric-note">{{ healthNote }}</span>
        </div>
        <div class="metric-card card">
          <span class="metric-label">任务历史数</span>
          <strong class="metric-value">{{ status.historyCount || 0 }}</strong>
          <span class="metric-note">recent tasks</span>
        </div>
      </section>

      <section class="dashboard-main">
        <div class="card action-card">
          <div class="card-header">
            <h2 class="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              快捷操作
            </h2>
          </div>
          <div class="quick-actions">
            <button class="quick-action" @click="$router.push('/config')">
              <span class="quick-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </span>
              <span>
                <strong>初始化</strong>
                <small>检查配置和子项目</small>
              </span>
            </button>
            <button class="quick-action" @click="triggerUpdate" :disabled="updating">
              <span class="quick-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>
              </span>
              <span>
                <strong>{{ updating ? '更新中...' : '更新文档' }}</strong>
                <small>触发增量扫描</small>
              </span>
            </button>
            <button class="quick-action" @click="$router.push('/ai-generate')">
              <span class="quick-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </span>
              <span>
                <strong>生成 Prompt</strong>
                <small>进入 AI 生成页</small>
              </span>
            </button>
          </div>
        </div>

        <div class="card history-card">
          <div class="card-header">
            <h2 class="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 5-6"/></svg>
              最近任务
            </h2>
            <span class="badge badge-neutral">{{ recentHistory.length }}</span>
          </div>

          <div v-if="recentHistory.length" class="timeline">
            <div v-for="(item, index) in recentHistory" :key="item.id || index" class="timeline-item">
              <span class="timeline-dot"></span>
              <div class="timeline-body">
                <strong>{{ item.task || item.action || item.command || '任务记录' }}</strong>
                <span class="history-meta">
                  <template v-if="item.scenario">场景 {{ item.scenario }} · </template>
                  <template v-if="item.source">{{ item.source }} · </template>
                  {{ formatDate(item.timestamp) }}
                </span>
                <span v-if="item.promptPreview" class="history-preview">{{ item.promptPreview }}</span>
              </div>
            </div>
          </div>

          <div v-else class="empty-terminal">
            <div class="term-border-top">┌─ 暂无任务历史 ─────────────────────────────┐</div>
            <div class="term-line"><span class="term-prompt">$</span> <span class="term-cmd">code-ctx use "你的任务"</span></div>
            <div class="term-border-bottom">└──────────────────────────────────────────┘</div>
          </div>
        </div>
      </section>
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
      status: {},
      loading: true,
      updating: false,
      toast: { show: false, message: '', type: 'success' }
    };
  },
  computed: {
    recentHistory() {
      return this.status.recentHistory || [];
    },
    healthClass() {
      if (this.status.healthStatus === '正常') return 'metric-ok';
      if (this.status.healthStatus === '未初始化') return 'metric-muted';
      return 'metric-warn';
    },
    healthNote() {
      if (this.status.healthStatus === '正常') return 'doctor check';
      if (this.status.healthStatus === '未初始化') return '需要初始化';
      return '需要处理';
    }
  },
  async mounted() {
    await this.loadStatus();
  },
  methods: {
    async loadStatus() {
      this.loading = true;
      try {
        const res = await axios.get('/api/status');
        this.status = res.data || {};
      } catch (err) {
        this.showToast('加载失败: ' + err.message, 'error');
      } finally {
        this.loading = false;
      }
    },
    async triggerUpdate() {
      this.updating = true;
      try {
        await axios.post('/api/update');
        this.showToast('已触发更新', 'success');
        await this.loadStatus();
      } catch (err) {
        this.showToast('更新失败: ' + err.message, 'error');
      } finally {
        this.updating = false;
      }
    },
    formatDate(value) {
      if (!value) return '-';
      return new Date(value).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    showToast(message, type = 'success') {
      this.toast = { show: true, message, type };
      setTimeout(() => { this.toast.show = false; }, 3000);
    }
  }
};
</script>

<style scoped>
.dashboard-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 132px;
}

.metric-label,
.metric-note {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  text-transform: lowercase;
}

.metric-value {
  font-family: var(--font-mono);
  font-size: 28px;
  line-height: 1.1;
  color: var(--text-primary);
}

.metric-time {
  font-size: 18px;
  line-height: 1.35;
}

.metric-ok {
  color: var(--success);
}

.metric-warn {
  color: var(--warning);
}

.metric-muted {
  color: var(--text-secondary);
}

.dashboard-main {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 16px;
  align-items: stretch;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quick-action {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-base);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.quick-action:hover {
  border-color: var(--border-active);
  background: var(--bg-hover);
}

.quick-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.quick-action strong,
.quick-action small {
  display: block;
}

.quick-action small {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 12px;
}

.quick-icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--accent);
  background: var(--accent-dim);
  flex-shrink: 0;
}

.history-card {
  min-height: 260px;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 0 0 18px;
}

.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 13px;
  bottom: 0;
  width: 1px;
  background: var(--border);
}

.timeline-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--accent);
  margin-top: 4px;
  flex-shrink: 0;
}

.timeline-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.timeline-body strong {
  font-size: 13px;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.timeline-body span {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.timeline-body .history-preview {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
  margin-top: 2px;
}

@media (max-width: 1100px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dashboard-main {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
