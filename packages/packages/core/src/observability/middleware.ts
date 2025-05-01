/**
 * Express 中间件：自动收集 HTTP 指标
 */

import { Request, Response, NextFunction } from 'express'
import { recordHttpRequest, getMetrics } from './metrics.js'

/**
 * HTTP 请求指标中间件
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()

  // 记录响应完成
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000 // 转换为秒
    const route = req.route ? req.route.path : req.path

    recordHttpRequest(req.method, route, res.statusCode, duration)
  })

  next()
}

/**
 * Metrics 端点处理器
 */
export async function metricsHandler(req: Request, res: Response) {
  const metrics = await getMetrics()
  res.set('Content-Type', 'text/plain')
  res.send(metrics)
}
