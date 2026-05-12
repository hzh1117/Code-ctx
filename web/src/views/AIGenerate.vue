<template>
  <div class="ai-generate">
    <h1>AI 文档生成</h1>
    
    <div class="generate-section">
      <h2>选择场景</h2>
      <select v-model="selectedScenario">
        <option v-for="s in scenarios" :key="s.id" :value="s.id">
          {{ s.id }} - {{ s.name }}
        </option>
      </select>
    </div>
    
    <div class="generate-section">
      <h2>输入任务描述</h2>
      <textarea v-model="taskDescription" placeholder="描述你要开发的功能..."></textarea>
    </div>
    
    <div class="generate-section">
      <button @click="generate" :disabled="generating">
        {{ generating ? '生成中...' : '生成 Prompt' }}
      </button>
    </div>
    
    <div v-if="generatedPrompt" class="generate-section">
      <h2>生成的 Prompt</h2>
      <textarea v-model="generatedPrompt" readonly></textarea>
      <button @click="copyToClipboard">复制到剪贴板</button>
    </div>
    
    <div v-if="aiResponse" class="generate-section">
      <h2>AI 响应</h2>
      <div class="response-content">{{ aiResponse }}</div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      scenarios: [],
      selectedScenario: 'A',
      taskDescription: '',
      generatedPrompt: '',
      aiResponse: '',
      generating: false
    };
  },
  async mounted() {
    await this.loadScenarios();
  },
  methods: {
    async loadScenarios() {
      try {
        const res = await axios.get('/api/scenarios');
        this.scenarios = res.data;
      } catch (err) {
        console.error('加载场景失败:', err);
      }
    },
    async generate() {
      if (!this.taskDescription) {
        alert('请输入任务描述');
        return;
      }
      
      this.generating = true;
      this.generatedPrompt = '';
      this.aiResponse = '';
      
      try {
        const promptRes = await axios.post('/api/generate-prompt', {
          scenario: this.selectedScenario,
          task: this.taskDescription
        });
        this.generatedPrompt = promptRes.data.prompt;
        
        const aiRes = await axios.post('/api/ai/generate', {
          prompt: this.generatedPrompt
        });
        
        if (aiRes.data.success) {
          this.aiResponse = aiRes.data.content;
        } else {
          alert('AI 调用失败: ' + aiRes.data.error);
        }
      } catch (err) {
        alert('生成失败: ' + err.message);
      } finally {
        this.generating = false;
      }
    },
    async copyToClipboard() {
      try {
        await navigator.clipboard.writeText(this.generatedPrompt);
        alert('已复制到剪贴板');
      } catch (err) {
        alert('复制失败');
      }
    }
  }
};
</script>

<style scoped>
.ai-generate {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.generate-section {
  margin-bottom: 30px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

select, textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

textarea {
  min-height: 150px;
  font-family: monospace;
}

button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #0056b3;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.response-content {
  background: #fff;
  padding: 15px;
  border-radius: 4px;
  white-space: pre-wrap;
  border: 1px solid #ddd;
}
</style>
