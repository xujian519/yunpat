/**
 * Agent 端到端集成测试
 *
 * 验证完整的智能体执行流程，包括多智能体通信和检查点恢复
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../../src/agent/Agent.js';
import { EventBus } from '../../src/eventbus/EventBus.js';
import { ShortTermMemory } from '../../src/memory/MemoryStore.js';
import { ToolRegistry, ToolWrapper } from '../../src/tools/ToolRegistry.js';
import { EnhancedMemoryStore } from '../../src/memory/CheckpointManager.js';
import { createMockLLM } from '../helpers/mocks.js';
import type { ExecutionContext } from '../../src/lifecycle/Lifecycle.js';

/**
 * 完整功能智能体 - 使用真实 Memory 和 EventBus
 */
class FullAgent extends Agent<string, string> {
  public callLog: string[] = [];
  private memoryStore: EnhancedMemoryStore;

  constructor(
    name: string,
    eventBus: EventBus,
    memoryStore: EnhancedMemoryStore,
    toolRegistry: ToolRegistry
  ) {
    super({
      name,
      description: `Full integration agent: ${name}`,
      eventBus,
      memory: memoryStore,
      tools: toolRegistry,
      llm: createMockLLM(),
      maxIterations: 5,
    });
    this.memoryStore = memoryStore;
  }

  protected async before(input: string, context: ExecutionContext) {
    this.callLog.push(`before:${input}`);
    await context.memory.set('last-input', input);
  }

  protected async init(context: ExecutionContext) {
    this.callLog.push('init');
    await context.memory.set('initialized', true);
  }

  protected async plan(input: string, context: ExecutionContext) {
    this.callLog.push('plan');
    const prev = await context.memory.get('last-input');
    return { input, previousInput: prev };
  }

  protected async act(plan: any, context: ExecutionContext) {
    this.callLog.push('act');
    // 使用工具
    if (context.tools.has('echo')) {
      const result = await context.tools.call('echo', { text: plan.input });
      return `tool-result: ${result}`;
    }
    return `direct: ${plan.input}`;
  }

  protected async reflect(result: unknown, context: ExecutionContext) {
    this.callLog.push('reflect');
    // 创建检查点
    await this.memoryStore.createCheckpoint(this.name, context.executionId, 1);
    return { shouldContinue: false, result };
  }

  protected async after(input: string, output: string, context: ExecutionContext) {
    this.callLog.push('after');
    await context.memory.set('last-output', output);
  }
}

describe('Agent 端到端集成', () => {
  let eventBus: EventBus;
  let memory: EnhancedMemoryStore;
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    eventBus = new EventBus();
    memory = new EnhancedMemoryStore();
    toolRegistry = new ToolRegistry(eventBus);

    // 注册真实工具
    toolRegistry.register(new ToolWrapper('echo', 'Echo tool', async (input: any) => input.text));
  });

  describe('完整生命周期', () => {
    it('应完成 before → init → plan → act → reflect → after 全流程', async () => {
      const agent = new FullAgent('full-agent', eventBus, memory, toolRegistry);
      const result = await agent.execute('integration-test');

      expect(result).toContain('tool-result');
      expect(agent.callLog).toEqual([
        'before:integration-test',
        'init',
        'plan',
        'act',
        'reflect',
        'after',
      ]);
    });

    it('应在生命周期各阶段正确读写记忆', async () => {
      const agent = new FullAgent('memory-agent', eventBus, memory, toolRegistry);
      await agent.execute('first-call');

      // after 阶段写入的 last-output
      expect(await memory.get('last-output')).toContain('tool-result');
      // before 阶段写入的 last-input
      expect(await memory.get('last-input')).toBe('first-call');
      // init 阶段写入的 initialized
      expect(await memory.get('initialized')).toBe(true);
    });

    it('连续执行应共享记忆', async () => {
      const agent = new FullAgent('shared-agent', eventBus, memory, toolRegistry);

      await agent.execute('call-1');
      agent.callLog = [];

      await agent.execute('call-2');

      // plan 阶段应能读取上次的 input
      expect(await memory.get('last-input')).toBe('call-2');
    });
  });

  describe('检查点集成', () => {
    it('reflect 阶段应成功创建检查点', async () => {
      await memory.set('pre-checkpoint', 'data');

      const agent = new FullAgent('cp-agent', eventBus, memory, toolRegistry);
      await agent.execute('checkpoint-test');

      const checkpoints = await memory.listCheckpoints();
      expect(checkpoints.length).toBeGreaterThanOrEqual(1);
    });

    it('应能恢复到检查点', async () => {
      await memory.set('original', 'data');

      const agent = new FullAgent('restore-agent', eventBus, memory, toolRegistry);
      await agent.execute('before-restore');

      // 获取检查点
      const checkpoints = await memory.listCheckpoints();
      expect(checkpoints.length).toBeGreaterThan(0);

      // 修改数据
      await memory.set('original', 'modified');

      // 恢复
      await memory.restoreCheckpoint(checkpoints[0].id);
      expect(await memory.get('original')).toBe('data');
    });
  });

  describe('多智能体通信', () => {
    it('两个智能体应通过 EventBus 通信', async () => {
      const agent1 = new FullAgent('agent-1', eventBus, memory, toolRegistry);
      const agent2 = new FullAgent('agent-2', eventBus, memory, toolRegistry);

      // agent-1 发布事件
      const receivedEvents: unknown[] = [];
      eventBus.subscribe('agent:completed', async (e) => {
        receivedEvents.push(e);
      });

      await agent1.execute('task-1');
      await agent2.execute('task-2');

      // 两个智能体都完成了
      expect(receivedEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('智能体间应通过 request/respond 通信', async () => {
      // 注册响应者
      eventBus.subscribe('message:request', async (e: any) => {
        const { requestId, message } = e.data;
        if (message?.target === 'responder') {
          eventBus.respond(requestId, { answer: 'response-from-responder' });
        }
      });

      class RequesterAgent extends Agent<string, string> {
        public response: unknown;
        constructor(eb: EventBus) {
          super({
            name: 'requester',
            description: 'Requester',
            eventBus: eb,
            memory: new ShortTermMemory(),
            tools: toolRegistry,
            llm: createMockLLM(),
          });
        }
        protected async plan() {
          return 'plan';
        }
        protected async act() {
          this.response = await this.send('responder', { target: 'responder' });
          return 'done';
        }
      }

      const agent = new RequesterAgent(eventBus);
      await agent.execute('test');

      expect(agent.response).toEqual({ answer: 'response-from-responder' });
    });
  });

  describe('事件追踪', () => {
    it('应发布正确的事件序列', async () => {
      const eventTypes: string[] = [];
      eventBus.subscribe('agent:started', async () => eventTypes.push('started'));
      eventBus.subscribe('agent:progress', async () => eventTypes.push('progress'));
      eventBus.subscribe('agent:completed', async () => eventTypes.push('completed'));

      const agent = new FullAgent('event-agent', eventBus, memory, toolRegistry);
      await agent.execute('event-test');

      expect(eventTypes).toEqual(['started', 'progress', 'completed']);
    });

    it('completed 事件应包含执行统计', async () => {
      const completedEvents: any[] = [];
      eventBus.subscribe('agent:completed', async (e) => completedEvents.push(e));

      const agent = new FullAgent('stats-agent', eventBus, memory, toolRegistry);
      await agent.execute('stats-test');

      const data = completedEvents[0].data;
      expect(data.iterations).toBe(1);
      expect(data.duration).toBeTypeOf('number');
      expect(data.executionId).toBeDefined();
    });
  });
});
