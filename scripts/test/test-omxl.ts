import { createOMXLModel } from '../packages/core/dist/index.js';

async function testOMXL() {
  console.log('🧪 测试 OMLX 本地模型连接...\n');

  // 创建 OMLX 适配器（使用你提供的密钥）
  const llm = createOMXLModel('xj78102@');

  try {
    console.log('📡 发送测试请求到 http://localhost:8009/v1 ...\n');

    const response = await llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个助手，请简洁回答。',
        },
        {
          role: 'user',
          content: '你好，请介绍一下你自己（一句话）',
        },
      ],
      temperature: 0.7,
      maxTokens: 100,
    });

    console.log('✅ OMLX 连接成功！\n');
    console.log('回复内容:');
    console.log(response.message.content);
    console.log('\n📊 Token 使用情况:');
    console.log(JSON.stringify(response.usage, null, 2));

    return true;
  } catch (error) {
    console.error('\n❌ OMLX 连接失败:');
    console.error(error);
    return false;
  }
}

testOMXL()
  .then((success) => {
    if (success) {
      console.log('\n✨ OMLX 本地模型验证成功！');
    } else {
      console.log('\n💡 建议：');
      console.log('1. 检查 OMLX 服务是否运行：curl http://localhost:8009/v1/models');
      console.log('2. 检查端口是否正确：你说是 8009');
      console.log('3. 检查 API Key 是否正确');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('测试出错:', error);
    process.exit(1);
  });
