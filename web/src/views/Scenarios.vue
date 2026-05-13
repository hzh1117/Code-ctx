<template>
  <div class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">场景模板</h1>
        <p class="page-desc">查看和管理开发场景的 prompt 模板</p>
      </div>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else>
      <div v-if="scenarios.length" class="scenarios-layout">
        <div class="scenario-list">
          <button
            v-for="s in scenarios"
            :key="s.id"
            :class="['scenario-tab', { active: selected?.id === s.id }]"
            @click="selected = s"
          >
            <span class="tab-id">{{ s.id }}</span>
            <span class="tab-name">{{ s.name }}</span>
          </button>
        </div>

        <div class="scenario-detail card" v-if="selected">
          <div class="card-header">
            <h2 class="card-title">
              <span class="detail-id">{{ selected.id }}</span>
              {{ selected.name }}
            </h2>
            <button class="btn btn-secondary btn-sm" @click="copyTemplate">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              复制
            </button>
          </div>
          <p class="detail-desc" v-if="selected.description">{{ selected.description }}</p>
          <div class="detail-projects" v-if="selected.relatedProjects?.length">
            <span v-for="p in selected.relatedProjects" :key="p" class="badge badge-neutral">{{ p }}</span>
          </div>
          <div class="code-block">{{ selected.template }}</div>
        </div>
      </div>

      <div v-else class="empty-terminal">
        <div class="term-border-top">┌─ 未加载到场景模板 ─────────────────────────┐</div>
        <div class="term-line">
          <span class="term-prompt">$</span>
          <span class="term-cmd">ls templates/scenarios/</span>
        </div>
        <div class="term-line" style="padding-left: 2rem; color: var(--text-muted);">
          请确认 templates 目录下存在场景文件
        </div>
        <div class="term-border-bottom">└──────────────────────────────────────────┘</div>
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
    return { scenarios: [], selected: null, loading: true, toast: { show: false, message: '', type: 'success' } };
  },
  async mounted() {
    try {
      const res = await axios.get('/api/scenarios');
      this.scenarios = res.data;
      if (this.scenarios.length) this.selected = this.scenarios[0];
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      this.loading = false;
    }
  },
  methods: {
    async copyTemplate() {
      try {
        await navigator.clipboard.writeText(this.selected.template);
        this.toast = { show: true, message: '已复制', type: 'success' };
        setTimeout(() => { this.toast.show = false; }, 3000);
      } catch {
        this.toast = { show: true, message: '复制失败', type: 'error' };
        setTimeout(() => { this.toast.show = false; }, 3000);
      }
    }
  }
};
</script>

<style scoped>
.scenarios-layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 16px;
  align-items: flex-start;
}

.scenario-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 0;
}

.scenario-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  text-align: left;
  transition: background 80ms, color 80ms;
  position: relative;
}

.scenario-tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.scenario-tab.active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.scenario-tab.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--accent);
  border-radius: 1px;
}

.tab-id {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  min-width: 18px;
}

.tab-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-detail {
  min-height: 0;
}

.detail-id {
  font-family: var(--font-mono);
  color: var(--accent);
  margin-right: 4px;
}

.detail-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.detail-projects {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.code-block {
  max-height: 400px;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .scenarios-layout {
    grid-template-columns: 1fr;
  }
  .scenario-list {
    flex-direction: row;
    flex-wrap: wrap;
    position: static;
  }
}
</style>
