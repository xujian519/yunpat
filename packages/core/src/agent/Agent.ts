import { v4 as uuidv4 } from 'uuid';
import {
  LifecycleStage,
  ExecutionContext,
  EventBus,
  MemoryStore,
  ToolRegistry,
  LLMAdapter,
  AgentEvent,
} from '../lifecycle/Lifecycle.js';

/**
 * 智能体配置
 */
export interface AgentConfig {
  /** 智能体名称 */
  name: string;

  /** 智能体描述 */
  description: string;

  /** 事件总线 */
  eventBus: EventBus;

  /** 记忆存储 */
  memory: MemoryStore;

  /** 工具注册表 */
  tools: ToolRegistry;

  /** LLM 适配器 */
  llm: LLMAdapter;

  /** 最大执行循环次数（act 阶段） */
  maxIterations?: number;

  /** 执行超时时间（毫秒） */
  timeout?: number;
}

/**
 * 智能体抽象基类
 *
 * 核心设计原则：
 * 1. 框架"笨" - 只提供生命周期管理和通用能力
 * 2. 智能体"专" - 业务逻辑由子类实现
 * 3. 通信解耦 - 通过事件总线与其他智能体通信
 *
 * @template TInput 输入类型
 * @template TOutput 输出类型
 */
export abstract class Agent<TInput = any, TOutput = any> {
  /** 智能体名称 */
  readonly name: string;

  /** 智能体描述 */
  readonly description: string;

  /** 事件总线 */
  protected readonly eventBus: EventBus;

  /** 记忆存储 */
  protected readonly memory: MemoryStore;

  /** 工具注册表 */
  protected readonly tools: ToolRegistry;

  /** LLM 适配器 */
  protected readonly llm: LLMAdapter;

  /** 最大执行循环次数 */
  protected readonly maxIterations: number;

  /** 执行超时时间 */
  protected readonly timeout: number;

  /** 是否已初始化 */
  private initialized = false;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.description = config.description;
    this.eventBus = config.eventBus;
    this.memory = config.memory;
    this.tools = config.tools;
    this.llm = config.llm;
    this.maxIterations = config.maxIterations ?? 10;
    this.timeout = config.timeout ?? 300000; // 默认 5 分钟
  }

  /**
   * 前置钩子（可选）
   *
   * 在所有处理之前调用，可用于：
   * - 输入验证
   * - 预处理
   * - 权限检查
   */
  protected before?(input: TInput, context: ExecutionContext): Promise<void>;

  /**
   * 初始化钩子（可选，仅首次调用）
   *
   * 在首次执行时调用一次，可用于：
   * - 加载配置
   * - 初始化资源
   * - 预热模型
   */
  protected init?(context: ExecutionContext): Promise<void>;

  /**
   * 规划钩子（必需）
   *
   * 核心推理阶段，生成执行计划。
   * 这是智能体的主要"思考"环节。
   *
   * @param input 用户输入
   * @param context 执行上下文
   * @returns 执行计划
   */
  protected abstract plan(input: TInput, context: ExecutionContext): Promise<unknown>;

  /**
   * 执行钩子（必需）
   *
   * 按计划执行行动。
   * 可能被多次调用（循环执行），直到目标达成或达到最大次数。
   *
   * @param plan 执行计划
   * @param context 执行上下文
   * @returns 执行结果
   */
  protected abstract act(plan: any, context: ExecutionContext): Promise<unknown>;

  /**
   * 反思钩子（可选）
   *
   * 评估执行结果，决定是否继续执行。
   * 可用于：
   * - 质量检查
   * - 错误恢复
   * - 迭代改进
   *
   * @param result 执行结果
   * @param context 执行上下文
   * @returns 反思结果，包含 shouldContinue 标志
   */
  protected reflect?(result: unknown, context: ExecutionContext): Promise<unknown>;

  /**
   * 后置钩子（可选）
   *
   * 在所有处理之后调用，可用于：
   * - 输出格式化
   * - 日志记录
   * - 资源清理
   */
  protected after?(input: TInput, output: TOutput, context: ExecutionContext): Promise<void>;

  /**
   * 执行入口 - 框架控制生命周期
   *
   * 执行流程：
   * 1. before 钩子
   * 2. init 钩子（仅首次）
   * 3. emit agent:started
   * 4. plan 钩子
   * 5. 循环：act 钩子（可能多次）
   * 6. reflect 钩子（检查是否继续）
   * 7. after 钩子
   * 8. emit agent:completed
   *
   * 如果配置了事务管理器，整个执行过程将在事务保护下进行：
   * - 自动创建快照
   * - 失败自动回滚
   *
   * @param input 输入
   * @returns 输出
   */
  async execute(input: TInput): Promise<TOutput> {
    // 直接执行（无需事务管理器）
    return this.executeInternal(input);
  }

  /**
   * 内部执行逻辑
   */
  private async executeInternal(input: TInput): Promise<TOutput> {
    const executionId = uuidv4();
    const startTime = new Date();

    // 创建执行上下文
    const context: ExecutionContext = {
      executionId,
      agentName: this.name,
      startTime,
      currentStage: LifecycleStage.BEFORE,
      memory: this.memory,
      eventBus: this.eventBus,
      tools: this.tools,
      llm: this.llm,
      metadata: {},
      sharedState: new Map(),
    };

    try {
      // 1. before 钩子
      if (this.before) {
        context.currentStage = LifecycleStage.BEFORE;
        await this.before(input, context);
      }

      // 2. init 钩子（仅首次）
      if (!this.initialized && this.init) {
        context.currentStage = LifecycleStage.INIT;
        await this.init(context);
        this.initialized = true;
      }

      // 3. 发送启动事件
      this.publishEvent('agent:started', {
        input,
        executionId,
        timestamp: startTime,
      });

      // 4. plan 阶段
      context.currentStage = LifecycleStage.PLAN;
      const plan = await this.plan(input, context);

      // 5. act 阶段（循环执行）
      context.currentStage = LifecycleStage.ACT;
      let result: unknown;
      let iterations = 0;
      let shouldContinue = true;

      while (shouldContinue && iterations < this.maxIterations) {
        result = await this.act(plan, context);
        iterations++;

        // 6. reflect 阶段（检查是否继续）
        if (this.reflect) {
          context.currentStage = LifecycleStage.REFLECT;
          const reflection = await this.reflect(result, context);

          // 如果反思返回了 shouldContinue 标志，使用它
          if (reflection && typeof reflection === 'object') {
            shouldContinue =
              ((reflection as Record<string, unknown>).shouldContinue as boolean) ?? false;
          } else {
            shouldContinue = false;
          }
        } else {
          // 没有 reflect 钩子，只执行一次
          shouldContinue = false;
        }

        // 发送进度事件
        this.publishEvent('agent:progress', {
          iteration: iterations,
          result,
          shouldContinue,
        });
      }

      // 7. after 钩子
      if (!result) {
        throw new Error('No result produced after act phase');
      }
      const output = result as unknown as TOutput;
      if (this.after) {
        context.currentStage = LifecycleStage.AFTER;
        await this.after(input, output, context);
      }

      // 8. 发送完成事件
      this.publishEvent('agent:completed', {
        output,
        executionId,
        iterations,
        duration: Date.now() - startTime.getTime(),
      });

      return output;
    } catch (error) {
      // 发送错误事件
      this.publishEvent('agent:error', {
        error: error instanceof Error ? error.message : String(error),
        executionId,
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  }

  /**
   * 订阅其他智能体的事件
   *
   * @param pattern 事件模式
   * @param handler 事件处理器
   * @returns 订阅
   */
  protected on(pattern: string, handler: (event: AgentEvent) => void | Promise<void>) {
    return this.eventBus.subscribe(pattern, handler);
  }

  /**
   * 向其他智能体发送消息
   *
   * @param target 目标智能体
   * @param message 消息内容
   * @returns 响应
   */
  protected async send(target: string, message: unknown): Promise<unknown> {
    return this.eventBus.request(target, message);
  }

  /**
   * 发布事件
   *
   * @param type 事件类型
   * @param data 事件数据
   */
  private publishEvent(type: string, data: unknown) {
    const event: AgentEvent = {
      type,
      source: this.name,
      data,
      timestamp: new Date(),
    };

    this.eventBus.publish(event);
  }

  /**
   * 重置智能体状态
   */
  reset(): void {
    this.initialized = false;
  }
}
