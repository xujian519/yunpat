import { ToolExecutionContext, ToolExecutionStats } from './types.js'
/**
 * 中间件接口
 */
export interface Middleware {
  name: string
  /** 前置处理 */
  before?(ctx: ToolExecutionContext): Promise<void>
  /** 后置处理 */
  after?(ctx: ToolExecutionContext, result: unknown): Promise<void>
  /** 错误处理 */
  onError?(ctx: ToolExecutionContext, error: Error): Promise<void>
}
/**
 * 中间件接口
 */
export interface Middleware {
  name: string
  /** 前置处理 */
  before?(ctx: ToolExecutionContext): Promise<void>
  /** 后置处理 */
  after?(ctx: ToolExecutionContext, result: unknown): Promise<void>
  /** 错误处理 */
  onError?(ctx: ToolExecutionContext, error: Error): Promise<void>
}
/**
 * 中间件管道
 */
export declare class MiddlewarePipeline {
  private middlewares
  use(middleware: Middleware): void
  execute(ctx: ToolExecutionContext): Promise<unknown>
  /**
   * 获取所有中间件
   */
  getMiddlewares(): Middleware[]
  /**
   * 移除中间件
   */
  remove(name: string): void
  /**
   * 清空所有中间件
   */
  clear(): void
}
/**
 * 日志中间件
 */
export declare class LoggingMiddleware implements Middleware {
  name: string
  before(ctx: ToolExecutionContext): Promise<void>
  after(ctx: ToolExecutionContext, result: unknown): Promise<void>
  onError(ctx: ToolExecutionContext, error: Error): Promise<void>
  /**
   * 清理敏感输入信息
   */
  private sanitizeInput
  /**
   * 清理敏感输出信息
   */
  private sanitizeOutput
}
/**
 * 权限中间件
 */
export declare class PermissionMiddleware implements Middleware {
  name: string
  /**
   * 权限检查器函数
   */
  private permissionChecker
  constructor(
    permissionChecker?: (userId: string | undefined, permissions: string[]) => Promise<string[]>
  )
  before(ctx: ToolExecutionContext): Promise<void>
  onError(ctx: ToolExecutionContext, error: Error): Promise<void>
}
/**
 * 缓存中间件
 */
export declare class CacheMiddleware implements Middleware {
  name: string
  private cache
  private stats
  before(ctx: ToolExecutionContext): Promise<void>
  after(ctx: ToolExecutionContext, result: unknown): Promise<void>
  /**
   * 生成缓存键
   */
  private getCacheKey
  /**
   * 获取缓存过期时间（工具特定）
   */
  private getTTL
  /**
   * 清空缓存
   */
  clear(): void
  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number
    hitRate: number
    hits: number
    misses: number
  }
}
/**
 * 限流中间件
 */
export declare class RateLimitMiddleware implements Middleware {
  name: string
  private limiters
  before(ctx: ToolExecutionContext): Promise<void>
  onError(ctx: ToolExecutionContext, error: Error): Promise<void>
  /**
   * 清空所有限流器
   */
  clear(): void
}
/**
 * 追踪中间件
 */
export declare class TracingMiddleware implements Middleware {
  name: string
  private traces
  before(ctx: ToolExecutionContext): Promise<void>
  after(ctx: ToolExecutionContext, _result: unknown): Promise<void>
  onError(ctx: ToolExecutionContext, error: Error): Promise<void>
  /**
   * 更新工具执行统计
   */
  private updateStats
  /**
   * 获取所有工具的统计信息
   */
  getStats(): ToolExecutionStats[]
  /**
   * 获取特定工具的统计信息
   */
  getToolStats(toolName: string): ToolExecutionStats | undefined
  /**
   * 生成追踪 ID
   */
  private generateTraceId
  /**
   * 清空所有统计信息
   */
  clear(): void
}
//# sourceMappingURL=middleware.d.ts.map
