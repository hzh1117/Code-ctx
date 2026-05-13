<template>
  <div class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">子项目管理</h1>
        <p class="page-desc">查看和管理项目中检测到的子项目</p>
      </div>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else>
      <div v-if="projects.length" class="projects-grid">
        <div v-for="project in projects" :key="project.alias" class="project-card card">
          <div class="project-top">
            <span class="project-alias">{{ project.alias }}</span>
            <span class="badge badge-neutral">{{ project.type }}</span>
          </div>
          <div class="project-path">{{ project.path }}</div>
          <div class="project-label" v-if="project.label">{{ project.label }}</div>
          <div class="project-meta" v-if="project.fileCount !== undefined">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>{{ project.fileCount }} files</span>
          </div>
        </div>
      </div>

      <div v-else class="empty-terminal">
        <div class="term-border-top">┌─ 未检测到子项目 ───────────────────────────┐</div>
        <div class="term-line">
          <span class="term-prompt">$</span>
          <span class="term-cmd">code-ctx init</span>
        </div>
        <div class="term-line" style="padding-left: 2rem; color: var(--text-muted);">
          运行以上命令初始化项目结构
        </div>
        <div class="term-border-bottom">└──────────────────────────────────────────┘</div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return { projects: [], loading: true };
  },
  async mounted() {
    try {
      const res = await axios.get('/api/projects');
      this.projects = res.data;
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      this.loading = false;
    }
  }
};
</script>

<style scoped>
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.project-card {
  padding: 16px;
  transition: border-color 80ms;
}

.project-card:hover {
  border-color: var(--border-active);
}

.project-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.project-alias {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  color: var(--accent);
}

.project-path {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  word-break: break-all;
}

.project-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
</style>
