import {
  LifecycleStage,
  ExecutionContext,
  EventBus,
  MemoryStore,
  ToolRegistry,
  LLMAdapter,
  AgentEvent,
} from '../lifecycle/Lifecycle.js'
import { ApprovalFlow, ApprovalResponse } from '../gateway/ApprovalFlow.js'
import {
  CheckpointManager,
  CheckpointManagerConfig,
  type Checkpoint,
} from '../memory/CheckpointManager.js'
export interface AgentConfig {
  name: string
  description: string
  eventBus: EventBus
  memory: MemoryStore
  tools: ToolRegistry
  llm: LLMAdapter
  maxIterations?: number
  timeout?: number
  approvalFlow?: ApprovalFlow
  approvalStages?: LifecycleStage[]
  checkpointManager?: CheckpointManager
  enableCheckpoints?: boolean
  checkpointConfig?: CheckpointManagerConfig
}
/**
 * 智能体抽象基类
 *
 * 核心设计：
 * - 框架只提供生命周期管理
 * - 业务逻辑由子类实现
 * - 通过事件总线通信
 */
export declare abstract class Agent<TInput = any, TOutput = any> {
  readonly name: string
  readonly description: string
  protected readonly eventBus: EventBus
  protected readonly memory: MemoryStore
  protected readonly tools: ToolRegistry
  protected readonly llm: LLMAdapter
  protected readonly maxIterations: number
  protected readonly timeout: number
  private initialized
  protected approvalFlow?: ApprovalFlow
  protected approvalStages?: LifecycleStage[]
  protected checkpointManager?: CheckpointManager
  protected enableCheckpoints?: boolean
  constructor(config: AgentConfig)
  protected before?(input: TInput, context: ExecutionContext): Promise<void>
  protected init?(context: ExecutionContext): Promise<void>
  protected abstract plan(input: TInput, context: ExecutionContext): Promise<unknown>
  protected abstract act(plan: unknown, context: ExecutionContext): Promise<unknown>
  protected reflect?(result: unknown, context: ExecutionContext): Promise<unknown>
  protected after?(input: TInput, output: TOutput, context: ExecutionContext): Promise<void>
  execute(input: TInput): Promise<TOutput>
  private executeInternal
  protected on(
    pattern: string,
    handler: (event: AgentEvent) => void | Promise<void>
  ): import('../index.js').Subscription
  protected send(target: string, message: unknown): Promise<unknown>
  private publishEvent
  reset(): void
  protected shouldRequestApproval(stage: LifecycleStage): boolean
  protected requestApprovalIfNeeded(
    result: unknown,
    context: ExecutionContext
  ): Promise<ApprovalResponse>
  protected saveCheckpointIfEnabled(
    executionId: string,
    iteration: number,
    context: ExecutionContext,
    stageName: string,
    additionalData?: Record<string, unknown>
  ): Promise<void>
  resumeFromCheckpoint(
    checkpointId: string,
    executionId?: string
  ): Promise<{
    checkpoint: Checkpoint
    context: Record<string, unknown>
  }>
  getTools(): ToolRegistry
  getLlm(): LLMAdapter
  protected safeParseJSON(content: unknown): Record<string, unknown> | null
}
//# sourceMappingURL=Agent.d.ts.map
