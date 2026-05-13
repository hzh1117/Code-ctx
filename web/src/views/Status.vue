<template>
  <div class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">文档状态</h1>
        <p class="page-desc">查看 ai-docs 中各文档的状态</p>
      </div>
    </header>
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else class="status-content">
      <div v-if="documents.length" class="docs-list">
        <div v-for="doc in documents" :key="doc.name" class="doc-item card">
          <div class="doc-name">{{ doc.name }}</div>
          <div class="doc-meta">
            <span class="doc-size">{{ formatSize(doc.size) }}</span>
            <span class="doc-time">{{ formatDate(doc.lastModified) }}</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <h3>暂无文档</h3>
        <p>运行 <code>code-ctx init</code> 生成文档</p>
      </div>
    </div>
  </div>
</template>
<script>
import axios from 'axios';
export default {
  data() { return { documents: [], loading: true }; },
  async mounted() {
    try {
      const res = await axios.get('/api/status');
      this.documents = res.data.documents || [];
    } catch (err) { console.error('加载失败:', err); }
    finally { this.loading = false; }
  },
  methods: {
    formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },
    formatDate(dateStr) { return new Date(dateStr).toLocaleString('zh-CN'); }
  }
};
</script>
<style scoped>
.page { max-width: 900px; animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.page-header { margin-bottom: 32px; }
.page-title { font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
.page-desc { font-size: 14px; color: var(--text-muted); }
.docs-list { display: flex; flex-direction: column; gap: 12px; }
.doc-item { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; }
.doc-name { font-family: var(--font-mono); font-size: 14px; font-weight: 500; color: var(--text-primary); }
.doc-meta { display: flex; gap: 16px; font-size: 13px; color: var(--text-muted); }
code { font-family: var(--font-mono); background: var(--bg-card); padding: 2px 6px; border-radius: 4px; font-size: 12px; color: var(--accent-primary); }
</style>
