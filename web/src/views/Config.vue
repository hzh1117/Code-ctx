<template>
  <div class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">配置管理</h1>
        <p class="page-desc">管理项目配置和输出设置</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" @click="save" :disabled="saving">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <span>加载配置中...</span>
    </div>

    <div v-else class="config-content">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            基本信息
          </h2>
        </div>

        <div class="form-grid">
          <div class="input-group">
            <label class="input-label">
              项目名称
              <span class="required">*</span>
            </label>
            <input 
              v-model="config.projectName" 
              class="input" 
              placeholder="输入项目名称"
            />
          </div>

          <div class="input-group">
            <label class="input-label">
              输出目录
              <span class="required">*</span>
            </label>
            <input 
              v-model="config.outputDir" 
              class="input" 
              placeholder="./ai-docs"
            />
          </div>

          <div class="input-group">
            <label class="input-label">AI 模式</label>
            <select v-model="config.aiMode" class="input">
              <option value="clipboard">剪贴板模式</option>
              <option value="api">API 模式</option>
            </select>
          </div>

          <div class="input-group">
            <label class="input-label">版本控制</label>
            <div class="toggle-group">
              <label class="toggle">
                <input type="checkbox" v-model="config.gitTrack" />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">{{ config.gitTrack ? '已启用' : '已禁用' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            子项目列表
          </h2>
          <span class="badge badge-success">{{ config.projects?.length || 0 }} 个项目</span>
        </div>

        <div v-if="config.projects?.length" class="projects-list">
          <div 
            v-for="(project, index) in config.projects" 
            :key="index"
            class="project-item"
          >
            <div class="project-info">
              <div class="project-alias">{{ project.alias }}</div>
              <div class="project-details">
                <span class="project-type">{{ project.type }}</span>
                <span class="project-path">{{ project.path }}</span>
              </div>
            </div>
            <div class="project-label">{{ project.label }}</div>
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

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            排除目录
          </h2>
        </div>

        <div class="tags-list">
          <span 
            v-for="dir in config.excludeDirs" 
            :key="dir" 
            class="tag"
          >
            {{ dir }}
          </span>
        </div>
      </div>
    </div>

    <transition name="fade">
      <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
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
      config: {},
      loading: true,
      saving: false,
      toast: {
        show: false,
        message: '',
        type: 'success'
      }
    };
  },
  async mounted() {
    await this.loadConfig();
  },
  methods: {
    async loadConfig() {
      try {
        const res = await axios.get('/api/config');
        this.config = res.data;
      } catch (err) {
        this.showToast('加载配置失败', 'error');
      } finally {
        this.loading = false;
      }
    },
    async save() {
      this.saving = true;
      try {
        await axios.put('/api/config', this.config);
        this.showToast('配置已保存', 'success');
      } catch (err) {
        this.showToast('保存失败: ' + err.message, 'error');
      } finally {
        this.saving = false;
      }
    },
    showToast(message, type = 'success') {
      this.toast = { show: true, message, type };
      setTimeout(() => {
        this.toast.show = false;
      }, 3000);
    }
  }
};
</script>

<style scoped>
.page {
  max-width: 900px;
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 32px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.page-desc {
  font-size: 14px;
  color: var(--text-muted);
}

.config-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: all var(--transition-normal);
}

.project-item:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px var(--accent-primary);
}

.project-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.project-alias {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  color: var(--accent-primary);
  min-width: 60px;
}

.project-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-type {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  padding: 2px 8px;
  background: var(--bg-card);
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.project-path {
  font-size: 13px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.project-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  padding: 6px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.toggle-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  transition: var(--transition-normal);
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: var(--text-muted);
  border-radius: 50%;
  transition: var(--transition-normal);
}

.toggle input:checked + .toggle-slider {
  background-color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
  background-color: var(--bg-primary);
}

.toggle-label {
  font-size: 13px;
  color: var(--text-secondary);
}

code {
  font-family: var(--font-mono);
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--accent-primary);
}
</style>
