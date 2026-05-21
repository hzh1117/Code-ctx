import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        // Pull framework runtime into its own long-lived chunk so app code
        // changes don't bust the Vue/router cache for repeat visitors.
        manualChunks(id) {
          if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/') || id.includes('node_modules/vue-router/')) {
            return 'vue-vendor';
          }
          if (id.includes('node_modules/axios/')) {
            return 'axios';
          }
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true
      }
    }
  }
});
