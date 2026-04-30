/**
 * 测试 Mock 工厂
 *
 * 为核心模块提供轻量级 mock 实现，避免依赖外部服务
 */

import { Agent } from '../../src/agent/Agent.js';
import { EventBus } from '../../src/eventbus/EventBus.js';
import { ShortTermMemory } from '../../src/memory/MemoryStore.js';
import { ToolRegistry, ToolWrapper } from '../../src/tools/ToolRegistry.js';
import type {
  LLMAdapter,
  ChatParams,
  ChatResponse,
  ChatChunk,
  ExecutionContext,
  MemoryStore,
  Tool,
} from '../../src/lifecycle/Lifecycle.js';

/**
 * 创建 mock LLM 适配器
 */
export function createMockLLM(responses?: Partial<ChatResponse>): LLMAdapter {
  const defaultResponse: ChatResponse = {
    message: {
      role: 'assistant',
      content: 'mock response',
    },
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    },
  };

  const response = { ...defaultResponse, ...responses };

  return {
    chat: async (_params: ChatParams) => response,
    chatStream: async function* (_params: ChatParams): AsyncIterable<ChatChunk> {
      yield { delta: 'mock', done: false };
      yield { delta: '', done: true };
    },
    embed: async (texts: string[]) =>
      texts.map((_, i) => Array(128).fill(0).map((_, j) => (i * 128 + j) % 7 === 0 ? 1 : 0)),
  };
}

/**
 * 创建 mock MemoryStore
 */
export function createMockMemory(): MemoryStore {
  const store = new Map<string, unknown>();
  return {
    get: async (key: string) => store.get(key),
    set: async (key: string, value: unknown) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    has: async (key: string) => store.has(key),
    getAll: async () => Object.fromEntries(store.entries()),
    clear: async () => { store.clear(); },
    search: async () => [],
  };
}

/**
 * 创建 mock 工具
 */
export function createMockTool(name: string, result: unknown = 'mock-tool-result'): Tool {
  return new ToolWrapper(
    name,
    `Mock tool: ${name}`,
    async () => result,
  );
}

/**
 * 创建完整 mock 的 ToolRegistry
 */
export function createMockToolRegistry(tools?: Tool[]): ToolRegistry {
  const eventBus = new EventBus();
  const registry = new ToolRegistry(eventBus);

  const defaultTools = tools ?? [
    createMockTool('mock-tool-1', 'result-1'),
    createMockTool('mock-tool-2', 'result-2'),
  ];

  for (const tool of defaultTools) {
    registry.register(tool);
  }

  return registry;
}

/**
 * 最小可测试的 Agent 子类
 *
 * 暴露 protected 方法供测试调用
 */
export class TestAgent extends Agent<string, string> {
  private planFn: (input: string, context: ExecutionContext) => Promise<unknown>;
  private actFn: (plan: unknown, context: ExecutionContext) => Promise<unknown>;

  // 跟踪钩子调用顺序
  public callLog: string[] = [];

  constructor(
    planFn?: (input: string, context: ExecutionContext) => Promise<unknown>,
    actFn?: (plan: unknown, context: ExecutionContext) => Promise<unknown>,
    options?: {
      eventBus?: EventBus;
      memory?: MemoryStore;
      tools?: ToolRegistry;
      llm?: LLMAdapter;
      maxIterations?: number;
    },
  ) {
    super({
      name: 'test-agent',
      description: 'Test agent for unit tests',
      eventBus: options?.eventBus ?? new EventBus(),
      memory: options?.memory ?? new ShortTermMemory(),
      tools: options?.tools ?? createMockToolRegistry(),
      llm: options?.llm ?? createMockLLM(),
      maxIterations: options?.maxIterations,
    });

    this.planFn = planFn ?? (async (input) => `plan: ${input}`);
    this.actFn = actFn ?? (async (plan) => `act: ${String(plan)}`);
  }

  protected async before(input: string, _context: ExecutionContext): Promise<void> {
    this.callLog.push(`before:${input}`);
  }

  protected async init(_context: ExecutionContext): Promise<void> {
    this.callLog.push('init');
  }

  protected async plan(input: string, context: ExecutionContext): Promise<unknown> {
    this.callLog.push('plan');
    return this.planFn(input, context);
  }

  protected async act(plan: unknown, context: ExecutionContext): Promise<unknown> {
    this.callLog.push('act');
    return this.actFn(plan, context);
  }

  protected async reflect(result: unknown, _context: ExecutionContext): Promise<unknown> {
    this.callLog.push('reflect');
    return { shouldContinue: false, quality: 'good', result };
  }

  protected async after(_input: string, _output: string, _context: ExecutionContext): Promise<void> {
    this.callLog.push('after');
  }
}

/**
 * 创建带完整依赖的 TestAgent
 */
export function createTestAgent(overrides?: {
  planFn?: (input: string, context: ExecutionContext) => Promise<unknown>;
  actFn?: (plan: unknown, context: ExecutionContext) => Promise<unknown>;
  eventBus?: EventBus;
  memory?: MemoryStore;
  maxIterations?: number;
  reflectFn?: (result: unknown, context: ExecutionContext) => Promise<unknown>;
}): {
  agent: TestAgent;
  eventBus: EventBus;
  memory: ShortTermMemory;
  toolRegistry: ToolRegistry;
} {
  const eventBus = overrides?.eventBus ?? new EventBus();
  const memory = new ShortTermMemory();
  const toolRegistry = createMockToolRegistry();
  const llm = createMockLLM();

  const agent = new TestAgent(
    overrides?.planFn,
    overrides?.actFn,
    {
      eventBus,
      memory,
      tools: toolRegistry,
      llm,
      maxIterations: overrides?.maxIterations,
    },
  );

  return { agent, eventBus, memory, toolRegistry };
}
