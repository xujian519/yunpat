import { z } from 'zod'
import { EventBus } from '../eventbus/EventBus.js'
import {
  EnhancedTool,
  ToolCategory,
  ToolContext,
  ToolExecutionContext,
  ToolExecutionStats,
  ToolMetadata,
} from './types.js'
import {
  MiddlewarePipeline,
  LoggingMiddleware,
  PermissionMiddleware,
  CacheMiddleware,
  RateLimitMiddleware,
  TracingMiddleware,
} from './middleware.js'

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
export class EnhancedToolRegistry {
  /** 工具存储 */
  private tools = new Map<string, EnhancedTool>()

  /** 中间件管道 */
  private middleware: MiddlewarePipeline

  /** 事件总线 */
  private eventBus: EventBus

  /** 工具分类索引 */
  private categoryIndex = new Map<ToolCategory, Set<string>>()

  /** MCP 工具索引 */
  private mcpIndex = new Map<string, Set<string>>()

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
    this.middleware = new MiddlewarePipeline()

    // 注册默认中间件
    this.registerDefaultMiddleware()
  }

  /**
   * 注册工具
   */
  register<TInput, TOutput>(tool: EnhancedTool<TInput, TOutput>): void {
    const { name } = tool.metadata

    if (this.tools.has(name)) {
      throw new Error(`Tool already registered: ${name}`)
    }

    // 验证元数据
    this.validateMetadata(tool.metadata)

    // 注册到工具表
    this.tools.set(name, tool)

    // 更新分类索引
    if (tool.metadata.category) {
      const categoryTools = this.categoryIndex.get(tool.metadata.category) || new Set()
      categoryTools.add(name)
      this.categoryIndex.set(tool.metadata.category, categoryTools)
    }

    // 更新 MCP 索引
    if (tool.metadata.isMcp && tool.metadata.mcpServer) {
      const mcpTools = this.mcpIndex.get(tool.metadata.mcpServer) || new Set()
      mcpTools.add(name)
      this.mcpIndex.set(tool.metadata.mcpServer, mcpTools)
    }

    // 发布工具注册事件
    this.eventBus.publish({
      type: 'tool:registered',
      source: 'EnhancedToolRegistry',
      data: {
        toolName: name,
        category: tool.metadata.category,
        isMcp: tool.metadata.isMcp || false,
        mcpServer: tool.metadata.mcpServer,
      },
      timestamp: new Date(),
    })
  }

  /**
   * 批量注册工具
   */
  registerBatch(tools: EnhancedTool[]): void {
    for (const tool of tools) {
      this.register(tool)
    }
  }

  /**
   * 注销工具
   */
  unregister(name: string): void {
    const tool = this.tools.get(name) as EnhancedTool

    if (!tool) {
      throw new Error(`Tool not found: ${name}`)
    }

    // 从分类索引中移除
    if (tool.metadata.category) {
      const categoryTools = this.categoryIndex.get(tool.metadata.category)
      if (categoryTools) {
        categoryTools.delete(name)
        if (categoryTools.size === 0) {
          this.categoryIndex.delete(tool.metadata.category)
        }
      }
    }

    // 从 MCP 索引中移除
    if (tool.metadata.isMcp && tool.metadata.mcpServer) {
      const mcpTools = this.mcpIndex.get(tool.metadata.mcpServer)
      if (mcpTools) {
        mcpTools.delete(name)
        if (mcpTools.size === 0) {
          this.mcpIndex.delete(tool.metadata.mcpServer)
        }
      }
    }

    // 从工具表中移除
    this.tools.delete(name)

    // 发布工具注销事件
    this.eventBus.publish({
      type: 'tool:unregistered',
      source: 'EnhancedToolRegistry',
      data: { toolName: name },
      timestamp: new Date(),
    })
  }

  /**
   * 调用工具（带中间件）
   */
  async call<TInput, TOutput>(name: string, input: TInput, context: ToolContext): Promise<TOutput> {
    const tool = this.tools.get(name) as EnhancedTool<TInput, TOutput>

    if (!tool) {
      throw new Error(`Tool not found: ${name}`)
    }

    // 验证输入参数
    const validatedInput = await this.validateInput(tool, input)

    // 构建执行上下文
    const executionContext: ToolExecutionContext = {
      tool,
      input: validatedInput,
      context: {
        ...context,
        registry: this as unknown as ToolContext['registry'],
      },
      startTime: Date.now(),
    }

    // 通过中间件管道执行
    return (await this.middleware.execute(executionContext)) as TOutput
  }

  /**
   * 批量调用工具（智能并发）
   */
  async callBatch<TInput, TOutput>(
    calls: Array<{ name: string; input: TInput }>,
    context: ToolContext
  ): Promise<TOutput[]> {
    if (calls.length === 0) {
      return []
    }

    // 分离只读工具和写工具
    const readOnlyCalls: Array<{ name: string; input: TInput; index: number }> = []
    const writeCalls: Array<{ name: string; input: TInput; index: number }> = []

    for (let i = 0; i < calls.length; i++) {
      const tool = this.tools.get(calls[i].name) as EnhancedTool
      if (tool?.metadata.isConcurrencySafe) {
        readOnlyCalls.push({ ...calls[i], index: i })
      } else {
        writeCalls.push({ ...calls[i], index: i })
      }
    }

    // 并发执行只读工具
    const readOnlyPromises = readOnlyCalls.map(async (call) => {
      const result = await this.call(call.name, call.input, context)
      return { index: call.index, result }
    })

    const readOnlyResults = await Promise.all(readOnlyPromises)

    // 串行执行写工具
    const writeResults: Array<{ index: number; result: unknown }> = []
    for (const call of writeCalls) {
      const result = await this.call(call.name, call.input, context)
      writeResults.push({ index: call.index, result })
    }

    // 合并结果（保持原始顺序）
    const allResults = [...readOnlyResults, ...writeResults]
    allResults.sort((a, b) => a.index - b.index)

    return allResults.map((r) => r.result) as TOutput[]
  }

  /**
   * 获取工具
   */
  get(name: string): EnhancedTool | undefined {
    return this.tools.get(name)
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 列出所有工具
   */
  list(): EnhancedTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 按分类获取工具
   */
  getByCategory(category: ToolCategory): EnhancedTool[] {
    const toolNames = this.categoryIndex.get(category) || new Set()
    return Array.from(toolNames)
      .map((name) => this.tools.get(name))
      .filter(Boolean) as EnhancedTool[]
  }

  /**
   * 获取 MCP 工具
   */
  getByMcpServer(serverName: string): EnhancedTool[] {
    const toolNames = this.mcpIndex.get(serverName) || new Set()
    return Array.from(toolNames)
      .map((name) => this.tools.get(name))
      .filter(Boolean) as EnhancedTool[]
  }

  /**
   * 获取工具数量
   */
  size(): number {
    return this.tools.size
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear()
    this.categoryIndex.clear()
    this.mcpIndex.clear()
  }

  /**
   * 添加中间件
   */
  addMiddleware(middleware: any): void {
    this.middleware.use(middleware)
  }

  /**
   * 移除中间件
   */
  removeMiddleware(name: string): void {
    this.middleware.remove(name)
  }

  /**
   * 获取中间件管道
   */
  getMiddleware(): MiddlewarePipeline {
    return this.middleware
  }

  /**
   * 获取工具执行统计
   */
  getStats(): ToolExecutionStats[] {
    const tracingMiddleware = this.middleware
      .getMiddlewares()
      .find((mw) => mw.name === 'tracing') as TracingMiddleware

    if (!tracingMiddleware) {
      return []
    }

    return tracingMiddleware.getStats()
  }

  /**
   * 获取特定工具的统计
   */
  getToolStats(toolName: string): ToolExecutionStats | undefined {
    const tracingMiddleware = this.middleware
      .getMiddlewares()
      .find((mw) => mw.name === 'tracing') as TracingMiddleware

    if (!tracingMiddleware) {
      return undefined
    }

    return tracingMiddleware.getToolStats(toolName)
  }

  /**
   * 注册默认中间件
   */
  private registerDefaultMiddleware(): void {
    // 日志中间件
    this.middleware.use(new LoggingMiddleware())

    // 权限中间件（使用默认检查器）
    this.middleware.use(new PermissionMiddleware())

    // 缓存中间件
    this.middleware.use(new CacheMiddleware())

    // 限流中间件
    this.middleware.use(new RateLimitMiddleware())

    // 追踪中间件
    this.middleware.use(new TracingMiddleware())
  }

  /**
   * 验证工具元数据
   */
  private validateMetadata(metadata: ToolMetadata): void {
    if (!metadata.name || metadata.name.trim() === '') {
      throw new Error('Tool name is required')
    }

    if (!metadata.description) {
      throw new Error('Tool description is required')
    }

    if (!metadata.inputSchema) {
      throw new Error('Tool inputSchema is required')
    }

    // 验证工具名称格式（只允许字母、数字、下划线、连字符）
    const nameRegex = /^[a-zA-Z0-9_-]+$/
    if (!nameRegex.test(metadata.name)) {
      throw new Error(
        `Tool name '${metadata.name}' is invalid. ` +
          `Only letters, numbers, underscores, and hyphens are allowed.`
      )
    }
  }

  /**
   * 验证输入参数
   */
  private async validateInput<TInput>(tool: EnhancedTool<TInput>, input: unknown): Promise<TInput> {
    try {
      return await tool.metadata.inputSchema.parseAsync(input)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }))

        throw new Error(
          `Invalid input for tool '${tool.metadata.name}':\n` +
            issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n')
        )
      }

      throw error
    }
  }
}

/**
 * 基础工具类
 *
 * 提供工具的默认实现
 */
export abstract class BaseTool<TInput = any, TOutput = any> implements EnhancedTool<
  TInput,
  TOutput
> {
  abstract readonly metadata: ToolMetadata<TInput, TOutput>

  abstract execute(input: TInput, context: ToolContext): Promise<TOutput>

  // 可选钩子（子类可覆盖）
  async before?(input: TInput, context: ToolContext): Promise<void>

  async after?(output: TOutput, context: ToolContext): Promise<void>
}

/**
 * 工具包装器
 *
 * 将普通函数包装为工具
 */
export class ToolWrapperClass<TInput = any, TOutput = any> extends BaseTool<TInput, TOutput> {
  readonly metadata: ToolMetadata<TInput, TOutput>

  private executor: (input: TInput, context: ToolContext) => Promise<TOutput>

  constructor(
    metadata: ToolMetadata<TInput, TOutput>,
    executor: (input: TInput, context: ToolContext) => Promise<TOutput>
  ) {
    super()
    this.metadata = metadata
    this.executor = executor
  }

  async execute(input: TInput, context: ToolContext): Promise<TOutput> {
    return await this.executor(input, context)
  }
}
