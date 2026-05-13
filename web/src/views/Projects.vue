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
    <div v-else class="projects-content">
      <div v-if="projects.length" class="projects-list">
        <div v-for="project in projects" :key="project.alias" class="project-card card">
          <div class="project-header">
            <div class="project-alias">{{ project.alias }}</div>
            <span class="badge badge-success">{{ project.type }}</span>
          </div>
          <div class="project-details">
            <p class="project-label">{{ project.label }}</p>
            <p class="project-path">{{ project.path }}</p>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <h3>暂无子项目</h3>
        <p>运行 <code>code-ctx init</code> 扫描项目结构</p>
      </div>
    </div>
  </div>
</template>
<script>
import axios from 'axios';
export default {
  data() { return { projects: [], loading: true }; },
  async mounted() {
    try {
      const res = await axios.get('/api/projects');
      this.projects = res.data;
    } catch (err) { console.error('加载失败:', err); }
    finally { this.loading = false; }
  }
};
</script>
<style scoped>
.page { max-width: 900px; animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.page-header { margin-bottom: 32px; }
.page-title { font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
.page-desc { font-size: 14px; color: var(--text-muted); }
.projects-list { display: flex; flex-direction: column; gap: 16px; }
.project-card { padding: 20px; }
.project-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.project-alias { font-family: var(--font-mono); font-size: 18px; font-weight: 600; color: var(--accent-primary); }
.project-details { display: flex; flex-direction: column; gap: 4px; }
.project-label { font-size: 14px; color: var(--text-secondary); }
.project-path { font-size: 13px; color: var(--text-muted); font-family: var(--font-mono); }
code { font-family: var(--font-mono); background: var(--bg-card); padding: 2px 6px; border-radius: 4px; font-size: 12px; color: var(--accent-primary); }
</style>
