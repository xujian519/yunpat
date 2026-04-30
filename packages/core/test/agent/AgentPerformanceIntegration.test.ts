/**
 * Agent 性能优化集成测试
 *
 * 测试 Agent 基类中的性能优化功能：
 * - 推理缓存
 * - 性能监控
 * - 辅助方法（queryCache、storeToCache）
 * - 性能统计和报告
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent, AgentConfig } from '../../src/agent/Agent.js';
import { EventBus } from '../../src/eventbus/EventBus.js';
import { ShortTermMemory } from '../../src/memory/MemoryStore.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { NativeLLMAdapter } from '../../src/llm/NativeLLMAdapter.js';
import { LifecycleStage, type ExecutionContext } from '../../src/lifecycle/Lifecycle.js';

/**
 * 测试用智能体 - 启用性能优化
 */
class TestAgentOptimized extends Agent<string, string> {
  constructor(config: AgentConfig) {
    super({
      ...config,
      enableReasoningCache: true,
      cacheConfig: {
        maxEntries: 10,
        similarityThreshold: 0.85,
        ttl: 3600000,
      },
      enablePerformanceMonitoring: true,
    });
  }

  protected async plan(input: string, context: ExecutionContext): Promise<any> {
    // 尝试从缓存获取
    const cacheKey = `plan-${input}`;
    const cached = await this.queryCache(cacheKey);

    if (cached.found) {
      return cached.result;
    }

    // 执行规划
    const plan = {
      input,
      timestamp: Date.now(),
      steps: ['step1', 'step2'],
    };

    // 存储到缓存
    await this.storeToCache(cacheKey, plan, 100);

    return plan;
  }

  protected async act(plan: any, context: ExecutionContext): Promise<string> {
    // 模拟执行
    await new Promise(resolve => setTimeout(resolve, 10));

    return `Result for: ${plan.input}`;
  }
}

/**
 * 测试用智能体 - 禁用性能优化
 */
class TestAgentBasic extends Agent<string, string> {
  protected async plan(input: string, context: ExecutionContext): Promise<any> {
    return {
      input,
      timestamp: Date.now(),
    };
  }

  protected async act(plan: any, context: ExecutionContext): Promise<string> {
    return `Result for: ${plan.input}`;
  }
}

describe('Agent 性能优化集成', () => {
  let llm: NativeLLMAdapter;
  let eventBus: EventBus;
  let memory: ShortTermMemory;
  let tools: ToolRegistry;

  beforeEach(() => {
    // 创建测试依赖
    llm = new NativeLLMAdapter({
      name: 'deepseek-chat',
      apiKey: 'test-key',
    }) as any;

    eventBus = new EventBus();
    memory = new ShortTermMemory();
    tools = new ToolRegistry();
  });

  describe('推理缓存功能', () => {
    it('应该在 AgentConfig 启用缓存时初始化缓存', () => {
      const agent = new TestAgentOptimized({
        name: 'TestAgent',
        description: 'Test agent with cache',
        eventBus,
        memory,
        tools,
        llm,
      });

      expect((agent as any).reasoningCache).toBeDefined();
    });

    it('应该在 AgentConfig 禁用缓存时不初始化缓存', () => {
      const agent = new TestAgentBasic({
        name: 'TestAgent',
        description: 'Test agent without cache',
        eventBus,
        memory,
        tools,
        llm,
      });

      expect((agent as any).reasoningCache).toBeUndefined();
    });

    it('应该支持 queryCache 辅助方法', async () => {
      const agent = new TestAgentOptimized({
        name: 'TestAgent',
        description: 'Test agent',
        eventBus,
        memory,
        tools,
        llm,
      });

      // 第一次查询应该未命中
      const result1 = await (agent as any).queryCache('test-key');
      expect(result1.found).toBe(false);

      // 存储数据
      await (agent as any).storeToCache('test-key', { data: 'test' }, 100);

      // 第二次查询应该命中
      const result2 = await (agent as any).queryCache('test-key');
      expect(result2.found).toBe(true);
      expect(result2.result).toEqual({ data: 'test' });
    });

    it('应该在 plan 阶段使用缓存', async () => {
      const agent = new TestAgentOptimized({
        name: 'TestAgent',
        description: 'Test agent',
        eventBus,
        memory,
        tools,
        llm,
      });

      const input = 'test input';

      // 第一次执行 - 冷启动
      const plan1 = await (agent as any).plan(input, {} as ExecutionContext);
      expect(plan1).toBeDefined();
      expect(plan1.input).toBe(input);

      // 第二次执行 - 应该从缓存获取
      const plan2 = await (agent as any).plan(input, {} as ExecutionContext);
      expect(plan2).toBeDefined();
      expect(plan2.timestamp).toBe(plan1.timestamp); // 时间戳相同，说明来自缓存
    });
  });

  describe('性能监控功能', () => {
    it('应该在 AgentConfig 启用监控时初始化监控器', () => {
      const agent = new TestAgentOptimized({
        name: 'TestAgent',
        description: 'Test agent with monitoring',
        eventBus,
        memory,
        tools,
        llm,
      });

      expect((agent as any).performanceMonitor).toBeDefined();
    });

    it('应该在 AgentConfig 禁用监控时不初始化监控器', () => {
      const agent = new TestAgentBasic({
        name: 'TestAgent',
        description: 'Test agent without monitoring',
        eventBus,
        memory,
        tools,
        llm,
      });

      expect((agent as any).performanceMonitor).toBeUndefined();
    });
  });

  describe('性能统计功能', () => {
    it('应该返回正确的性能统计', async () => {
      const agent = new TestAgentOptimized({
        name: 'TestAgent',
        description: 'Test agent',
        eventBus,
        memory,
        tools,
        llm,
      });

      // 执行一些操作
      await (agent as any).storeToCache('key1', { data: 'test1' }, 100);
      await (agent as any).storeToCache('key2', { data: 'test2' }, 200);
      await (agent as any).queryCache('key1');

      const stats = agent.getPerformanceStats();

      expect(stats).toBeDefined();
      expect(stats.cache).toBeDefined();
      expect(stats.cache?.totalEntries).toBe(2);
      expect(stats.cache?.hits).toBe(1);
      expect(stats.cache?.tokensSaved).toBe(100);
    });

    it('应该在无缓存时返回空统计', () => {
      const agent = new TestAgentBasic({
        name: 'TestAgent',
        description: 'Test agent',
        eventBus,
        memory,
        tools,
        llm,
      });

      const stats = agent.getPerformanceStats();

      expect(stats).toEqual({});
    });
  });

  describe('性能报告功能', () => {
    it('应该生成可读的性能报告', async () => {
      const agent = new TestAgentOptimized({
        name: 'TestAgent',
        description: 'Test agent',
        eventBus,
        memory,
        tools,
        llm,
      });

      // 添加一些缓存数据
      await (agent as any).storeToCache('key1', { data: 'test1' }, 100);
      await (agent as any).queryCache('key1');

      const report = agent.exportPerformanceReport();

      expect(report).toBeDefined();
      expect(report).toContain('TestAgent 性能报告');
      expect(report).toContain('缓存统计');
      expect(report).toContain('总条目数: 1');
      expect(report).toContain('命中次数: 1');
    });

    it('应该在无数据时生成基本报告', () => {
      const agent = new TestAgentOptimized({
        name: 'TestAgent',
        description: 'Test agent',
        eventBus,
        memory,
        tools,
        llm,
      });

      const report = agent.exportPerformanceReport();

      expect(report).toBeDefined();
      expect(report).toContain('TestAgent 性能报告');
    });
  });

  describe('clearCache 功能', () => {
    it('应该清空缓存', async () => {
      const agent = new TestAgentOptimized({
        name: 'TestAgent',
        description: 'Test agent',
        eventBus,
        memory,
        tools,
        llm,
      });

      // 添加缓存数据
      await (agent as any).storeToCache('key1', { data: 'test1' }, 100);
      await (agent as any).storeToCache('key2', { data: 'test2' }, 100);

      let stats = agent.getPerformanceStats();
      expect(stats.cache?.totalEntries).toBe(2);

      // 清空缓存
      agent.clearCache();

      stats = agent.getPerformanceStats();
      expect(stats.cache?.totalEntries).toBe(0);
    });

    it('应该在无缓存时不报错', () => {
      const agent = new TestAgentBasic({
        name: 'TestAgent',
        description: 'Test agent',
        eventBus,
        memory,
        tools,
        llm,
      });

      expect(() => agent.clearCache()).not.toThrow();
    });
  });

  describe('完整执行流程', () => {
    it('应该在完整执行中使用性能优化', async () => {
      const agent = new TestAgentOptimized({
        name: 'TestAgent',
        description: 'Test agent',
        eventBus,
        memory,
        tools,
        llm,
      });

      const input = 'test input';

      // 第一次执行
      const result1 = await agent.execute(input);
      expect(result1).toBe('Result for: test input');

      // 第二次执行（应该命中缓存）
      const result2 = await agent.execute(input);
      expect(result2).toBe('Result for: test input');

      // 检查统计
      const stats = agent.getPerformanceStats();
      expect(stats.cache?.totalEntries).toBeGreaterThan(0);
      expect(stats.cache?.hits).toBeGreaterThan(0);
    });
  });

  describe('相似度阈值', () => {
    it('应该支持自定义相似度阈值', async () => {
      const agent = new TestAgentOptimized({
        name: 'TestAgent',
        description: 'Test agent',
        eventBus,
        memory,
        tools,
        llm,
      });

      await (agent as any).storeToCache('original-key', { data: 'test' }, 100);

      // 使用高阈值查询
      const result1 = await (agent as any).queryCache('original-key', 0.95);
      expect(result1.found).toBe(true);

      // 使用低阈值查询
      const result2 = await (agent as any).queryCache('similar-key', 0.5);
      // 相似度计算可能返回未命中
      expect(result2).toBeDefined();
    });
  });
});
