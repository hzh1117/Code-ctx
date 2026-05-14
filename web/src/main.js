import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Dashboard from './views/Dashboard.vue';
import Config from './views/Config.vue';
import AIConfig from './views/AIConfig.vue';
import AIGenerate from './views/AIGenerate.vue';
import Projects from './views/Projects.vue';
import Scenarios from './views/Scenarios.vue';
import Status from './views/Status.vue';

const routes = [
  { path: '/', component: Dashboard },
  { path: '/config', component: Config },
  { path: '/ai', component: AIConfig },
  { path: '/ai-generate', component: AIGenerate },
  { path: '/projects', component: Projects },
  { path: '/scenarios', component: Scenarios },
  { path: '/status', component: Status }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

const app = createApp(App);
app.use(router);
app.mount('#app');
