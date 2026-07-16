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
      <div v-if="docQuality" class="card quality-card">
        <div class="quality-row">
          <span :class="['quality-badge', qualityClass(docQuality.overall)]">
            {{ qualityLabel(docQuality.overall) }}
          </span>
          <span class="quality-score">综合分 {{ docQuality.score }}</span>
          <span class="quality-meta"
            >完整度 {{ docQuality.summary?.completeness ?? 0 }} · 新鲜度 {{ docQuality.summary?.freshness ?? 0 }} · 风险
            {{ docQuality.summary?.risk ?? 100 }}</span
          >
        </div>
        <ul v-if="docQualityIssues.length" class="quality-issue-list">
          <li v-for="(d, idx) in docQualityIssues" :key="idx">
            <strong>{{ d.name }}</strong>
            <span :class="['quality-tag', qualityClass(d.level)]">{{ d.level }}</span>
            <span v-if="d.completeness?.missing?.length" class="quality-detail"
              >缺失：{{ d.completeness.missing.join(', ') }}</span
            >
            <span v-for="r in d.risks || []" :key="r.type" class="quality-detail">{{ r.message }}</span>
          </li>
        </ul>
      </div>

      <div v-if="documents.length" class="card">
        <table class="status-table">
          <thead>
            <tr>
              <th class="col-file">文件名</th>
              <th class="col-size">大小</th>
              <th class="col-time">最后更新</th>
              <th class="col-health">状态</th>
              <th class="col-actions">操作</th>
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
              <td class="col-actions">
                <button class="btn btn-secondary btn-sm" @click="viewDoc(doc)" :disabled="!doc.exists">查看内容</button>
                <button class="btn btn-secondary btn-sm" @click="triggerUpdate(doc)" :disabled="updating">
                  {{ updatingDoc === doc.name ? '更新中...' : '触发更新' }}
                </button>
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
        <div class="term-line" style="padding-left: 2rem; color: var(--text-muted)">运行以上命令生成文档</div>
        <div class="term-border-bottom">└──────────────────────────────────────────┘</div>
      </div>
    </div>

    <div v-if="viewer.show" class="modal-backdrop" @click.self="closeViewer">
      <div class="modal-card card">
        <div class="card-header">
          <h2 class="card-title">{{ viewer.name }}</h2>
          <button class="icon-btn" @click="closeViewer" aria-label="关闭">×</button>
        </div>
        <pre class="doc-source">{{ viewer.content }}</pre>
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
      documents: [],
      docQuality: null,
      loading: true,
      updating: false,
      updatingDoc: '',
      viewer: { show: false, name: '', content: '' },
      toast: { show: false, message: '', type: 'success' }
    };
  },
  computed: {
    docQualityIssues() {
      if (!this.docQuality) return [];
      return (this.docQuality.perDoc || []).filter(d => d.level !== 'OK');
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
        this.documents = res.data.documents || [];
        this.docQuality = res.data.docQuality || null;
      } catch (err) {
        this.showToast('加载失败: ' + err.message, 'error');
      } finally {
        this.loading = false;
      }
    },
    async viewDoc(doc) {
      try {
        const res = await axios.get(`/api/docs/${encodeURIComponent(doc.name)}`);
        this.viewer = { show: true, name: res.data.name, content: res.data.content };
      } catch (err) {
        this.showToast('读取失败: ' + err.message, 'error');
      }
    },
    closeViewer() {
      this.viewer.show = false;
    },
    async triggerUpdate(doc) {
      this.updating = true;
      this.updatingDoc = doc.name;
      try {
        await axios.post('/api/update', { docName: doc.name });
        this.showToast('已触发更新', 'success');
        await this.loadStatus();
      } catch (err) {
        this.showToast('更新失败: ' + err.message, 'error');
      } finally {
        this.updating = false;
        this.updatingDoc = '';
      }
    },
    showToast(message, type = 'success') {
      this.toast = { show: true, message, type };
      setTimeout(() => {
        this.toast.show = false;
      }, 3000);
    },
    formatSize(bytes) {
      if (!bytes) return '0 B';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },
    formatDate(dateStr) {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
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
    },
    qualityClass(level) {
      if (level === 'OK') return 'health-ok';
      if (level === 'WARN') return 'health-stale';
      return 'health-missing';
    },
    qualityLabel(level) {
      if (level === 'OK') return '✅ OK';
      if (level === 'WARN') return '⚠️ WARN';
      return '❌ HIGH_RISK';
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

.col-health {
  text-align: right;
}

.col-actions {
  text-align: right;
  white-space: nowrap;
}

.col-actions .btn + .btn {
  margin-left: 8px;
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

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay);
  padding: 24px;
}

.modal-card {
  width: min(900px, 100%);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.quality-card {
  margin-bottom: 12px;
  padding: 12px 16px;
}

.quality-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.quality-badge {
  padding: 3px 10px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
}

.quality-score {
  font-family: var(--font-mono);
  color: var(--text-primary);
  font-size: 13px;
}

.quality-meta {
  font-family: var(--font-mono);
  color: var(--text-muted);
  font-size: 12px;
}

.quality-issue-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
}

.quality-issue-list li {
  padding: 6px 0;
  border-top: 1px dashed var(--border);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.quality-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 2px;
}

.quality-detail {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.doc-source {
  flex: 1;
  overflow: auto;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--code-bg);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
