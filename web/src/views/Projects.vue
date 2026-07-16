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
          <div class="project-meta">
            <span :class="['state-dot', project.initialized ? 'state-ok' : 'state-muted']"></span>
            <span>{{ project.initialized ? '已初始化' : '未初始化' }}</span>
            <span class="meta-separator"></span>
            <span :class="['state-dot', project.docFile ? 'state-ok' : 'state-muted']"></span>
            <span>{{ project.docFile ? '文档已生成' : '暂无文档' }}</span>
          </div>
        </div>
      </div>

      <div v-else class="empty-terminal">
        <div class="term-border-top">┌─ 未检测到子项目 ───────────────────────────┐</div>
        <div class="term-line">
          <span class="term-prompt">$</span>
          <span class="term-cmd">code-ctx init</span>
        </div>
        <div class="term-line" style="padding-left: 2rem; color: var(--text-muted)">运行以上命令初始化项目结构</div>
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
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
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
  flex-wrap: wrap;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.state-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.state-ok {
  background: var(--success);
}

.state-muted {
  background: var(--text-muted);
}

.meta-separator {
  width: 1px;
  height: 12px;
  background: var(--border);
  margin: 0 4px;
}
</style>
