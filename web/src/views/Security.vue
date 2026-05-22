<template>
  <div class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">安全与健康</h1>
        <p class="page-desc">汇总 doctor 报告、文档质量、敏感信息扫描、配置 schema 与插件加载状态</p>
      </div>
      <div>
        <button class="btn btn-secondary" @click="load" :disabled="loading">
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
      </div>
    </header>

    <div v-if="loading && !report" class="loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else-if="error" class="card">
      <div class="quality-row">
        <span class="quality-badge health-missing">加载失败</span>
        <span>{{ error }}</span>
      </div>
    </div>

    <div v-else-if="report">
      <div class="card overview-card">
        <div class="overview-row">
          <span :class="['quality-badge', levelClass(report.overall)]">{{ levelLabel(report.overall) }}</span>
          <span class="overview-text">整体安全/健康状态</span>
          <span class="overview-meta">
            issues {{ report.issues.length }} · warnings {{ report.warnings.length }} ·
            sensitive {{ report.sensitive.length }} · schema {{ report.schemaErrors.length }}
          </span>
        </div>
      </div>

      <div class="card section-card" v-if="report.issues.length">
        <h2 class="card-title">问题（需修复）</h2>
        <ul class="finding-list">
          <li v-for="(it, idx) in report.issues" :key="'i'+idx" class="finding finding-bad">
            <span class="finding-type">{{ it.type || 'issue' }}</span>
            <span class="finding-msg">{{ it.message }}</span>
          </li>
        </ul>
      </div>

      <div class="card section-card" v-if="report.warnings.length">
        <h2 class="card-title">警告</h2>
        <ul class="finding-list">
          <li v-for="(it, idx) in report.warnings" :key="'w'+idx" class="finding finding-warn">
            <span class="finding-type">{{ it.type || 'warning' }}</span>
            <span class="finding-msg">{{ it.message }}</span>
          </li>
        </ul>
      </div>

      <div class="card section-card" v-if="report.sensitive.length">
        <h2 class="card-title">敏感信息扫描</h2>
        <ul class="finding-list">
          <li v-for="(s, idx) in report.sensitive" :key="'s'+idx" class="finding finding-bad">
            <span class="finding-type">{{ s.field }}</span>
            <span class="finding-msg">{{ s.file }}</span>
          </li>
        </ul>
        <p class="card-hint">仅显示字段名与文件名；不展示原文。</p>
      </div>

      <div class="card section-card" v-if="report.docQuality">
        <h2 class="card-title">文档质量明细</h2>
        <div class="overview-row" style="margin-bottom: 8px;">
          <span :class="['quality-badge', levelClass(report.docQuality.overall)]">{{ levelLabel(report.docQuality.overall) }}</span>
          <span class="overview-text">综合分 {{ report.docQuality.score }}</span>
          <span class="overview-meta">
            完整度 {{ report.docQuality.summary?.completeness ?? 0 }} ·
            新鲜度 {{ report.docQuality.summary?.freshness ?? 0 }} ·
            风险 {{ report.docQuality.summary?.risk ?? 100 }}
          </span>
        </div>
        <table class="finding-table" v-if="report.docQuality.perDoc?.length">
          <thead>
            <tr>
              <th>文档</th>
              <th>等级</th>
              <th>分数</th>
              <th>缺失 section</th>
              <th>风险</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in report.docQuality.perDoc" :key="d.name">
              <td class="mono">{{ d.name }}</td>
              <td><span :class="['quality-tag', levelClass(d.level)]">{{ d.level }}</span></td>
              <td class="mono-dim">{{ d.score }}</td>
              <td class="mono-dim">{{ (d.completeness?.missing || []).join(', ') || '-' }}</td>
              <td class="mono-dim">{{ (d.risks || []).map(r => r.type).join(', ') || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card section-card" v-if="report.schemaErrors.length">
        <h2 class="card-title">配置 Schema 警告</h2>
        <ul class="finding-list">
          <li v-for="(e, idx) in report.schemaErrors" :key="'sc'+idx" class="finding finding-warn">
            <span class="finding-msg">{{ e }}</span>
          </li>
        </ul>
      </div>

      <div class="card section-card" v-if="report.plugins?.errors?.length">
        <h2 class="card-title">插件加载错误</h2>
        <ul class="finding-list">
          <li v-for="(e, idx) in report.plugins.errors" :key="'pe'+idx" class="finding finding-warn">
            <span class="finding-type">{{ e.plugin }}</span>
            <span class="finding-msg">{{ e.error }}</span>
          </li>
        </ul>
      </div>

      <div class="card section-card" v-if="report.plugins?.loaded?.length">
        <h2 class="card-title">已加载插件</h2>
        <ul class="finding-list">
          <li v-for="(p, idx) in report.plugins.loaded" :key="'pl'+idx" class="finding finding-ok">
            <span class="finding-type">{{ p.name }}</span>
            <span class="finding-msg">adapters: {{ p.adapterCount }} · scenarios: {{ p.scenarioCount }}</span>
          </li>
        </ul>
      </div>

      <div v-if="isAllClear" class="card section-card">
        <p class="card-hint">未发现任何 issue、warning、敏感信息或 schema 错误。✅</p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      report: null,
      loading: true,
      error: null
    };
  },
  computed: {
    isAllClear() {
      const r = this.report;
      if (!r) return false;
      return r.issues.length === 0
        && r.warnings.length === 0
        && r.sensitive.length === 0
        && r.schemaErrors.length === 0
        && (!r.plugins?.errors || r.plugins.errors.length === 0);
    }
  },
  async mounted() {
    await this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      this.error = null;
      try {
        const res = await axios.get('/api/doctor');
        this.report = res.data;
      } catch (err) {
        this.error = err.response?.data?.error || err.message;
      } finally {
        this.loading = false;
      }
    },
    levelClass(level) {
      if (level === 'OK') return 'health-ok';
      if (level === 'WARN') return 'health-stale';
      return 'health-missing';
    },
    levelLabel(level) {
      if (level === 'OK') return '✅ OK';
      if (level === 'WARN') return '⚠️ WARN';
      return '❌ HIGH_RISK';
    }
  }
};
</script>

<style scoped>
.overview-card {
  margin-bottom: 12px;
}
.overview-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.overview-text {
  font-family: var(--font-sans);
  color: var(--text-primary);
  font-size: 14px;
}
.overview-meta {
  font-family: var(--font-mono);
  color: var(--text-muted);
  font-size: 12px;
}
.section-card {
  margin-bottom: 12px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}
.card-hint {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  margin-top: 8px;
}
.finding-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
}
.finding {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px dashed var(--border);
  align-items: center;
  flex-wrap: wrap;
}
.finding:first-child { border-top: none; }
.finding-type {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--bg-hover);
  color: var(--text-secondary);
}
.finding-msg {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
}
.finding-bad .finding-type {
  background: var(--danger-dim);
  color: var(--danger);
}
.finding-warn .finding-type {
  background: var(--warning-dim);
  color: var(--warning);
}
.finding-ok .finding-type {
  background: var(--success-dim);
  color: var(--success);
}
.finding-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.finding-table th {
  text-align: left;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
}
.finding-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
}
.mono-dim {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}
.quality-badge {
  padding: 3px 10px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
}
.quality-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 2px;
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
</style>
