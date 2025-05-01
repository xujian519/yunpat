/**
 * Express 中间件：自动收集 HTTP 指标
 */
import { recordHttpRequest, getMetrics } from './metrics'
/**
 * HTTP 请求指标中间件
 */
export function metricsMiddleware(req, res, next) {
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
export async function metricsHandler(req, res) {
  const metrics = await getMetrics()
  res.set('Content-Type', 'text/plain')
  res.send(metrics)
}
//# sourceMappingURL=middleware.js.map
