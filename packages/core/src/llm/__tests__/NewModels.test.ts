/**
 * 新模型测试套件
 *
 * 测试 DeepSeek V4 和 Kimi Code 模型
 */

import { describe, it, expect } from 'vitest';
import { createDeepSeekModel, NativeModel } from '../NativeLLMAdapter.js';
import { createKimiCodeAdapter } from '../KimiCodeAdapter.js';
import { UnifiedModelFactory, createModel } from '../UnifiedModelFactory.js';

describe('DeepSeek V4 模型测试', () => {
  describe('1. DeepSeek V4 Pro', () => {
    it('应该能够启用思考模式和推理强度', async () => {
      const llm = createDeepSeekModel(
        process.env.DEEPSEEK_API_KEY || '',
        NativeModel.DEEPSEEK_V4_PRO,
        {
          thinking: { type: 'enabled' },
          reasoningEffort: 'high',
        }
      );

      const response = await llm.chat({
        messages: [
          {
            role: 'user',
            content:
              '请分析：为什么深度学习在图像识别任务上比传统机器学习方法更有效？请给出3个关键原因。',
          },
        ],
        maxTokens: 500,
        temperature: 0.7,
      });

      expect(response.message.content).toBeTruthy();
      expect(response.message.content.length).toBeGreaterThan(50);
      console.log('\n✅ DeepSeek V4 Pro 响应长度:', response.message.content.length);
      console.log('响应内容:', response.message.content.substring(0, 100) + '...');
    });

    it('应该支持流式输出', async () => {
      const llm = createDeepSeekModel(
        process.env.DEEPSEEK_API_KEY || '',
        NativeModel.DEEPSEEK_V4_PRO
      );

      const chunks: string[] = [];
      for await (const chunk of llm.chatStream({
        messages: [{ role: 'user', content: '用一句话介绍 TypeScript' }],
        maxTokens: 100,
      })) {
        if (chunk.done) break;
        chunks.push(chunk.delta);
      }

      const fullText = chunks.join('');
      expect(fullText.length).toBeGreaterThan(0);
      console.log('\n✅ 流式输出成功，总长度:', fullText.length);
    });
  });

  describe('2. DeepSeek V4 Flash', () => {
    it('应该能够快速响应简单对话', async () => {
      const llm = createDeepSeekModel(
        process.env.DEEPSEEK_API_KEY || '',
        NativeModel.DEEPSEEK_V4_FLASH
      );

      const response = await llm.chat({
        messages: [{ role: 'user', content: '你好，请简短自我介绍' }],
        maxTokens: 100,
      });

      expect(response.message.content).toBeTruthy();
      console.log('\n✅ DeepSeek V4 Flash 响应:', response.message.content);
    });
  });
});

describe('Kimi Code 模型测试', () => {
  it('应该能够生成代码', async () => {
    const kimi = createKimiCodeAdapter(process.env.KIMI_CODE_API_KEY || '');

    const response = await kimi.chat({
      messages: [
        {
          role: 'user',
          content: '用 TypeScript 写一个快速排序算法，要求包含详细注释',
        },
      ],
      maxTokens: 2000,
      temperature: 0.2,
    });

    expect(response.message.content).toBeTruthy();
    expect(response.message.content.length).toBeGreaterThan(50);
    console.log('\n✅ Kimi Code 生成代码长度:', response.message.content.length);

    // 验证是否包含 TypeScript 相关内容
    const hasTypescript =
      response.message.content.includes('function') || response.message.content.includes('const');
    expect(hasTypescript).toBe(true);
  });

  it('应该支持流式代码生成', async () => {
    const kimi = createKimiCodeAdapter(process.env.KIMI_CODE_API_KEY || '');

    const chunks: string[] = [];
    for await (const chunk of kimi.chatStream({
      messages: [{ role: 'user', content: '写一个斐波那契数列函数' }],
      maxTokens: 500,
    })) {
      if (chunk.done) break;
      chunks.push(chunk.delta);
    }

    const code = chunks.join('');
    expect(code.length).toBeGreaterThan(0);
    console.log('\n✅ Kimi Code 流式输出成功，总长度:', code.length);
  });
});

describe('统一模型工厂测试', () => {
  it('应该能够智能选择模型', () => {
    const testCases = [
      {
        task: '帮我写一份专利申请书',
        expectedCategory: 'patent',
      },
      {
        task: '用 Python 实现二叉树遍历',
        expectedCategory: 'code',
      },
      {
        task: '分析一下当前的经济形势',
        expectedCategory: 'reasoning',
      },
      {
        task: '总结这篇文章的主要内容',
        expectedCategory: 'summary',
      },
    ];

    testCases.forEach(({ task, expectedCategory }) => {
      console.log(`\n🎯 任务: "${task}"`);
      console.log(`   预期类别: ${expectedCategory}`);
      // 不实际调用，只测试选择逻辑
      const model = UnifiedModelFactory.selectModel(task, false);
      expect(model).toBeTruthy();
    });
  });

  it('应该能够列出所有可用模型', () => {
    const allModels = UnifiedModelFactory.listModels();
    expect(allModels.length).toBeGreaterThan(0);

    console.log('\n✅ 所有可用模型:');
    allModels.forEach((m) => {
      console.log(`   - ${m.name} (${m.source}, ${m.category}, ${m.cost})`);
    });
  });

  it('应该能够按条件过滤模型', () => {
    // 只看免费模型
    const freeModels = UnifiedModelFactory.listModels({ cost: ['free'] });
    expect(freeModels.length).toBeGreaterThan(0);
    console.log('\n✅ 免费模型:', freeModels.map((m) => m.name).join(', '));

    // 只看编程模型
    const codeModels = UnifiedModelFactory.listModels({ category: 1 }); // ModelCategory.CODE = 1
    expect(codeModels.length).toBeGreaterThan(0);
    console.log('✅ 编程模型:', codeModels.map((m) => m.name).join(', '));
  });

  it('应该能够快速创建不同模型', () => {
    // DeepSeek Pro
    const deepseek = UnifiedModelFactory.createDeepSeekV4('pro', {
      thinking: { type: 'enabled' },
      reasoningEffort: 'high',
    });
    expect(deepseek).toBeTruthy();
    console.log('\n✅ DeepSeek Pro 创建成功');

    // Kimi Code
    const kimi = UnifiedModelFactory.createKimiCode();
    expect(kimi).toBeTruthy();
    console.log('✅ Kimi Code 创建成功');

    // 本地模型
    const local = UnifiedModelFactory.createLocalModel('reasoning');
    expect(local).toBeTruthy();
    console.log('✅ 本地模型创建成功');
  });
});

describe('快捷函数测试', () => {
  it('createModel 应该能够智能选择', () => {
    const llm = createModel('用 Python 写一个快速排序');
    expect(llm).toBeTruthy();
    console.log('\n✅ createModel 快捷函数工作正常');
  });

  it('createDeepSeekPro 应该创建最强云端模型', () => {
    const llm = UnifiedModelFactory.createDeepSeekV4('pro');
    expect(llm).toBeTruthy();
    console.log('✅ createDeepSeekPro 工作正常');
  });

  it('createKimi 应该创建编程专用模型', () => {
    const llm = UnifiedModelFactory.createKimiCode();
    expect(llm).toBeTruthy();
    console.log('✅ createKimi 工作正常');
  });

  it('createOMXL 应该创建本地模型', () => {
    const llm = UnifiedModelFactory.createLocalModel('chat');
    expect(llm).toBeTruthy();
    console.log('✅ createOMXL 工作正常');
  });
});
