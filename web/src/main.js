import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

// Route components are loaded on demand so each view ships as its own
// chunk instead of inflating the entry bundle.
const routes = [
  { path: '/', component: () => import('./views/Dashboard.vue') },
  { path: '/config', component: () => import('./views/Config.vue') },
  { path: '/ai', component: () => import('./views/AIConfig.vue') },
  { path: '/ai-generate', component: () => import('./views/AIGenerate.vue') },
  { path: '/projects', component: () => import('./views/Projects.vue') },
  { path: '/scenarios', component: () => import('./views/Scenarios.vue') },
  { path: '/status', component: () => import('./views/Status.vue') }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

const app = createApp(App);
app.use(router);
app.mount('#app');
