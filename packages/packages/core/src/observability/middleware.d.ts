/**
 * Express 中间件：自动收集 HTTP 指标
 */
import { Request, Response, NextFunction } from 'express'
/**
 * HTTP 请求指标中间件
 */
export declare function metricsMiddleware(req: Request, res: Response, next: NextFunction): void
/**
 * Metrics 端点处理器
 */
export declare function metricsHandler(req: Request, res: Response): Promise<void>
//# sourceMappingURL=middleware.d.ts.map
