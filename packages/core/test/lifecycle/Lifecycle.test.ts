/**
 * Lifecycle 类型系统测试
 */

import { describe, it, expect } from 'vitest';
import {
  LifecycleStage,
  type ExecutionContext,
  type MemoryStore,
  type EventBus,
  type ToolRegistry,
  type LLMAdapter,
  type AgentEvent,
  type Subscription,
  type Tool,
  type ChatParams,
  type ChatResponse,
  type ChatMessage,
  type ChatChunk,
} from '../../src/lifecycle/Lifecycle.js';

describe('Lifecycle', () => {
  describe('LifecycleStage 枚举', () => {
    it('应包含所有 6 个阶段', () => {
      expect(Object.values(LifecycleStage)).toHaveLength(6);
    });

    it('阶段值应为小写字符串', () => {
      const stages = Object.values(LifecycleStage);
      for (const stage of stages) {
        expect(stage).toBe(stage.toLowerCase());
        expect(stage).not.toMatch(/\s/);
      }
    });

    it('阶段应按正确顺序排列', () => {
      const values = Object.values(LifecycleStage);
      expect(values[0]).toBe('before');
      expect(values[1]).toBe('init');
      expect(values[2]).toBe('plan');
      expect(values[3]).toBe('act');
      expect(values[4]).toBe('reflect');
      expect(values[5]).toBe('after');
    });

    it('应可通过值查找枚举', () => {
      expect(LifecycleStage.BEFORE).toBe('before');
      expect(LifecycleStage.INIT).toBe('init');
      expect(LifecycleStage.PLAN).toBe('plan');
      expect(LifecycleStage.ACT).toBe('act');
      expect(LifecycleStage.REFLECT).toBe('reflect');
      expect(LifecycleStage.AFTER).toBe('after');
    });
  });

  describe('ExecutionContext 接口', () => {
    it('应能构造符合接口的对象', () => {
      const mockMemory: MemoryStore = {
        get: async () => undefined,
        set: async () => {},
        delete: async () => {},
        has: async () => false,
        getAll: async () => ({}),
        clear: async () => {},
        search: async () => [],
      };

      const mockEventBus: EventBus = {
        publish: () => {},
        subscribe: () => ({
          id: '1',
          pattern: '*',
          handler: async () => {},
          unsubscribe: () => {},
        }),
        unsubscribe: () => {},
        request: async () => undefined,
      };

      const mockToolRegistry: ToolRegistry = {
        register: () => {},
        unregister: () => {},
        get: () => undefined,
        call: async () => undefined,
        list: () => [],
      };

      const mockLLM: LLMAdapter = {
        chat: async () => ({ message: { role: 'assistant', content: '' } }),
        chatStream: async function* () {},
        embed: async () => [],
      };

      const context: ExecutionContext = {
        executionId: 'test-exec-1',
        agentName: 'test-agent',
        startTime: new Date(),
        currentStage: LifecycleStage.BEFORE,
        memory: mockMemory,
        eventBus: mockEventBus,
        tools: mockToolRegistry,
        llm: mockLLM,
        metadata: {},
        sharedState: new Map(),
      };

      expect(context.executionId).toBe('test-exec-1');
      expect(context.currentStage).toBe(LifecycleStage.BEFORE);
      expect(context.sharedState).toBeInstanceOf(Map);
    });
  });

  describe('AgentEvent 接口', () => {
    it('应包含必需字段', () => {
      const event: AgentEvent = {
        type: 'agent:started',
        source: 'test-agent',
        data: { input: 'test' },
        timestamp: new Date(),
      };

      expect(event.type).toBe('agent:started');
      expect(event.source).toBe('test-agent');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('target 字段应为可选', () => {
      const event: AgentEvent = {
        type: 'message',
        source: 'a',
        target: 'b',
        data: null,
        timestamp: new Date(),
      };

      expect(event.target).toBe('b');
    });
  });

  describe('ChatParams 类型', () => {
    it('应支持最小参数', () => {
      const params: ChatParams = {
        messages: [{ role: 'user', content: 'hello' }],
      };

      expect(params.messages).toHaveLength(1);
    });

    it('应支持完整参数', () => {
      const params: ChatParams = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'hello' },
        ],
        temperature: 0.7,
        maxTokens: 100,
        stopSequences: ['\n'],
        tools: [{ name: 'search', description: 'Search' }],
      };

      expect(params.temperature).toBe(0.7);
      expect(params.maxTokens).toBe(100);
    });
  });

  describe('Tool 接口', () => {
    it('应定义必需字段', () => {
      const tool: Tool = {
        name: 'test-tool',
        description: 'A test tool',
        execute: async (input) => `result: ${input}`,
      };

      expect(tool.name).toBe('test-tool');
      expect(tool.inputSchema).toBeUndefined();
    });
  });
});
