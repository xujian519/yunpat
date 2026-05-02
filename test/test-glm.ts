#!/usr/bin/env tsx
/**
 * GLM (智谱 AI) 模型测试
 *
 * 测试 GLM-4-Flash 模型的基本功能
 *
 * 运行方式:
 *   export GLM_API_KEY=your_api_key_here
 *   pnpm --filter @yunpat/core exec tsx test-glm.ts
 */

import { NativeLLMAdapter, NativeModel } from './packages/core/src/llm/NativeLLMAdapter.js';

// 从环境变量获取 API Key
const apiKey = process.env.GLM_API_KEY;

if (!apiKey) {
  console.error('❌ 错误: 请设置 GLM_API_KEY 环境变量');
  console.error('\n使用方式:');
  console.error('  export GLM_API_KEY=your_api_key_here');
  console.error('  pnpm --filter @yunpat/core exec tsx test-glm.ts\n');
  process.exit(1);
}

// 创建 GLM 模型
const glmModel = new NativeLLMAdapter({
  name: NativeModel.GLM_4_FLASH,
  apiKey,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
});

async function testGLM() {
  console.log('🧪 开始测试 GLM-4-Flash 模型...\n');

  // 测试 1: 简单对话
  console.log('📝 测试 1: 简单对话');
  console.log('─'.repeat(50));
  try {
    const response1 = await glmModel.chat({
      messages: [
        {
          role: 'user',
          content: '你好！请用一句话介绍你自己。',
        },
      ],
      maxTokens: 100,
    });

    console.log('✅ 响应:', response1.message?.content);
    console.log('Token 使用:', response1.usage);
    console.log('');
  } catch (error) {
    console.error('❌ 错误:', error);
    console.log('');
  }

  // 测试 2: 代码生成
  console.log('📝 测试 2: 代码生成');
  console.log('─'.repeat(50));
  try {
    const response2 = await glmModel.chat({
      messages: [
        {
          role: 'user',
          content: '用 TypeScript 写一个计算斐波那契数列的函数，要求有类型注释和错误处理。',
        },
      ],
      maxTokens: 500,
      temperature: 0.3,
    });

    console.log('✅ 生成的代码:');
    console.log(response2.message?.content);
    console.log('Token 使用:', response2.usage);
    console.log('');
  } catch (error) {
    console.error('❌ 错误:', error);
    console.log('');
  }

  // 测试 3: 多轮对话
  console.log('📝 测试 3: 多轮对话');
  console.log('─'.repeat(50));
  try {
    const messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }> = [
      {
        role: 'user',
        content: '什么是 TypeScript？',
      },
    ];

    const response3a = await glmModel.chat({
      messages,
      maxTokens: 200,
    });

    console.log('✅ 第一轮响应:', response3a.message?.content.substring(0, 100) + '...');

    // 添加助手响应和新的用户问题
    messages.push({
      role: 'assistant',
      content: response3a.message?.content || '',
    });
    messages.push({
      role: 'user',
      content: '它和 JavaScript 有什么区别？',
    });

    const response3b = await glmModel.chat({
      messages,
      maxTokens: 200,
    });

    console.log('✅ 第二轮响应:', response3b.message?.content.substring(0, 100) + '...');
    console.log('Token 使用:', response3b.usage);
    console.log('');
  } catch (error) {
    console.error('❌ 错误:', error);
    console.log('');
  }

  // 测试 4: 结构化输出 (JSON)
  console.log('📝 测试 4: 结构化输出 (JSON)');
  console.log('─'.repeat(50));
  try {
    const response4 = await glmModel.chat({
      messages: [
        {
          role: 'user',
          content: '请用 JSON 格式返回一个用户信息，包含 name, age, email 三个字段。',
        },
      ],
      maxTokens: 200,
      temperature: 0.5,
    });

    console.log('✅ JSON 响应:');
    console.log(response4.message?.content);
    console.log('');

    // 尝试解析 JSON
    try {
      const content = response4.message?.content || '';
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                       content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        console.log('✅ 解析后的 JSON:', JSON.stringify(parsed, null, 2));
      }
    } catch (parseError) {
      console.warn('⚠️  JSON 解析失败（这是正常的，模型可能需要更多提示）');
    }
    console.log('');
  } catch (error) {
    console.error('❌ 错误:', error);
    console.log('');
  }

  // 测试 5: 流式输出
  console.log('📝 测试 5: 流式输出');
  console.log('─'.repeat(50));
  console.log('⚠️  流式输出功能尚未实现，跳过此测试');
  console.log('💡 提示: NativeLLMAdapter 目前不支持流式输出');
  console.log('');

  // 性能统计
  console.log('📊 性能统计');
  console.log('─'.repeat(50));
  console.log('✅ 所有测试完成');
  console.log('💡 提示: GLM-4-Flash 适合快速响应和测试场景');
  console.log('💡 如需更高性能，可使用 GLM-4-Plus 或 GLM-4.7');
  console.log('');
}

// 运行测试
testGLM().catch((error) => {
  console.error('💥 测试失败:', error);
  process.exit(1);
});
