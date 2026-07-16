<template>
  <div class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">配置管理</h1>
        <p class="page-desc">管理项目配置和输出设置</p>
      </div>
      <button class="btn btn-primary" @click="save" :disabled="saving">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        {{ saving ? '保存中...' : '保存配置' }}
      </button>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <span>加载配置中...</span>
    </div>

    <div v-else class="config-content">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            基本信息
          </h2>
        </div>
        <div class="form-grid">
          <div class="input-group">
            <label class="input-label">project_name <span class="required">*</span></label>
            <input v-model="config.projectName" class="input" placeholder="输入项目名称" />
          </div>
          <div class="input-group">
            <label class="input-label">output_dir <span class="required">*</span></label>
            <input v-model="config.outputDir" class="input" placeholder="./ai-docs" />
          </div>
          <div class="input-group">
            <label class="input-label">ai_mode</label>
            <select v-model="config.aiMode" class="input">
              <option value="clipboard">clipboard</option>
              <option value="api">api</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">git_track</label>
            <div class="toggle-group">
              <label class="toggle">
                <input type="checkbox" v-model="config.gitTrack" />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">{{ config.gitTrack ? 'enabled' : 'disabled' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            子项目列表
          </h2>
          <div class="header-actions">
            <span class="badge badge-success">{{ config.projects?.length || 0 }}</span>
            <button class="btn btn-secondary btn-sm" @click="openProjectForm()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              添加子项目
            </button>
          </div>
        </div>

        <div v-if="config.projects?.length" class="projects-grid">
          <div v-for="(project, index) in config.projects" :key="index" class="project-item">
            <div class="project-item-head">
              <span class="mono-accent">{{ project.alias }}</span>
              <span class="badge badge-neutral">{{ project.type }}</span>
            </div>
            <div class="project-path mono-dim">{{ project.path }}</div>
            <div class="project-actions">
              <button class="btn btn-secondary btn-sm" @click="openProjectForm(project, index)">编辑</button>
              <button class="btn btn-danger btn-sm" @click="removeProject(index)">删除</button>
            </div>
          </div>
        </div>

        <div v-else class="empty-terminal">
          <div class="term-border-top">┌─ 未检测到子项目 ───────────────────────────┐</div>
          <div class="term-line"><span class="term-prompt">$</span> <span class="term-cmd">code-ctx init</span></div>
          <div class="term-line" style="padding-left: 2rem; color: var(--text-muted)">扫描项目结构以添加子项目</div>
          <div class="term-border-bottom">└──────────────────────────────────────────┘</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            排除目录
          </h2>
          <span class="badge badge-success">{{ config.excludeDirs?.length || 0 }}</span>
        </div>

        <div class="tags-editor">
          <div class="tags-list" v-if="config.excludeDirs?.length">
            <span v-for="(dir, index) in config.excludeDirs" :key="index" class="tag">
              {{ dir }}
              <button class="tag-remove" @click="removeDir(index)">&times;</button>
            </span>
          </div>
          <div class="tag-input-row">
            <input
              v-model="newDir"
              @keyup.enter="addDir"
              class="input"
              placeholder="输入目录名称，回车添加"
              style="flex: 1"
            />
            <button class="btn btn-secondary btn-sm" @click="addDir" :disabled="!newDir">添加</button>
          </div>
        </div>
      </div>
    </div>

    <transition name="page-fade">
      <div v-if="toast.show" :class="['global-toast', `toast-${toast.type}`]">
        {{ toast.message }}
      </div>
    </transition>

    <div v-if="projectDialog.show" class="modal-backdrop" @click.self="closeProjectForm">
      <div class="modal-card card">
        <div class="card-header">
          <h2 class="card-title">{{ projectDialog.index === null ? '添加子项目' : '编辑子项目' }}</h2>
          <button class="icon-btn" @click="closeProjectForm" aria-label="关闭">×</button>
        </div>
        <div class="form-stack">
          <div class="input-group">
            <label class="input-label">alias <span class="required">*</span></label>
            <input v-model.trim="projectDialog.form.alias" class="input" placeholder="web" />
          </div>
          <div class="input-group">
            <label class="input-label">path <span class="required">*</span></label>
            <input v-model.trim="projectDialog.form.path" class="input" placeholder="./web" />
          </div>
          <div class="input-group">
            <label class="input-label">type <span class="required">*</span></label>
            <input v-model.trim="projectDialog.form.type" class="input" placeholder="vue3-admin" />
          </div>
          <div class="input-group">
            <label class="input-label">label</label>
            <input v-model.trim="projectDialog.form.label" class="input" placeholder="前端" />
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="closeProjectForm">取消</button>
            <button class="btn btn-primary" @click="saveProject">保存</button>
          </div>
        </div>
      </div>
    </div>
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
      newDir: '',
      projectDialog: {
        show: false,
        index: null,
        form: { alias: '', path: '', type: '', label: '' }
      },
      toast: { show: false, message: '', type: 'success' }
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
    addDir() {
      if (this.newDir && !this.config.excludeDirs?.includes(this.newDir)) {
        if (!this.config.excludeDirs) this.config.excludeDirs = [];
        this.config.excludeDirs.push(this.newDir);
        this.newDir = '';
      }
    },
    removeDir(index) {
      this.config.excludeDirs.splice(index, 1);
    },
    openProjectForm(project = null, index = null) {
      this.projectDialog = {
        show: true,
        index,
        form: project
          ? {
              alias: project.alias || '',
              path: project.path || '',
              type: project.type || '',
              label: project.label || ''
            }
          : { alias: '', path: '', type: '', label: '' }
      };
    },
    closeProjectForm() {
      this.projectDialog.show = false;
    },
    saveProject() {
      const form = { ...this.projectDialog.form };
      if (!form.alias || !form.path || !form.type) {
        this.showToast('请填写 alias/path/type', 'error');
        return;
      }
      if (!this.config.projects) this.config.projects = [];
      const nextProject = {
        alias: form.alias,
        path: form.path,
        type: form.type,
        label: form.label || form.alias
      };
      if (this.projectDialog.index === null) {
        this.config.projects.push(nextProject);
      } else {
        this.config.projects.splice(this.projectDialog.index, 1, nextProject);
      }
      this.closeProjectForm();
      this.save();
    },
    removeProject(index) {
      this.config.projects.splice(index, 1);
      this.save();
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
.config-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.project-item {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-base);
}

.project-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.project-path {
  overflow-wrap: anywhere;
  font-size: 12px;
}

.project-actions,
.header-actions,
.modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-actions {
  margin-top: 12px;
  justify-content: flex-end;
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
  width: min(520px, 100%);
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

.icon-btn:hover {
  color: var(--text-primary);
  border-color: var(--border-active);
}

.modal-actions {
  justify-content: flex-end;
}

.mono-accent {
  font-family: var(--font-mono);
  color: var(--accent);
}

.mono-dim {
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.tags-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-input-row {
  display: flex;
  gap: 8px;
}
</style>
