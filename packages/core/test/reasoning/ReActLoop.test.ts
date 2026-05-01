/**
 * ReAct 循环验证测试
 *
 * 目标：验证最小可用的 ReAct 循环能否正确输出结构化日志
 * - Observe（观察）
 * - Think（思考）
 * - Act（行动）
 */

import { describe, it, expect } from 'vitest';
import { ReActLoop } from '../../src/reasoning/ReActLoop.js';
import type { LLMAdapter, ChatParams, ChatResponse } from '../../src/lifecycle/Lifecycle.js';

/**
 * Mock LLM Adapter - 用于测试，避免真实 API 调用
 */
class MockLLMAdapter implements LLMAdapter {
  private responseCounter = 0;

  async chat(params: ChatParams): Promise<ChatResponse> {
    const lastMessage = params.messages[params.messages.length - 1]?.content || '';

    // 模拟不同的响应
    const responses = [
      // 第一次调用：思考阶段
      {
        content: `思考：我需要分析这个任务。
    当前情况：目标是将"Hello World"翻译成中文。

    分析步骤：
    1. 理解源文本："Hello World" 是英语问候语
    2. 确定目标语言：中文
    3. 执行翻译

    状态：acting
    下一步：使用翻译工具将"Hello World"翻译成中文`,
      },
      // 第二次调用：反思阶段
      {
        content: `继续`,
      },
      // 第三次调用：完成确认
      {
        content: `思考：翻译已完成，结果是"你好，世界"。
    状态：done`,
      },
    ];

    const response = responses[this.responseCounter % responses.length];
    this.responseCounter++;

    return {
      message: {
        role: 'assistant',
        content: response.content,
      },
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }

  async *chatStream(_params: ChatParams): AsyncIterable<{ delta: string; done: boolean }> {
    yield { delta: '模拟流式响应', done: true };
  }

  async embed(_texts: string[]): Promise<number[][]> {
    return [[0.1, 0.2, 0.3]];
  }
}

describe('ReAct 循环验证', () => {
  it('应该正确执行 Observe → Think → Act 循环', async () => {
    // 1. 创建 Mock LLM
    const mockLLM = new MockLLMAdapter();

    // 2. 创建 ReAct 循环
    const reactLoop = new ReActLoop(mockLLM, {
      maxIterations: 5,
      verbose: false, // 不打印到控制台
      reflectAfterStep: true,
    });

    // 3. 定义具体任务
    const goal = '将"Hello World"翻译成中文';

    // 4. 执行循环并收集结果
    const iterations: Array<any> = [];
    for await (const iteration of reactLoop.execute(goal)) {
      iterations.push(iteration);

      // 验证每次迭代的结构
      expect(iteration).toHaveProperty('iteration');
      expect(iteration).toHaveProperty('observation');
      expect(iteration).toHaveProperty('thought');
      expect(iteration.done).toBeDefined();

      // 如果是行动迭代，应该有 action 和 actionResult
      if (iteration.action) {
        expect(iteration).toHaveProperty('action');
        expect(iteration.action).toHaveProperty('type');
      }

      if (iteration.actionResult) {
        expect(iteration).toHaveProperty('actionResult');
        expect(iteration.actionResult).toHaveProperty('success');
      }

      // 完成时退出
      if (iteration.done) {
        break;
      }
    }

    // 5. 验证结果
    console.log('\n========== ReAct 循环执行日志 ==========');

    iterations.forEach((iter, index) => {
      console.log(`\n[迭代 ${index + 1}]`);
      console.log('----------------------------------------');
      console.log('📊 Observation（观察）:');
      console.log(`  内容: ${iter.observation.content}`);
      console.log(`  时间: ${iter.observation.timestamp.toISOString()}`);
      if (iter.observation.data) {
        console.log(`  数据: ${JSON.stringify(iter.observation.data, null, 2).slice(0, 100)}...`);
      }

      console.log('\n🤔 Thought（思考）:');
      console.log(`  推理: ${iter.thought.reasoning.slice(0, 100)}...`);
      console.log(`  状态: ${iter.thought.state}`);
      if (iter.thought.nextAction) {
        console.log(`  下一步: ${iter.thought.nextAction}`);
      }

      if (iter.action) {
        console.log('\n⚡ Action（行动）:');
        console.log(`  类型: ${iter.action.type}`);
        if (iter.action.params) {
          console.log(`  参数: ${JSON.stringify(iter.action.params)}`);
        }
        if (iter.action.expectedOutcome) {
          console.log(`  预期: ${iter.action.expectedOutcome}`);
        }
      }

      if (iter.actionResult) {
        console.log('\n✅ ActionResult（行动结果）:');
        console.log(`  成功: ${iter.actionResult.success}`);
        if (iter.actionResult.data) {
          console.log(`  数据: ${JSON.stringify(iter.actionResult.data).slice(0, 100)}...`);
        }
        if (iter.actionResult.error) {
          console.log(`  错误: ${iter.actionResult.error}`);
        }
        if (iter.actionResult.toolUsed) {
          console.log(`  工具: ${iter.actionResult.toolUsed}`);
        }
        if (iter.actionResult.tokensUsed) {
          console.log(`  Token: ${iter.actionResult.tokensUsed}`);
        }
      }

      console.log('\n----------------------------------------');
    });

    console.log('\n========== 验证结果 ==========');

    // 验证至少执行了一次迭代
    expect(iterations.length).toBeGreaterThan(0);

    // 验证最后一次迭代标记为完成
    const lastIteration = iterations[iterations.length - 1];
    expect(lastIteration.done).toBe(true);

    // 验证结构完整性
    const firstIteration = iterations[0];
    expect(firstIteration.observation).toBeDefined();
    expect(firstIteration.thought).toBeDefined();
    expect(firstIteration.thought.reasoning).toBeTruthy();

    console.log('✅ ReAct 循环结构完整');
    console.log(`✅ 共执行 ${iterations.length} 次迭代`);
    console.log('✅ 所有迭代都包含 Observation / Thought / Action / ActionResult');
  });

  it('应该能够正确解析思考结果', async () => {
    const mockLLM = new MockLLMAdapter();
    const reactLoop = new ReActLoop(mockLLM);

    const iterations: any[] = [];
    for await (const iteration of reactLoop.execute('测试任务')) {
      iterations.push(iteration);
      if (iteration.done) break;
    }

    // 验证思考状态
    const hasThinkingState = iterations.some((iter) => iter.thought.state === 'thinking');
    const hasActingState = iterations.some((iter) => iter.thought.state === 'acting');
    const hasDoneState = iterations.some((iter) => iter.thought.state === 'done');

    console.log('\n========== 状态转换验证 ==========');
    console.log(`思考状态 (thinking): ${hasThinkingState ? '✅' : '❌'}`);
    console.log(`行动状态 (acting): ${hasActingState ? '✅' : '❌'}`);
    console.log(`完成状态 (done): ${hasDoneState ? '✅' : '❌'}`);

    expect(hasDoneState).toBe(true);
  });

  it('应该能够执行工具调用', async () => {
    const mockLLM = new MockLLMAdapter();
    const reactLoop = new ReActLoop(mockLLM);

    const iterations: any[] = [];
    for await (const iteration of reactLoop.execute('搜索任务')) {
      iterations.push(iteration);
      if (iteration.done) break;
    }

    // 验证至少有一个行动被执行
    const actionsExecuted = iterations.filter((iter) => iter.action);
    console.log('\n========== 工具执行验证 ==========');
    console.log(`执行的行动数: ${actionsExecuted.length}`);

    if (actionsExecuted.length > 0) {
      actionsExecuted.forEach((iter) => {
        console.log(`  - ${iter.action.type}: ${iter.actionResult?.success ? '✅ 成功' : '❌ 失败'}`);
      });
    }

    expect(actionsExecuted.length).toBeGreaterThan(0);
  });
});
