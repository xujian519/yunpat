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
import {
  ReasoningCache,
  createReasoningCache,
  type ReasoningCacheStats,
} from '../reasoning/ReasoningCache.js';
import { ReasoningMonitor } from '../reasoning/ReasoningMonitor.js';
import { ApprovalFlow, ApprovalResponse } from '../gateway/ApprovalFlow.js';
import { CheckpointManager, CheckpointManagerConfig, type Checkpoint } from '../memory/CheckpointManager.js';

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

  /** ========== 性能优化配置 ========== */

  /** 是否启用推理缓存 */
  enableReasoningCache?: boolean;

  /** 缓存配置 */
  cacheConfig?: {
    maxEntries?: number;
    similarityThreshold?: number;
    ttl?: number;
  };

  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;

  /** 推理策略选择 */
  reasoningStrategy?: 'auto' | 'always-cache' | 'never-cache';

  /** ========== 人机协作配置 ========== */

  /** 审批流程（可选） */
  approvalFlow?: ApprovalFlow;

  /** 哪些生命周期阶段需要人工审批 */
  approvalStages?: LifecycleStage[];

  /** 检查点管理器（可选） */
  checkpointManager?: CheckpointManager;

  /** 是否启用自动检查点 */
  enableCheckpoints?: boolean;

  /** 检查点配置 */
  checkpointConfig?: CheckpointManagerConfig;
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

  /** 推理缓存（可选） */
  protected reasoningCache?: ReasoningCache<unknown>;

  /** 性能监控（可选） */
  protected performanceMonitor?: ReasoningMonitor;

  /** ========== 人机协作字段 ========== */

  /** 审批流程（可选） */
  protected approvalFlow?: ApprovalFlow;

  /** 需要审批的生命周期阶段 */
  protected approvalStages?: LifecycleStage[];

  /** 检查点管理器（可选） */
  protected checkpointManager?: CheckpointManager;

  /** 是否启用自动检查点 */
  protected enableCheckpoints?: boolean;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.description = config.description;
    this.eventBus = config.eventBus;
    this.memory = config.memory;
    this.tools = config.tools;
    this.llm = config.llm;
    this.maxIterations = config.maxIterations ?? 10;
    this.timeout = config.timeout ?? 300000; // 默认 5 分钟

    // 初始化性能优化功能
    this.initializePerformanceFeatures(config);

    // 初始化人机协作功能
    this.initializeCollaborationFeatures(config);
  }

  /**
   * 初始化性能优化功能
   */
  private initializePerformanceFeatures(config: AgentConfig): void {
    // 初始化推理缓存
    if (config.enableReasoningCache) {
      this.reasoningCache = createReasoningCache(config.cacheConfig);
    }

    // 初始化性能监控
    if (config.enablePerformanceMonitoring) {
      this.performanceMonitor = new ReasoningMonitor();
    }
  }

  /**
   * 初始化人机协作功能
   */
  private initializeCollaborationFeatures(config: AgentConfig): void {
    // 初始化审批流程
    this.approvalFlow = config.approvalFlow;
    this.approvalStages = config.approvalStages;

    // 初始化检查点管理器
    this.enableCheckpoints = config.enableCheckpoints ?? false;

    if (config.checkpointManager) {
      this.checkpointManager = config.checkpointManager;
    } else if (this.enableCheckpoints && config.checkpointConfig) {
      // 如果启用了检查点但没有提供管理器，创建一个新的
      this.checkpointManager = new CheckpointManager(config.checkpointConfig);
    }
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
  protected abstract act(plan: unknown, context: ExecutionContext): Promise<unknown>;

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
    let iteration = 0;

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

        // 保存init检查点
        await this.saveCheckpointIfEnabled(executionId, iteration, context, 'init');
      }

      // 3. 发送启动事件
      this.publishEvent('agent:started', {
        input,
        executionId,
        timestamp: startTime,
      });

      // 4. plan 阶段
      context.currentStage = LifecycleStage.PLAN;
      let plan = await this.plan(input, context);

      // 保存plan检查点
      await this.saveCheckpointIfEnabled(executionId, ++iteration, context, 'plan', { plan });

      // 如果配置了plan阶段审批，请求审批
      if (this.shouldRequestApproval(LifecycleStage.PLAN)) {
        const approval = await this.requestApprovalIfNeeded(plan, context);
        if (!approval.approved) {
          throw new Error('Plan阶段未通过审批');
        }
        // 如果有修正，使用修正后的plan
        if (approval.feedback?.corrections) {
          plan = approval.feedback.corrections.plan as unknown;
        }
      }

      // 5. act 阶段（循环执行）
      context.currentStage = LifecycleStage.ACT;
      let result: unknown;
      let iterations = 0;
      let shouldContinue = true;

      while (shouldContinue && iterations < this.maxIterations) {
        result = await this.act(plan, context);
        iterations++;

        // 保存act检查点（每次迭代）
        await this.saveCheckpointIfEnabled(
          executionId,
          ++iteration,
          context,
          `act-iter${iterations}`,
          { result, iteration: iterations }
        );

        // 6. reflect 阶段（检查是否继续）
        if (this.reflect) {
          context.currentStage = LifecycleStage.REFLECT;
          const reflection = await this.reflect(result, context);

          // 保存reflect检查点
          await this.saveCheckpointIfEnabled(
            executionId,
            iteration,
            context,
            `reflect-iter${iterations}`,
            { reflection }
          );

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

        // 如果配置了act阶段审批，请求审批（最后一次迭代后）
        if (!shouldContinue && this.shouldRequestApproval(LifecycleStage.ACT)) {
          const approval = await this.requestApprovalIfNeeded(result, context);
          if (!approval.approved) {
            throw new Error('Act阶段未通过审批');
          }
          // 如果有修正，使用修正后的result并继续
          if (approval.feedback?.corrections) {
            result = approval.feedback.corrections.result as unknown;
            shouldContinue = true; // 继续执行
          }
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

      // 保存completed检查点
      await this.saveCheckpointIfEnabled(
        executionId,
        ++iteration,
        context,
        'completed',
        { output }
      );

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

  // ========== 性能优化辅助方法 ==========

  /**
   * 查询推理缓存
   *
   * @param cacheKey 缓存键（问题或任务描述）
   * @param threshold 相似度阈值（可选）
   * @returns 缓存查询结果
   */
  protected async queryCache<T = any>(
    cacheKey: string,
    threshold?: number
  ): Promise<{ found: boolean; result?: T; similarity?: number }> {
    if (!this.reasoningCache) {
      return { found: false };
    }

    const result = await this.reasoningCache.query(cacheKey, threshold);
    return {
      found: result.found,
      result: result.result as T | undefined,
      similarity: result.similarity,
    };
  }

  /**
   * 存储到推理缓存
   *
   * @param cacheKey 缓存键
   * @param result 结果
   * @param tokensUsed Token 消耗
   */
  protected async storeToCache<T = any>(
    cacheKey: string,
    result: T,
    tokensUsed: number
  ): Promise<void> {
    if (this.reasoningCache) {
      await this.reasoningCache.store(cacheKey, result, tokensUsed);
    }
  }

  /**
   * 获取性能统计
   *
   * @returns 性能统计信息
   */
  getPerformanceStats(): {
    cache?: ReasoningCacheStats;
    monitor?: ReturnType<ReasoningMonitor['getMetrics']>;
  } {
    const stats: {
      cache?: ReasoningCacheStats;
      monitor?: ReturnType<ReasoningMonitor['getMetrics']>;
    } = {};

    if (this.reasoningCache) {
      (stats as any).cache = this.reasoningCache.getStats();
    }

    if (this.performanceMonitor) {
      (stats as any).monitor = this.performanceMonitor.getMetrics();
    }

    return stats;
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    if (this.reasoningCache) {
      this.reasoningCache.clear();
    }
  }

  /**
   * 获取工具注册表（供WorkflowEngine等外部模块访问）
   */
  getTools(): ToolRegistry {
    return this.tools;
  }

  /**
   * 获取LLM适配器（供WorkflowEngine等外部模块访问）
   */
  getLlm(): LLMAdapter {
    return this.llm;
  }

  // ========== 人机协作辅助方法 ==========

  /**
   * 检查是否需要请求审批
   *
   * @param stage 生命周期阶段
   * @returns 是否需要审批
   */
  protected shouldRequestApproval(stage: LifecycleStage): boolean {
    return this.approvalFlow !== undefined && this.approvalStages?.includes(stage) === true;
  }

  /**
   * 请求审批（如果需要）
   *
   * @param result 结果数据
   * @param context 执行上下文
   * @returns 审批响应
   */
  protected async requestApprovalIfNeeded(
    result: unknown,
    context: ExecutionContext
  ): Promise<ApprovalResponse> {
    if (!this.approvalFlow) {
      // 没有配置审批流程，自动批准
      return {
        approvalId: uuidv4(),
        approved: true,
        timestamp: new Date(),
      };
    }

    return this.approvalFlow.requestApproval(result, context);
  }

  /**
   * 保存检查点（如果启用）
   *
   * @param executionId 执行ID
   * @param iteration 迭代次数
   * @param context 执行上下文
   * @param stageName 阶段名称
   * @param additionalData 额外数据（可选）
   */
  protected async saveCheckpointIfEnabled(
    executionId: string,
    iteration: number,
    context: ExecutionContext,
    stageName: string,
    additionalData?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enableCheckpoints || !this.checkpointManager) {
      return;
    }

    try {
      // 收集记忆快照
      const memorySnapshot = await this.memory.getAll();

      // 收集上下文快照
      const contextSnapshot: Record<string, unknown> = {
        executionId: context.executionId,
        agentName: context.agentName,
        currentStage: context.currentStage,
        metadata: context.metadata,
      };

      // 收集状态快照
      const stateSnapshot: Record<string, unknown> = {
        initialized: this.initialized,
        ...additionalData,
      };

      await this.checkpointManager.saveCheckpoint(
        this.name,
        executionId,
        iteration,
        memorySnapshot,
        contextSnapshot,
        stateSnapshot,
        [stageName],
        `阶段: ${stageName}`
      );

      console.log(`[Agent] 检查点已保存: ${stageName} (迭代 ${iteration})`);
    } catch (error) {
      console.error(`[Agent] 保存检查点失败: ${error}`);
      // 不抛出错误，继续执行
    }
  }

  /**
   * 从检查点恢复执行
   *
   * @param checkpointId 检查点ID
   * @param executionId 执行ID（可选）
   * @returns 恢复的检查点
   */
  async resumeFromCheckpoint(
    checkpointId: string,
    executionId?: string
  ): Promise<{
    checkpoint: Checkpoint;
    context: Record<string, unknown>;
  }> {
    if (!this.checkpointManager) {
      throw new Error('CheckpointManager 未配置，无法恢复检查点');
    }

    const checkpoint = await this.checkpointManager.loadCheckpoint(checkpointId, executionId);

    if (!checkpoint) {
      throw new Error(`检查点不存在: ${checkpointId}`);
    }

    // 恢复内存快照
    if (checkpoint.memorySnapshot && typeof checkpoint.memorySnapshot === 'object' && this.memory) {
      try {
        await this.memory.setAll(checkpoint.memorySnapshot);
      } catch (err) {
        console.error(`[Agent] 恢复内存快照失败: ${err}`);
      }
    }

    // 恢复初始化状态
    if (
      checkpoint.stateSnapshot &&
      typeof checkpoint.stateSnapshot === 'object' &&
      !Array.isArray(checkpoint.stateSnapshot) &&
      'initialized' in checkpoint.stateSnapshot
    ) {
      const state = checkpoint.stateSnapshot as Record<string, unknown>;
      this.initialized = typeof state.initialized === 'boolean' ? state.initialized : false;
    }

    console.log(`[Agent] 已从检查点恢复: ${checkpointId} (迭代 ${checkpoint.iteration})`);

    return {
      checkpoint,
      context: checkpoint.contextSnapshot ?? {},
    };
  }

  /**
   * 导出性能报告
   *
   * @returns 性能报告文本
   */
  exportPerformanceReport(): string {
    let report = `=== ${this.name} 性能报告 ===\n\n`;

    const stats = this.getPerformanceStats();

    if (stats.cache) {
      report += `## 缓存统计\n`;
      report += `总条目数: ${stats.cache.totalEntries}\n`;
      report += `命中次数: ${stats.cache.hits}\n`;
      report += `未命中次数: ${stats.cache.misses}\n`;
      report += `命中率: ${(stats.cache.hitRate * 100).toFixed(1)}%\n`;
      report += `节省Token: ${stats.cache.tokensSaved}\n`;
      report += `总Token: ${stats.cache.totalTokens}\n`;
      report += `平均相似度: ${(stats.cache.avgSimilarity * 100).toFixed(1)}%\n\n`;
    }

    if (stats.monitor) {
      report += `## 推理统计\n`;
      report += `总推理次数: ${stats.monitor.totalInferences}\n`;
      report += `总耗时: ${(stats.monitor.totalDuration / 1000).toFixed(2)}s\n`;
      report += `平均耗时: ${stats.monitor.avgDuration.toFixed(2)}ms\n`;
      report += `最小耗时: ${stats.monitor.minDuration}ms\n`;
      report += `最大耗时: ${stats.monitor.maxDuration}ms\n`;
      report += `P50/P95/P99: ${stats.monitor.p50Duration}ms / ${stats.monitor.p95Duration}ms / ${stats.monitor.p99Duration}ms\n`;
      report += `Token消耗: ${stats.monitor.totalTokens}\n`;
    }

    return report;
  }
}
