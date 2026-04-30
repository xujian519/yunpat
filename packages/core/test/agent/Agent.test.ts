/**
 * Agent 基类测试
 *
 * 覆盖完整的生命周期钩子、事件发布、通信、错误处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../../src/agent/Agent.js';
import { EventBus } from '../../src/eventbus/EventBus.js';
import { ShortTermMemory } from '../../src/memory/MemoryStore.js';
import { ToolRegistry, ToolWrapper } from '../../src/tools/ToolRegistry.js';
import { createMockLLM, createMockToolRegistry, createTestAgent } from '../helpers/mocks.js';
import type { ExecutionContext, AgentEvent } from '../../src/lifecycle/Lifecycle.js';

/**
 * 灵活的测试 Agent，支持自定义 reflect 行为
 */
class FlexibleTestAgent extends Agent<string, string> {
  public callLog: string[] = [];
  private shouldContinueReflect = false;
  private reflectCount = 0;

  constructor(eventBus: EventBus, options?: { shouldContinueReflect?: boolean }) {
    super({
      name: 'flexible-agent',
      description: 'Flexible test agent',
      eventBus,
      memory: new ShortTermMemory(),
      tools: createMockToolRegistry(),
      llm: createMockLLM(),
    });
    this.shouldContinueReflect = options?.shouldContinueReflect ?? false;
  }

  protected async before(input: string) {
    this.callLog.push(`before:${input}`);
  }

  protected async init() {
    this.callLog.push('init');
  }

  protected async plan(input: string) {
    this.callLog.push('plan');
    return `plan: ${input}`;
  }

  protected async act(plan: unknown) {
    this.callLog.push('act');
    return `result: ${String(plan)}`;
  }

  protected async reflect(result: unknown) {
    this.callLog.push('reflect');
    this.reflectCount++;
    if (this.shouldContinueReflect && this.reflectCount < 3) {
      return { shouldContinue: true, result };
    }
    return { shouldContinue: false, result };
  }

  protected async after(input: string, output: string) {
    this.callLog.push('after');
  }
}

describe('Agent', () => {
  describe('生命周期', () => {
    it('应按正确顺序调用所有钩子', async () => {
      const { agent } = createTestAgent();
      await agent.execute('test-input');

      expect(agent.callLog).toEqual([
        'before:test-input',
        'init',
        'plan',
        'act',
        'reflect',
        'after',
      ]);
    });

    it('init 应只调用一次', async () => {
      const { agent } = createTestAgent();
      await agent.execute('first');
      await agent.execute('second');

      const initCalls = agent.callLog.filter((c) => c === 'init');
      expect(initCalls).toHaveLength(1);
    });

    it('无 before/init/reflect/after 时应正常执行', async () => {
      class MinimalAgent extends Agent<string, string> {
        protected async plan(input: string) {
          return input;
        }
        protected async act(plan: unknown) {
          return `done: ${String(plan)}`;
        }
        constructor() {
          super({
            name: 'minimal',
            description: 'minimal agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          });
        }
      }

      const agent = new MinimalAgent();
      const result = await agent.execute('hello');

      expect(result).toBe('done: hello');
    });

    it('reset 后 init 应再次调用', async () => {
      const { agent } = createTestAgent();
      await agent.execute('first');
      agent.reset();
      agent.callLog = [];
      await agent.execute('second');

      expect(agent.callLog).toContain('init');
    });
  });

  describe('act 循环', () => {
    it('reflect 返回 shouldContinue=true 时应继续循环', async () => {
      const eventBus = new EventBus();
      const agent = new FlexibleTestAgent(eventBus, { shouldContinueReflect: true });

      const result = await agent.execute('loop-test');

      // 应循环 3 次（reflect 在前 2 次返回 continue，第 3 次停止）
      const actCalls = agent.callLog.filter((c) => c === 'act');
      expect(actCalls.length).toBeGreaterThanOrEqual(2);
      expect(result).toBeDefined();
    });

    it('应受 maxIterations 限制', async () => {
      class LoopAgent extends Agent<string, string> {
        public iterations = 0;
        constructor() {
          super({
            name: 'loop-agent',
            description: 'loop agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            maxIterations: 3,
          });
        }
        protected async plan() {
          return 'plan';
        }
        protected async act() {
          this.iterations++;
          return 'result';
        }
        protected async reflect(result: unknown) {
          return { shouldContinue: true, result };
        }
      }

      const agent = new LoopAgent();
      await agent.execute('test');

      expect(agent.iterations).toBe(3);
    });

    it('默认 maxIterations 应为 10', async () => {
      class CountAgent extends Agent<string, string> {
        public iterations = 0;
        constructor() {
          super({
            name: 'count-agent',
            description: 'count agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          });
        }
        protected async plan() {
          return 'plan';
        }
        protected async act() {
          this.iterations++;
          return 'result';
        }
        protected async reflect(result: unknown) {
          return { shouldContinue: true, result };
        }
      }

      const agent = new CountAgent();
      await agent.execute('test');

      expect(agent.iterations).toBe(10);
    });
  });

  describe('事件发布', () => {
    it('应发布 agent:started 事件', async () => {
      const eventBus = new EventBus();
      const events: AgentEvent[] = [];
      eventBus.subscribe('agent:started', async (e) => events.push(e));

      const { agent } = createTestAgent({ eventBus });
      await agent.execute('test');

      expect(events).toHaveLength(1);
      const data = events[0].data as Record<string, unknown>;
      expect(data.input).toBe('test');
      expect(data.executionId).toBeDefined();
    });

    it('应发布 agent:completed 事件包含 duration 和 iterations', async () => {
      const eventBus = new EventBus();
      const events: AgentEvent[] = [];
      eventBus.subscribe('agent:completed', async (e) => events.push(e));

      const { agent } = createTestAgent({ eventBus });
      await agent.execute('test');

      expect(events).toHaveLength(1);
      const data = events[0].data as Record<string, unknown>;
      expect(data.duration).toBeTypeOf('number');
      expect(data.iterations).toBeTypeOf('number');
      expect(data.executionId).toBeDefined();
    });

    it('异常时应发布 agent:error 事件', async () => {
      const eventBus = new EventBus();
      const events: AgentEvent[] = [];
      eventBus.subscribe('agent:error', async (e) => events.push(e));

      class ErrorAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'error-agent',
            description: 'error agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          });
        }
        protected async plan() {
          throw new Error('plan failed');
        }
        protected async act() {
          return 'never';
        }
      }

      const agent = new ErrorAgent();
      await expect(agent.execute('test')).rejects.toThrow('plan failed');

      expect(events).toHaveLength(1);
      const data = events[0].data as Record<string, unknown>;
      expect(data.error).toBe('plan failed');
    });

    it('每次迭代应发布 agent:progress 事件', async () => {
      const eventBus = new EventBus();
      const events: AgentEvent[] = [];
      eventBus.subscribe('agent:progress', async (e) => events.push(e));

      const agent = new FlexibleTestAgent(eventBus, { shouldContinueReflect: true });
      await agent.execute('progress-test');

      expect(events.length).toBeGreaterThanOrEqual(2);
      const first = events[0].data as Record<string, unknown>;
      expect(first.iteration).toBe(1);
      expect(first.shouldContinue).toBe(true);
    });
  });

  describe('通信', () => {
    it('on() 应订阅事件总线', async () => {
      const eventBus = new EventBus();
      const received: unknown[] = [];

      class ListenerAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'listener',
            description: 'listener agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          });
          this.on('test:event', async (e) => received.push(e));
        }
        protected async plan() {
          return 'plan';
        }
        protected async act() {
          return 'done';
        }
      }

      const agent = new ListenerAgent();
      eventBus.publish({
        type: 'test:event',
        source: 'other',
        data: 'hello',
        timestamp: new Date(),
      });

      expect(received).toHaveLength(1);
    });

    it('send() 应通过事件总线发送请求', async () => {
      const eventBus = new EventBus();

      // 注册响应者：监听 request 事件并通过 respond 回复
      eventBus.subscribe('message:request', async (e) => {
        const reqData = e.data as Record<string, unknown>;
        if (reqData.requestId) {
          eventBus.respond(reqData.requestId as string, { result: 'response-data' });
        }
      });

      class SenderAgent extends Agent<string, string> {
        public sendResult: unknown;
        constructor() {
          super({
            name: 'sender',
            description: 'sender agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          });
        }
        protected async plan() {
          return 'plan';
        }
        protected async act() {
          this.sendResult = await this.send('target-agent', { type: 'request' });
          return 'done';
        }
      }

      const agent = new SenderAgent();
      await agent.execute('test');

      expect(agent.sendResult).toEqual({ result: 'response-data' });
    });
  });

  describe('错误处理', () => {
    it('plan 抛出异常应发布 error 事件并重新抛出', async () => {
      const eventBus = new EventBus();
      const errors: AgentEvent[] = [];
      eventBus.subscribe('agent:error', async (e) => errors.push(e));

      class PlanFailAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'plan-fail',
            description: 'plan fail agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          });
        }
        protected async plan() {
          throw new Error('plan error');
        }
        protected async act() {
          return 'never';
        }
      }

      const agent = new PlanFailAgent();
      await expect(agent.execute('test')).rejects.toThrow('plan error');
      expect(errors).toHaveLength(1);
    });

    it('act 抛出异常应发布 error 事件并重新抛出', async () => {
      const eventBus = new EventBus();
      const errors: AgentEvent[] = [];
      eventBus.subscribe('agent:error', async (e) => errors.push(e));

      class ActFailAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'act-fail',
            description: 'act fail agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          });
        }
        protected async plan() {
          return 'plan';
        }
        protected async act() {
          throw new Error('act error');
        }
      }

      const agent = new ActFailAgent();
      await expect(agent.execute('test')).rejects.toThrow('act error');
      expect(errors).toHaveLength(1);
    });

    it('无 act 结果时应抛出错误', async () => {
      // 这个场景在 while 循环不可能发生（至少执行一次 act）
      // 但如果 maxIterations=0 则可能触发
      class NoResultAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'no-result',
            description: 'no result agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            maxIterations: 0,
          });
        }
        protected async plan() {
          return 'plan';
        }
        protected async act() {
          return 'result';
        }
      }

      const agent = new NoResultAgent();
      await expect(agent.execute('test')).rejects.toThrow('No result produced');
    });

    it('非 Error 类型的异常应正常包装', async () => {
      const eventBus = new EventBus();
      const errors: AgentEvent[] = [];
      eventBus.subscribe('agent:error', async (e) => errors.push(e));

      class StringErrorAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'string-error',
            description: 'string error agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          });
        }
        protected async plan() {
          throw 'string error';
        }
        protected async act() {
          return 'never';
        }
      }

      const agent = new StringErrorAgent();
      await expect(agent.execute('test')).rejects.toBe('string error');
      const errData = errors[0].data as Record<string, unknown>;
      expect(errData.error).toBe('string error');
    });
  });

  describe('ExecutionContext', () => {
    it('plan 阶段 context 应包含正确字段', async () => {
      let capturedContext: ExecutionContext | undefined;

      class ContextAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'context-agent',
            description: 'context agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          });
        }
        protected async plan(input: string, context: ExecutionContext) {
          capturedContext = context;
          return 'plan';
        }
        protected async act() {
          return 'done';
        }
      }

      const agent = new ContextAgent();
      await agent.execute('test');

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.executionId).toBeDefined();
      expect(capturedContext!.agentName).toBe('context-agent');
      expect(capturedContext!.startTime).toBeInstanceOf(Date);
      expect(capturedContext!.metadata).toEqual({});
      expect(capturedContext!.sharedState).toBeInstanceOf(Map);
      expect(capturedContext!.memory).toBeDefined();
      expect(capturedContext!.eventBus).toBeDefined();
      expect(capturedContext!.tools).toBeDefined();
      expect(capturedContext!.llm).toBeDefined();
    });

    it('sharedState 应在不同钩子间共享', async () => {
      let sharedValue: unknown;

      class SharedAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'shared-agent',
            description: 'shared agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          });
        }
        protected async plan(_input: string, context: ExecutionContext) {
          context.sharedState.set('key', 'plan-value');
          return 'plan';
        }
        protected async act(_plan: unknown, context: ExecutionContext) {
          sharedValue = context.sharedState.get('key');
          return 'done';
        }
      }

      const agent = new SharedAgent();
      await agent.execute('test');

      expect(sharedValue).toBe('plan-value');
    });
  });
});
