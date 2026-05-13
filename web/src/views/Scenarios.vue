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
    <div v-else class="scenarios-content">
      <div v-for="scenario in scenarios" :key="scenario.id" class="scenario-card card">
        <div class="scenario-header">
          <div class="scenario-id">{{ scenario.id }}</div>
          <div class="scenario-info">
            <h3 class="scenario-name">{{ scenario.name }}</h3>
            <p class="scenario-desc">{{ scenario.description }}</p>
          </div>
          <div class="scenario-projects">
            <span v-for="p in scenario.relatedProjects" :key="p" class="badge badge-success">{{ p }}</span>
          </div>
        </div>
        <div class="scenario-template">
          <pre>{{ scenario.template }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import axios from 'axios';
export default {
  data() { return { scenarios: [], loading: true }; },
  async mounted() {
    try {
      const res = await axios.get('/api/scenarios');
      this.scenarios = res.data;
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
.scenarios-content { display: flex; flex-direction: column; gap: 16px; }
.scenario-card { padding: 20px; }
.scenario-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.scenario-id { font-family: var(--font-mono); font-size: 24px; font-weight: 700; color: var(--accent-primary); min-width: 40px; }
.scenario-info { flex: 1; }
.scenario-name { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.scenario-desc { font-size: 13px; color: var(--text-muted); }
.scenario-projects { display: flex; gap: 6px; flex-wrap: wrap; }
.scenario-template { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; }
.scenario-template pre { margin: 0; font-family: var(--font-mono); font-size: 13px; line-height: 1.6; color: var(--text-secondary); white-space: pre-wrap; }
</style>
