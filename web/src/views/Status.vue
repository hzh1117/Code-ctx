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

    <div v-else>
      <div v-if="documents.length" class="card">
        <table class="status-table">
          <thead>
            <tr>
              <th class="col-file">文件名</th>
              <th class="col-size">大小</th>
              <th class="col-time">最后更新</th>
              <th class="col-health">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="doc in documents" :key="doc.name">
              <td class="col-file">
                <span class="file-name">{{ doc.name }}</span>
              </td>
              <td class="col-size mono-dim">{{ formatSize(doc.size) }}</td>
              <td class="col-time mono-dim">{{ formatDate(doc.lastModified) }}</td>
              <td class="col-health">
                <span :class="['health-badge', healthClass(doc)]">
                  <span class="health-icon">{{ healthIcon(doc) }}</span>
                  {{ healthLabel(doc) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-terminal">
        <div class="term-border-top">┌─ 暂无文档记录 ─────────────────────────────┐</div>
        <div class="term-line">
          <span class="term-prompt">$</span>
          <span class="term-cmd">code-ctx init</span>
        </div>
        <div class="term-line" style="padding-left: 2rem; color: var(--text-muted);">
          运行以上命令生成文档
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
    return { documents: [], loading: true };
  },
  async mounted() {
    try {
      const res = await axios.get('/api/status');
      this.documents = res.data.documents || [];
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      this.loading = false;
    }
  },
  methods: {
    formatSize(bytes) {
      if (!bytes) return '0 B';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },
    formatDate(dateStr) {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    },
    healthClass(doc) {
      if (!doc.exists) return 'health-missing';
      if (doc.stale) return 'health-stale';
      return 'health-ok';
    },
    healthIcon(doc) {
      if (!doc.exists) return '\u2715';
      if (doc.stale) return '\u26A0';
      return '\u2713';
    },
    healthLabel(doc) {
      if (!doc.exists) return '缺失';
      if (doc.stale) return '待更新';
      return '正常';
    }
  }
};
</script>

<style scoped>
.status-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.status-table th {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  text-transform: lowercase;
}

.status-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.status-table tr:last-child td {
  border-bottom: none;
}

.status-table tr:hover td {
  background: var(--bg-hover);
}

.col-file {
  min-width: 160px;
}

.col-size {
  width: 80px;
}

.col-time {
  width: 140px;
}

.col-health {
  width: 100px;
  text-align: right;
}

.file-name {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-primary);
}

.mono-dim {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.health-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 500;
}

.health-ok {
  background: var(--success-dim);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.health-stale {
  background: var(--warning-dim);
  color: var(--warning);
  border: 1px solid var(--warning-border);
}

.health-missing {
  background: var(--danger-dim);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}

.health-icon {
  font-size: 12px;
}
</style>
