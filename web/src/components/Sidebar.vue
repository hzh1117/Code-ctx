<template>
  <aside class="sidebar" :class="{ 'sidebar-open': open }">
    <div class="sidebar-logo">
      <div class="logo-mark">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="1" y="1" width="26" height="26" rx="4" stroke="var(--accent)" stroke-width="1.5" fill="none" />
          <path
            d="M7 10L14 7L21 10V18L14 21L7 18V10Z"
            stroke="var(--accent)"
            stroke-width="1.2"
            fill="var(--accent-dim)"
          />
          <circle cx="14" cy="14" r="2.5" fill="var(--accent)" />
        </svg>
      </div>
      <div class="logo-text">
        <span class="logo-name">CodeCtx</span>
        <span class="logo-tag">AI CONTEXT TOOL</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :exact="item.exact"
        class="nav-item"
        active-class="active"
        @click="$emit('navigate')"
      >
        <span class="nav-icon" v-html="item.icon"></span>
        <span class="nav-label">{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <div class="theme-row">
        <button class="theme-btn" @click="toggle" :title="theme === 'dark' ? '切换浅色' : '切换深色'">
          <svg
            v-if="theme === 'dark'"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <span class="theme-label">{{ theme === 'dark' ? '浅色模式' : '深色模式' }}</span>
        </button>
      </div>
      <div class="status-indicator">
        <span class="status-dot"></span>
        <span class="status-text">System Ready</span>
      </div>
    </div>
  </aside>
</template>

<script>
import { useTheme } from '../composables/useTheme.js';

export default {
  props: {
    open: { type: Boolean, default: false }
  },
  emits: ['navigate'],
  setup() {
    const { theme, toggle } = useTheme();
    return { theme, toggle };
  },
  data() {
    return {
      navItems: [
        {
          path: '/',
          label: '首页',
          exact: true,
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>'
        },
        {
          path: '/config',
          label: '配置管理',
          exact: false,
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82.88V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.09 15 1.65 1.65 0 0 0 1.58 14H1.5a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 3.1 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10.5 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
        },
        {
          path: '/ai',
          label: 'AI 配置',
          exact: false,
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'
        },
        {
          path: '/ai-generate',
          label: 'AI 生成',
          exact: false,
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
        },
        {
          path: '/projects',
          label: '子项目',
          exact: false,
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
        },
        {
          path: '/scenarios',
          label: '场景模板',
          exact: false,
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>'
        },
        {
          path: '/status',
          label: '文档状态',
          exact: false,
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
        },
        {
          path: '/security',
          label: '安全与健康',
          exact: false,
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
        }
      ]
    };
  }
};
</script>

<style scoped>
.sidebar {
  width: 200px;
  min-width: 200px;
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  border-right: 1px solid var(--border);
  transition:
    background-color 120ms,
    border-color 120ms;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 16px;
}

.logo-mark {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.logo-name {
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.3px;
  line-height: 1.1;
}

.logo-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 400;
  color: var(--text-muted);
  letter-spacing: 1.2px;
  text-transform: uppercase;
  margin-top: 2px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  padding: 8px 8px 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 400;
  transition:
    background 80ms,
    color 80ms;
  position: relative;
  user-select: none;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--accent);
  border-radius: 1px;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity 80ms;
}

.nav-item:hover .nav-icon,
.nav-item.active .nav-icon {
  opacity: 1;
}

.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  padding: 12px 16px 16px;
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.theme-row {
  display: flex;
}

.theme-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
  font-family: var(--font-sans);
  transition:
    border-color 80ms,
    color 80ms;
}

.theme-btn:hover {
  border-color: var(--border-active);
  color: var(--text-primary);
}

.theme-label {
  white-space: nowrap;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  animation: statusPulse 2s ease-in-out infinite;
}

@keyframes statusPulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 var(--success-dim);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 0 3px transparent;
  }
}

.status-text {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 200ms ease;
  }

  .sidebar.sidebar-open {
    transform: translateX(0);
  }
}
</style>
