import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Config from './views/Config.vue';
import AIConfig from './views/AIConfig.vue';
import AIGenerate from './views/AIGenerate.vue';

const routes = [
  { path: '/', component: Config },
  { path: '/ai', component: AIConfig },
  { path: '/ai-generate', component: AIGenerate },
  { path: '/projects', component: { template: '<div>项目管理</div>' } },
  { path: '/generate', component: { template: '<div>生成上下文</div>' } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

const app = createApp(App);
app.use(router);
app.mount('#app');
