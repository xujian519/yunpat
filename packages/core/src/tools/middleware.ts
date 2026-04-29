import { ToolExecutionContext, ToolExecutionStats } from './types.js';

/**
 * 中间件接口
 */
export interface Middleware {
  name: string;

  /** 前置处理 */
  before?(ctx: ToolExecutionContext): Promise<void>;

  /** 后置处理 */
  after?(ctx: ToolExecutionContext, result: any): Promise<void>;

  /** 错误处理 */
  onError?(ctx: ToolExecutionContext, error: Error): Promise<void>;
}

/**
 * 中间件接口
 */
export interface Middleware {
  name: string;

  /** 前置处理 */
  before?(ctx: ToolExecutionContext): Promise<void>;

  /** 后置处理 */
  after?(ctx: ToolExecutionContext, result: any): Promise<void>;

  /** 错误处理 */
  onError?(ctx: ToolExecutionContext, error: Error): Promise<void>;
}

/**
 * 中间件管道
 */
export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async execute(ctx: ToolExecutionContext): Promise<any> {
    let result: any;
    let error: Error | undefined;

    try {
      // 前置中间件
      for (const mw of this.middlewares) {
        if (mw.before) {
          await mw.before(ctx);
        }
      }

      // 执行工具前置钩子
      if (ctx.tool.before) {
        await ctx.tool.before(ctx.input, ctx.context);
      }

      // 检查是否被缓存拦截
      if (!ctx.cached) {
        // 执行工具
        result = await ctx.tool.execute(ctx.input, ctx.context);
        ctx.result = result;
      } else {
        // 使用缓存结果
        result = ctx.result;
      }

      // 执行工具后置钩子
      if (ctx.tool.after) {
        await ctx.tool.after(result, ctx.context);
      }

      // 后置中间件（反向执行）
      for (let i = this.middlewares.length - 1; i >= 0; i--) {
        const mw = this.middlewares[i];
        if (mw.after) {
          await mw.after(ctx, result);
        }
      }

      return result;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      ctx.error = error;

      // 错误中间件
      for (const mw of this.middlewares) {
        if (mw.onError) {
          await mw.onError(ctx, error);
        }
      }

      throw error;
    }
  }

  /**
   * 获取所有中间件
   */
  getMiddlewares(): Middleware[] {
    return [...this.middlewares];
  }

  /**
   * 移除中间件
   */
  remove(name: string): void {
    this.middlewares = this.middlewares.filter((mw) => mw.name !== name);
  }

  /**
   * 清空所有中间件
   */
  clear(): void {
    this.middlewares = [];
  }
}

/**
 * 日志中间件
 */
export class LoggingMiddleware implements Middleware {
  name = 'logging';

  async before(ctx: ToolExecutionContext): Promise<void> {
    const input = this.sanitizeInput(ctx.input);
    console.log(`[Tool] Calling ${ctx.tool.metadata.name}`, {
      input,
      userId: ctx.context.userId,
      sessionId: ctx.context.sessionId,
    });
  }

  async after(ctx: ToolExecutionContext, result: any): Promise<void> {
    const duration = Date.now() - ctx.startTime;
    const output = this.sanitizeOutput(result);
    console.log(`[Tool] ${ctx.tool.metadata.name} completed in ${duration}ms`, {
      output,
      duration,
      cached: ctx.cached || false,
    });
  }

  async onError(ctx: ToolExecutionContext, error: Error): Promise<void> {
    const duration = Date.now() - ctx.startTime;
    console.error(`[Tool] ${ctx.tool.metadata.name} failed after ${duration}ms`, {
      error: error.message,
      stack: error.stack,
    });
  }

  /**
   * 清理敏感输入信息
   */
  private sanitizeInput(input: any): any {
    if (!input || typeof input !== 'object') {
      return input;
    }

    const sanitized = { ...input };
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'key'];

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * 清理敏感输出信息
   */
  private sanitizeOutput(output: any): any {
    // 如果输出太大，只显示摘要
    const str = JSON.stringify(output);
    if (str.length > 1000) {
      return {
        _summary: `Output too large (${str.length} chars)`,
        _type: typeof output,
        _preview: str.substring(0, 200) + '...',
      };
    }

    return output;
  }
}

/**
 * 权限中间件
 */
export class PermissionMiddleware implements Middleware {
  name = 'permission';

  /**
   * 权限检查器函数
   */
  private permissionChecker: (
    userId: string | undefined,
    permissions: string[]
  ) => Promise<string[]>;

  constructor(
    permissionChecker?: (userId: string | undefined, permissions: string[]) => Promise<string[]>
  ) {
    // 默认权限检查器：授予所有权限
    this.permissionChecker = permissionChecker || (async () => ['*']);
  }

  async before(ctx: ToolExecutionContext): Promise<void> {
    const { permissions } = ctx.tool.metadata;

    if (!permissions || permissions.length === 0) {
      return; // 无需权限
    }

    // 检查用户是否有权限
    const userPermissions = await this.permissionChecker(ctx.context.userId, permissions);

    // 检查是否有通配符权限
    if (userPermissions.includes('*')) {
      return;
    }

    // 检查每个必需的权限
    for (const requiredPermission of permissions) {
      if (!userPermissions.includes(requiredPermission)) {
        throw new Error(
          `Permission denied: '${requiredPermission}' required for tool '${ctx.tool.metadata.name}'`
        );
      }
    }
  }

  async onError(ctx: ToolExecutionContext, error: Error): Promise<void> {
    if (error.message.includes('Permission denied')) {
      console.warn(`[Permission] Access denied to tool ${ctx.tool.metadata.name}`, {
        userId: ctx.context.userId,
        requiredPermissions: ctx.tool.metadata.permissions,
      });
    }
  }
}

/**
 * 缓存中间件
 */
export class CacheMiddleware implements Middleware {
  name = 'cache';

  private cache = new Map<string, { value: any; expiry: number }>();
  private stats = {
    hits: 0,
    misses: 0,
  };

  async before(ctx: ToolExecutionContext): Promise<void> {
    // 只缓存只读工具
    if (!ctx.tool.metadata.isConcurrencySafe) {
      return;
    }

    const cacheKey = this.getCacheKey(ctx);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      // 返回缓存，跳过实际执行
      ctx.result = cached.value;
      ctx.cached = true;
      this.stats.hits++;

      console.log(`[Cache] Hit for tool ${ctx.tool.metadata.name}`);
    } else {
      this.stats.misses++;
    }
  }

  async after(ctx: ToolExecutionContext, result: any): Promise<void> {
    // 只缓存只读工具且未被拦截的结果
    if (!ctx.tool.metadata.isConcurrencySafe || ctx.cached) {
      return;
    }

    const cacheKey = this.getCacheKey(ctx);
    const ttl = this.getTTL(ctx.tool.metadata.name);

    this.cache.set(cacheKey, {
      value: result,
      expiry: Date.now() + ttl,
    });

    console.log(`[Cache] Stored result for tool ${ctx.tool.metadata.name} (TTL: ${ttl}ms)`);
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(ctx: ToolExecutionContext): string {
    const { tool, input } = ctx;
    const inputStr = JSON.stringify(input);
    return `${tool.metadata.name}:${inputStr}`;
  }

  /**
   * 获取缓存过期时间（工具特定）
   */
  private getTTL(toolName: string): number {
    // 不同工具有不同的默认 TTL
    const ttls: Record<string, number> = {
      file_read: 60000, // 1分钟
      web_search: 300000, // 5分钟
      web_fetch: 600000, // 10分钟
      grep: 30000, // 30秒
      glob: 60000, // 1分钟
    };

    return ttls[toolName] || 60000; // 默认 1分钟
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }
}

/**
 * 限流中间件
 */
export class RateLimitMiddleware implements Middleware {
  name = 'rate-limit';

  private limiters = new Map<string, RateLimiter>();

  async before(ctx: ToolExecutionContext): Promise<void> {
    const { rateLimit } = ctx.tool.metadata;

    if (!rateLimit) {
      return;
    }

    const key = `${ctx.tool.metadata.name}:${ctx.context.userId || 'anonymous'}`;
    let limiter = this.limiters.get(key);

    if (!limiter) {
      limiter = new RateLimiter(rateLimit.max, rateLimit.window);
      this.limiters.set(key, limiter);
    }

    if (!limiter.check()) {
      const resetTime = limiter.getResetTime();
      throw new Error(
        `Rate limit exceeded for tool '${ctx.tool.metadata.name}'. ` +
          `Please retry after ${Math.ceil(resetTime / 1000)} seconds.`
      );
    }
  }

  async onError(ctx: ToolExecutionContext, error: Error): Promise<void> {
    if (error.message.includes('Rate limit exceeded')) {
      console.warn(`[RateLimit] Limit exceeded for tool ${ctx.tool.metadata.name}`, {
        userId: ctx.context.userId,
      });
    }
  }

  /**
   * 清空所有限流器
   */
  clear(): void {
    this.limiters.clear();
  }
}

/**
 * 限流器
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly window: number;

  constructor(maxTokens: number, window: number) {
    this.maxTokens = maxTokens;
    this.window = window;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  check(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    // 按时间比例补充令牌
    const refill = Math.floor((elapsed / this.window) * this.maxTokens);
    this.tokens = Math.min(this.maxTokens, this.tokens + refill);
    this.lastRefill = now;

    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }

    return false;
  }

  getResetTime(): number {
    return this.window;
  }
}

/**
 * 追踪中间件
 */
export class TracingMiddleware implements Middleware {
  name = 'tracing';

  private traces = new Map<string, ToolExecutionStats>();

  async before(ctx: ToolExecutionContext): Promise<void> {
    const traceId = this.generateTraceId();

    console.log(`[Trace] Starting ${ctx.tool.metadata.name}`, {
      traceId,
      userId: ctx.context.userId,
      sessionId: ctx.context.sessionId,
      timestamp: new Date().toISOString(),
    });

    // 存储追踪信息
    ctx.context.metadata = ctx.context.metadata || {};
    ctx.context.metadata.traceId = traceId;
  }

  async after(ctx: ToolExecutionContext, result: any): Promise<void> {
    const duration = Date.now() - ctx.startTime;
    const traceId = ctx.context.metadata?.traceId;

    console.log(`[Trace] Completed ${ctx.tool.metadata.name} in ${duration}ms`, {
      traceId,
      duration,
      cached: ctx.cached || false,
    });

    // 更新统计信息
    this.updateStats(ctx.tool.metadata.name, duration, true);
  }

  async onError(ctx: ToolExecutionContext, error: Error): Promise<void> {
    const duration = Date.now() - ctx.startTime;

    console.error(`[Trace] Failed ${ctx.tool.metadata.name} after ${duration}ms`, {
      traceId: ctx.context.metadata?.traceId,
      error: error.message,
    });

    // 更新统计信息
    this.updateStats(ctx.tool.metadata.name, duration, false);
  }

  /**
   * 更新工具执行统计
   */
  private updateStats(toolName: string, duration: number, success: boolean): void {
    let stats = this.traces.get(toolName);

    if (!stats) {
      stats = {
        toolName,
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        cacheHits: 0,
        lastExecutedAt: undefined,
      };
      this.traces.set(toolName, stats);
    }

    stats.totalCalls++;
    stats.successCount += success ? 1 : 0;
    stats.errorCount += success ? 0 : 1;
    stats.avgDuration = (stats.avgDuration * (stats.totalCalls - 1) + duration) / stats.totalCalls;
    stats.minDuration = Math.min(stats.minDuration, duration);
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    stats.lastExecutedAt = new Date();
  }

  /**
   * 获取所有工具的统计信息
   */
  getStats(): ToolExecutionStats[] {
    return Array.from(this.traces.values());
  }

  /**
   * 获取特定工具的统计信息
   */
  getToolStats(toolName: string): ToolExecutionStats | undefined {
    return this.traces.get(toolName);
  }

  /**
   * 生成追踪 ID
   */
  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 清空所有统计信息
   */
  clear(): void {
    this.traces.clear();
  }
}
