<template>
  <div id="app">
    <button class="mobile-menu-btn" @click="sidebarOpen = !sidebarOpen" v-if="isMobile">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>

    <div class="sidebar-overlay" v-if="sidebarOpen && isMobile" @click="sidebarOpen = false"></div>

    <Sidebar :open="sidebarOpen" @navigate="sidebarOpen = false" />

    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <transition name="toast-slide">
      <div v-if="toast.show" :class="['global-toast', `toast-${toast.type}`]">
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>

<script>
import Sidebar from './components/Sidebar.vue';

export default {
  components: { Sidebar },
  data() {
    return {
      sidebarOpen: false,
      isMobile: false,
      toast: { show: false, message: '', type: 'success' }
    };
  },
  mounted() {
    this.checkMobile();
    window.addEventListener('resize', this.checkMobile);
    window.__showToast = this.showToast;
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.checkMobile);
  },
  methods: {
    checkMobile() {
      this.isMobile = window.innerWidth <= 768;
      if (!this.isMobile) this.sidebarOpen = false;
    },
    showToast(message, type = 'success') {
      this.toast = { show: true, message, type };
      setTimeout(() => { this.toast.show = false; }, 3000);
    }
  }
};
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700&display=swap');

:root {
  --bg-base: #0c0c0e;
  --bg-surface: #141416;
  --bg-hover: #1c1c20;
  --border: #242428;
  --border-active: #3a3a42;
  --text-primary: #e8e8ed;
  --text-secondary: #6b6b78;
  --text-muted: #3d3d46;
  --accent: #7c6af7;
  --accent-dim: #2d2452;
  --accent-hover: #6b5ce7;
  --accent-text: #ffffff;
  --success: #3fb950;
  --success-dim: rgba(63, 185, 80, 0.1);
  --success-border: rgba(63, 185, 80, 0.2);
  --warning: #d29922;
  --warning-dim: rgba(210, 153, 34, 0.1);
  --warning-border: rgba(210, 153, 34, 0.2);
  --danger: #f85149;
  --danger-dim: rgba(248, 81, 73, 0.1);
  --danger-hover: rgba(248, 81, 73, 0.18);
  --danger-border: rgba(248, 81, 73, 0.2);
  --code-bg: #161b22;
  --overlay: rgba(0, 0, 0, 0.6);
  --font-sans: 'Outfit', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

[data-theme="light"] {
  --bg-base: #f5f5f7;
  --bg-surface: #ffffff;
  --bg-hover: #ebebef;
  --border: #e2e2e8;
  --border-active: #c8c8d4;
  --text-primary: #1a1a2e;
  --text-secondary: #6b6b82;
  --text-muted: #b0b0be;
  --accent: #6355e0;
  --accent-dim: #ede9ff;
  --accent-hover: #5244d0;
  --accent-text: #ffffff;
  --success: #1a7f37;
  --success-dim: rgba(26, 127, 55, 0.08);
  --success-border: rgba(26, 127, 55, 0.18);
  --warning: #9a6700;
  --warning-dim: rgba(154, 103, 0, 0.08);
  --warning-border: rgba(154, 103, 0, 0.18);
  --danger: #d1242f;
  --danger-dim: rgba(209, 36, 47, 0.06);
  --danger-hover: rgba(209, 36, 47, 0.12);
  --danger-border: rgba(209, 36, 47, 0.18);
  --code-bg: #f0f0f5;
  --overlay: rgba(0, 0, 0, 0.35);
}

*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  transition: background-color 200ms ease, border-color 200ms ease, color 150ms ease;
}

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

body {
  font-family: var(--font-sans);
  background: var(--bg-base);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 14px;
  line-height: 1.5;
}

#app {
  display: grid;
  grid-template-columns: 200px 1fr;
  min-height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* ── Scrollbar ── */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--border-active);
}

/* ── Page Transitions ── */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 120ms ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}

/* ── Mobile ── */
.mobile-menu-btn {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 1001;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  z-index: 99;
}

.main-content {
  width: 100%;
  min-width: 0;
  overflow-y: auto;
}

/* ── Toast ── */
.global-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 10px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-mono);
  z-index: 2000;
}
.toast-success { border-left: 3px solid var(--success); }
.toast-error { border-left: 3px solid var(--danger); }
.toast-slide-enter-active { transition: all 120ms ease; }
.toast-slide-leave-active { transition: all 80ms ease; }
.toast-slide-enter-from { opacity: 0; transform: translateY(8px); }
.toast-slide-leave-to { opacity: 0; }

/* ══════════════════════════════════════════
   GLOBAL COMPONENT CLASSES
   ══════════════════════════════════════════ */

/* ── Page Layout ── */
.page {
  width: 100%;
  padding: 24px 32px;
  box-sizing: border-box;
  animation: pageEnter 120ms ease;
}
@keyframes pageEnter {
  from { opacity: 0; }
  to { opacity: 1; }
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.page-title {
  font-family: var(--font-sans);
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.page-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* ── Cards ── */
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title svg {
  color: var(--accent);
  flex-shrink: 0;
}

/* ── Badges ── */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font-mono);
  letter-spacing: 0.3px;
}

.badge-success {
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid var(--accent-dim);
}

.badge-warning {
  background: var(--warning-dim);
  color: var(--warning);
  border: 1px solid var(--warning-border);
}

.badge-danger {
  background: var(--danger-dim);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}

.badge-neutral {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 4px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  outline: none;
  transition: background 80ms, border-color 80ms, opacity 80ms;
  white-space: nowrap;
  user-select: none;
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-text);
}
.btn-primary:hover {
  background: var(--accent-hover);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-base);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
.btn-secondary:hover {
  border-color: var(--border-active);
  background: var(--bg-hover);
}

.btn-danger {
  background: var(--danger-dim);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}
.btn-danger:hover {
  background: var(--danger-hover);
}

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Inputs ── */
.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
  text-transform: lowercase;
  letter-spacing: 0.3px;
}

.input-label .required {
  color: var(--danger);
  margin-left: 2px;
}

.input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  outline: none;
  transition: border-color 80ms;
}

.input:focus {
  border-color: var(--accent);
}

.input::placeholder {
  color: var(--text-muted);
}

select.input {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23888' d='M5 7L1 3h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
  cursor: pointer;
}

textarea.input {
  min-height: 100px;
  resize: vertical;
  line-height: 1.6;
}

.input-hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ── Loading ── */
.loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 32px 0;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 13px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Empty State (terminal style) ── */
.empty-terminal {
  border: 1px dashed var(--border);
  border-radius: 4px;
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.8;
  background: var(--bg-base);
}

.empty-terminal .term-line {
  display: flex;
  align-items: flex-start;
  gap: 0;
}

.empty-terminal .term-prompt {
  color: var(--accent);
  margin-right: 8px;
  flex-shrink: 0;
}

.empty-terminal .term-cmd {
  color: var(--text-secondary);
}

.empty-terminal .term-border-top,
.empty-terminal .term-border-bottom {
  color: var(--text-muted);
  opacity: 0.5;
  user-select: none;
}

/* ── Code Block ── */
.code-block {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  overflow-x: auto;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Grid helpers ── */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Toggle ── */
.toggle-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: background 80ms, border-color 80ms;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  bottom: 2px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: transform 80ms, background 80ms;
}

.toggle input:checked + .toggle-slider {
  background: var(--accent-dim);
  border-color: var(--accent);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(16px);
  background: var(--accent);
}

.toggle-label {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ── Tags ── */
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  transition: border-color 80ms;
}

.tag:hover {
  border-color: var(--border-active);
}

.tag-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  line-height: 1;
  margin-left: 2px;
  transition: color 80ms;
}

.tag-remove:hover {
  color: var(--danger);
}

/* ── Blinking cursor ── */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.cursor-blink {
  display: inline-block;
  width: 7px;
  height: 14px;
  background: var(--text-muted);
  margin-left: 2px;
  animation: blink 1s step-end infinite;
  vertical-align: text-bottom;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  #app {
    grid-template-columns: 1fr;
  }
  .main-content {
    padding-top: 52px;
  }
  .page {
    padding: 16px;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .page-header {
    flex-direction: column;
  }
}
</style>
