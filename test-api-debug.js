const { generateWithAI } = require('./src/ai/client');
const { getAIConfig } = require('./src/utils/config');

async function test() {
  console.log('=== API 连接测试 ===');
  console.log('时间:', new Date().toISOString());
  
  try {
    const config = getAIConfig(process.cwd());
    console.log('\n配置信息:');
    console.log('- 协议:', config.protocol);
    console.log('- Base URL:', config.baseUrl);
    console.log('- 模型:', config.model);
    console.log('- Max Tokens:', config.maxTokens);
    console.log('- API Key:', config.apiKey ? `${config.apiKey.substring(0, 10)}...` : '未设置');
    console.log('- 超时时间:', config.timeout, 'ms');
    
    console.log('\n开始测试连接...');
    const startTime = Date.now();
    
    const result = await generateWithAI('say hi', {
      ...config,
      maxTokens: 100
    });
    
    const endTime = Date.now();
    console.log('\n✅ 测试成功!');
    console.log('- 响应时间:', endTime - startTime, 'ms');
    console.log('- 响应内容:', result);
    
  } catch (err) {
    console.log('\n❌ 测试失败!');
    console.log('- 错误类型:', err.constructor.name);
    console.log('- 错误代码:', err.code || '无');
    console.log('- 错误信息:', err.message);
    
    if (err.stack) {
      console.log('\n错误堆栈:');
      console.log(err.stack);
    }
    
    // 分析可能的错误原因
    console.log('\n🔍 错误分析:');
    
    if (err.message.includes('请求超时')) {
      console.log('1. 请求超时 - 可能原因:');
      console.log('   - 网络连接不稳定');
      console.log('   - API 服务器响应慢');
      console.log('   - 超时时间设置过短');
      console.log('   建议: 增加超时时间或检查网络连接');
    }
    
    if (err.message.includes('连接失败') || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.log('1. 连接失败 - 可能原因:');
      console.log('   - API 服务器地址错误');
      console.log('   - 网络防火墙阻止连接');
      console.log('   - API 服务器不可用');
      console.log('   建议: 检查 API 地址和网络设置');
    }
    
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      console.log('1. 认证失败 - 可能原因:');
      console.log('   - API Key 无效或已过期');
      console.log('   - API Key 权限不足');
      console.log('   建议: 检查 API Key 是否正确');
    }
    
    if (err.message.includes('429') || err.message.includes('Too Many Requests')) {
      console.log('1. 请求过多 - 可能原因:');
      console.log('   - 已达到 API 调用频率限制');
      console.log('   建议: 等待一段时间后重试');
    }
    
    if (err.message.includes('响应格式异常') || err.message.includes('解析响应失败')) {
      console.log('1. 响应格式问题 - 可能原因:');
      console.log('   - API 服务返回了非标准响应');
      console.log('   - API 端点不兼容');
      console.log('   建议: 检查 API 兼容性配置');
    }
  }
}

// 启用调试模式
process.env.AI_DEBUG = 'true';
test();