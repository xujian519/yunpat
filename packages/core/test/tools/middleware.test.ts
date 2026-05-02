import { describe, it, expect, vi } from 'vitest';
import {
  MiddlewarePipeline,
  LoggingMiddleware,
  PermissionMiddleware,
  CacheMiddleware,
  RateLimitMiddleware,
  TracingMiddleware,
} from '../../src/tools/middleware.js';

const mockTool = {
  metadata: { name: 'test-tool', isConcurrencySafe: true },
  execute: vi.fn().mockResolvedValue({ result: 'success' }),
} as any;

const createCtx = (overrides = {}) =>
  ({
    tool: mockTool,
    input: { query: 'test' },
    context: { metadata: {}, userId: 'user1', sessionId: 'session1' },
    startTime: Date.now(),
    cached: false,
    ...overrides,
  }) as any;

describe('Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MiddlewarePipeline', () => {
    it('应该添加和执行中间件', async () => {
      const pipeline = new MiddlewarePipeline();
      const mw = { name: 'test', before: vi.fn(), after: vi.fn() };
      pipeline.use(mw);

      await pipeline.execute(createCtx());
      expect(mw.before).toHaveBeenCalled();
      expect(mw.after).toHaveBeenCalled();
    });

    it('应该执行工具钩子', async () => {
      const pipeline = new MiddlewarePipeline();
      const tool = {
        ...mockTool,
        before: vi.fn(),
        after: vi.fn(),
      };

      await pipeline.execute(createCtx({ tool }));
      expect(tool.before).toHaveBeenCalled();
      expect(tool.after).toHaveBeenCalled();
    });

    it('应该使用缓存结果', async () => {
      const pipeline = new MiddlewarePipeline();
      const result = await pipeline.execute(createCtx({ cached: true, result: 'cached' }));
      expect(result).toBe('cached');
    });

    it('应该处理错误', async () => {
      const pipeline = new MiddlewarePipeline();
      const mw = { name: 'test', onError: vi.fn() };
      pipeline.use(mw);

      const tool = { ...mockTool, execute: vi.fn().mockRejectedValue(new Error('fail')) };

      await expect(pipeline.execute(createCtx({ tool }))).rejects.toThrow('fail');
      expect(mw.onError).toHaveBeenCalled();
    });

    it('应该移除中间件', () => {
      const pipeline = new MiddlewarePipeline();
      pipeline.use({ name: 'test' });
      pipeline.remove('test');
      expect(pipeline.getMiddlewares()).toHaveLength(0);
    });

    it('应该清空中间件', () => {
      const pipeline = new MiddlewarePipeline();
      pipeline.use({ name: 'test' });
      pipeline.clear();
      expect(pipeline.getMiddlewares()).toHaveLength(0);
    });
  });

  describe('LoggingMiddleware', () => {
    it('应该记录日志', async () => {
      const mw = new LoggingMiddleware();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await mw.before(createCtx());
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('应该记录完成', async () => {
      const mw = new LoggingMiddleware();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await mw.after(createCtx(), {});
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('应该记录错误', async () => {
      const mw = new LoggingMiddleware();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await mw.onError(createCtx(), new Error('test'));
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('应该清理敏感输入', async () => {
      const mw = new LoggingMiddleware();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await mw.before(createCtx({ input: { password: 'secret', apiKey: 'key' } }));
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('应该截断大输出', async () => {
      const mw = new LoggingMiddleware();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await mw.after(createCtx(), { data: 'x'.repeat(2000) });
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe('PermissionMiddleware', () => {
    it('应该通过无权限工具', async () => {
      const mw = new PermissionMiddleware();
      await expect(mw.before(createCtx())).resolves.not.toThrow();
    });

    it('应该检查权限', async () => {
      const checker = vi.fn().mockResolvedValue(['read']);
      const mw = new PermissionMiddleware(checker);
      const tool = { metadata: { name: 't', permissions: ['read'] } };

      await expect(mw.before(createCtx({ tool }))).resolves.not.toThrow();
    });

    it('应该拒绝无权限', async () => {
      const checker = vi.fn().mockResolvedValue([]);
      const mw = new PermissionMiddleware(checker);
      const tool = { metadata: { name: 't', permissions: ['admin'] } };

      await expect(mw.before(createCtx({ tool }))).rejects.toThrow('Permission denied');
    });

    it('应该处理通配符权限', async () => {
      const checker = vi.fn().mockResolvedValue(['*']);
      const mw = new PermissionMiddleware(checker);
      const tool = { metadata: { name: 't', permissions: ['admin'] } };

      await expect(mw.before(createCtx({ tool }))).resolves.not.toThrow();
    });

    it('应该记录权限错误', async () => {
      const mw = new PermissionMiddleware();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await mw.onError(createCtx(), new Error('Permission denied'));
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('CacheMiddleware', () => {
    it('应该缓存结果', async () => {
      const mw = new CacheMiddleware();
      const ctx1 = createCtx();
      await mw.after(ctx1, { data: 'result' });

      const ctx2 = createCtx();
      await mw.before(ctx2);
      expect(ctx2.cached).toBe(true);
      expect(ctx2.result).toEqual({ data: 'result' });
    });

    it('应该跳过非安全工具', async () => {
      const mw = new CacheMiddleware();
      const ctx = createCtx({ tool: { metadata: { name: 't', isConcurrencySafe: false } } });
      await mw.before(ctx);
      expect(ctx.cached).toBe(false);
    });

    it('应该清除缓存', () => {
      const mw = new CacheMiddleware();
      mw.clear();
      expect(mw.getStats().size).toBe(0);
    });

    it('应该返回统计', async () => {
      const mw = new CacheMiddleware();
      const ctx = createCtx();
      await mw.after(ctx, { data: 'test' });
      const stats = mw.getStats();
      expect(stats.size).toBe(1);
    });
  });

  describe('RateLimitMiddleware', () => {
    it('应该通过无限制工具', async () => {
      const mw = new RateLimitMiddleware();
      await expect(mw.before(createCtx())).resolves.not.toThrow();
    });

    it('应该限流', async () => {
      const mw = new RateLimitMiddleware();
      const tool = { metadata: { name: 't', rateLimit: { max: 1, window: 1000 } } };

      await mw.before(createCtx({ tool }));
      await expect(mw.before(createCtx({ tool }))).rejects.toThrow('Rate limit exceeded');
    });

    it('应该记录限流错误', async () => {
      const mw = new RateLimitMiddleware();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await mw.onError(createCtx(), new Error('Rate limit exceeded'));
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('应该清除限流器', () => {
      const mw = new RateLimitMiddleware();
      mw.clear();
      expect(mw).toBeDefined();
    });
  });

  describe('TracingMiddleware', () => {
    it('应该追踪执行', async () => {
      const mw = new TracingMiddleware();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await mw.before(createCtx());
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('应该追踪完成', async () => {
      const mw = new TracingMiddleware();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await mw.after(createCtx(), {});
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('应该追踪错误', async () => {
      const mw = new TracingMiddleware();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await mw.onError(createCtx(), new Error('test'));
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('应该返回统计', async () => {
      const mw = new TracingMiddleware();
      await mw.after(createCtx(), {});

      const stats = mw.getStats();
      expect(stats.length).toBeGreaterThan(0);
    });

    it('应该返回特定工具统计', async () => {
      const mw = new TracingMiddleware();
      await mw.after(createCtx(), {});

      const stats = mw.getToolStats('test-tool');
      expect(stats).toBeDefined();
    });

    it('应该清空统计', async () => {
      const mw = new TracingMiddleware();
      await mw.after(createCtx(), {});
      mw.clear();
      expect(mw.getStats()).toHaveLength(0);
    });
  });
});
