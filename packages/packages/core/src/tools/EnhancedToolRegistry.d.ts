import { EventBus } from '../eventbus/EventBus.js'
import {
  EnhancedTool,
  ToolCategory,
  ToolContext,
  ToolExecutionStats,
  ToolMetadata,
} from './types.js'
import { MiddlewarePipeline } from './middleware.js'
/**
 * 增强的工具注册表
 *
 * 特性：
 * - 中间件管道支持
 * - 智能并发控制
 * - 工具分类管理
 * - 执行统计
 * - MCP 工具集成
 */
export declare class EnhancedToolRegistry {
  /** 工具存储 */
  private tools
  /** 中间件管道 */
  private middleware
  /** 事件总线 */
  private eventBus
  /** 工具分类索引 */
  private categoryIndex
  /** MCP 工具索引 */
  private mcpIndex
  constructor(eventBus: EventBus)
  /**
   * 注册工具
   */
  register<TInput, TOutput>(tool: EnhancedTool<TInput, TOutput>): void
  /**
   * 批量注册工具
   */
  registerBatch(tools: EnhancedTool[]): void
  /**
   * 注销工具
   */
  unregister(name: string): void
  /**
   * 调用工具（带中间件）
   */
  call<TInput, TOutput>(name: string, input: TInput, context: ToolContext): Promise<TOutput>
  /**
   * 批量调用工具（智能并发）
   */
  callBatch<TInput, TOutput>(
    calls: Array<{
      name: string
      input: TInput
    }>,
    context: ToolContext
  ): Promise<TOutput[]>
  /**
   * 获取工具
   */
  get(name: string): EnhancedTool | undefined
  /**
   * 检查工具是否存在
   */
  has(name: string): boolean
  /**
   * 列出所有工具
   */
  list(): EnhancedTool[]
  /**
   * 按分类获取工具
   */
  getByCategory(category: ToolCategory): EnhancedTool[]
  /**
   * 获取 MCP 工具
   */
  getByMcpServer(serverName: string): EnhancedTool[]
  /**
   * 获取工具数量
   */
  size(): number
  /**
   * 清空所有工具
   */
  clear(): void
  /**
   * 添加中间件
   */
  addMiddleware(middleware: any): void
  /**
   * 移除中间件
   */
  removeMiddleware(name: string): void
  /**
   * 获取中间件管道
   */
  getMiddleware(): MiddlewarePipeline
  /**
   * 获取工具执行统计
   */
  getStats(): ToolExecutionStats[]
  /**
   * 获取特定工具的统计
   */
  getToolStats(toolName: string): ToolExecutionStats | undefined
  /**
   * 注册默认中间件
   */
  private registerDefaultMiddleware
  /**
   * 验证工具元数据
   */
  private validateMetadata
  /**
   * 验证输入参数
   */
  private validateInput
}
/**
 * 基础工具类
 *
 * 提供工具的默认实现
 */
export declare abstract class BaseTool<TInput = any, TOutput = any> implements EnhancedTool<
  TInput,
  TOutput
> {
  abstract readonly metadata: ToolMetadata<TInput, TOutput>
  abstract execute(input: TInput, context: ToolContext): Promise<TOutput>
  before?(input: TInput, context: ToolContext): Promise<void>
  after?(output: TOutput, context: ToolContext): Promise<void>
}
/**
 * 工具包装器
 *
 * 将普通函数包装为工具
 */
export declare class ToolWrapperClass<TInput = any, TOutput = any> extends BaseTool<
  TInput,
  TOutput
> {
  readonly metadata: ToolMetadata<TInput, TOutput>
  private executor
  constructor(
    metadata: ToolMetadata<TInput, TOutput>,
    executor: (input: TInput, context: ToolContext) => Promise<TOutput>
  )
  execute(input: TInput, context: ToolContext): Promise<TOutput>
}
//# sourceMappingURL=EnhancedToolRegistry.d.ts.map
