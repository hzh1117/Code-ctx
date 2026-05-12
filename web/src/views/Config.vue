<template>
  <div class="config">
    <h1>配置管理</h1>
    <div v-if="loading">加载中...</div>
    <div v-else>
      <div>
        <label>项目名称：</label>
        <input v-model="config.projectName" />
      </div>
      <div>
        <label>输出目录：</label>
        <input v-model="config.outputDir" />
      </div>
      <button @click="save">保存</button>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      config: {},
      loading: true
    };
  },
  async mounted() {
    const res = await axios.get('/api/config');
    this.config = res.data;
    this.loading = false;
  },
  methods: {
    async save() {
      await axios.put('/api/config', this.config);
      alert('保存成功');
    }
  }
};
</script>
