/**
 * 文件系统检查点存储
 *
 * 将检查点序列化为JSON文件存储到磁盘，支持进程重启后恢复
 */
import { promises as fs, existsSync, mkdirSync } from 'fs'
import * as path from 'path'
import { resolve, normalize } from 'path'
/**
 * 超时配置
 */
const TIMEOUT_CONFIG = {
  READ_TIMEOUT: 5000, // 文件读取超时（5秒）
  WRITE_TIMEOUT: 10000, // 文件写入超时（10秒）
  DIR_TIMEOUT: 3000, // 目录操作超时（3秒）
}
/**
 * 为Promise添加超时处理
 */
function withTimeout(promise, timeoutMs, operation) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operation} 超时 (${timeoutMs}ms)`))
    }, timeoutMs)
  })
  return Promise.race([promise, timeout])
}
/**
 * 清理executionId，防止路径遍历攻击
 */
function sanitizeExecutionId(executionId) {
  // 移除路径遍历字符
  const sanitized = normalize(executionId).replace(/\.\./g, '')
  // 只保留安全字符（字母、数字、连字符、下划线）
  const safeId = sanitized.replace(/[^a-zA-Z0-9-_]/g, '_')
  // 限制长度，防止路径过长
  return safeId.substring(0, 100)
}
/**
 * 验证并安全地连接路径
 */
function safeJoin(rootDir, executionId) {
  const safeId = sanitizeExecutionId(executionId)
  // 解析为绝对路径
  const fullPath = resolve(rootDir, safeId)
  // 验证路径仍在rootDir内
  const resolvedRoot = resolve(rootDir)
  if (!fullPath.startsWith(resolvedRoot)) {
    throw new Error(`非法executionId: ${executionId}`)
  }
  return fullPath
}
/**
 * 文件系统检查点存储
 */
export class FileSystemCheckpointStore {
  rootDir
  constructor(config) {
    this.rootDir = config?.rootDir ?? 'data/checkpoints'
    this.initialize()
  }
  /**
   * 初始化存储（同步，确保目录存在）
   */
  initialize() {
    try {
      if (!existsSync(this.rootDir)) {
        mkdirSync(this.rootDir, { recursive: true })
      }
    } catch (error) {
      console.error(`[检查点存储] 初始化失败: ${error}`)
    }
  }
  /**
   * 保存检查点
   */
  async save(checkpoint) {
    const executionDir = safeJoin(this.rootDir, checkpoint.executionId)
    // 使用checkpoint.id中的时间戳，而不是当前时间
    const timestamp = checkpoint.timestamp.getTime()
    const filename = `${checkpoint.iteration}-${timestamp}.json`
    const filepath = path.join(executionDir, filename)
    try {
      // 确保执行目录存在（带超时）
      await withTimeout(
        fs.mkdir(executionDir, { recursive: true }),
        TIMEOUT_CONFIG.DIR_TIMEOUT,
        '创建目录'
      )
      // 序列化为JSON
      const data = JSON.stringify(checkpoint, null, 2)
      // 写入文件（带超时）
      await withTimeout(
        fs.writeFile(filepath, data, 'utf-8'),
        TIMEOUT_CONFIG.WRITE_TIMEOUT,
        '写入文件'
      )
      console.log(`[检查点存储] 已保存到: ${filepath}`)
    } catch (error) {
      console.error({
        message: '[检查点存储] 保存失败',
        checkpointId: checkpoint.id,
        executionId: checkpoint.executionId,
        filepath,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }
  /**
   * 加载检查点
   */
  async load(checkpointId, executionId) {
    // 如果没有提供executionId，从checkpointId中提取
    const execId = executionId ?? this.extractExecutionId(checkpointId)
    if (!execId) {
      throw new Error(`无法从检查点ID提取执行ID: ${checkpointId}`)
    }
    const executionDir = safeJoin(this.rootDir, execId)
    try {
      // 列出该执行目录下的所有检查点文件（带超时）
      const files = await withTimeout(
        fs.readdir(executionDir),
        TIMEOUT_CONFIG.DIR_TIMEOUT,
        '列出目录'
      )
      const checkpointFiles = files.filter((f) => f.endsWith('.json'))
      // 查找匹配的检查点文件
      for (const file of checkpointFiles) {
        const filepath = path.join(executionDir, file)
        const data = await withTimeout(
          fs.readFile(filepath, 'utf-8'),
          TIMEOUT_CONFIG.READ_TIMEOUT,
          '读取文件'
        )
        const checkpoint = JSON.parse(data)
        if (checkpoint.id === checkpointId) {
          return checkpoint
        }
      }
      throw new Error(`检查点不存在: ${checkpointId}`)
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`执行目录不存在: ${executionDir}`)
      }
      console.error({
        message: '[检查点存储] 加载失败',
        checkpointId,
        executionId: execId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }
  /**
   * 列出执行的所有检查点
   */
  async listCheckpoints(executionId) {
    const executionDir = path.join(this.rootDir, executionId)
    try {
      const files = await withTimeout(
        fs.readdir(executionDir),
        TIMEOUT_CONFIG.DIR_TIMEOUT,
        '列出目录'
      )
      const checkpointFiles = files.filter((f) => f.endsWith('.json'))
      const checkpoints = []
      for (const file of checkpointFiles) {
        const filepath = path.join(executionDir, file)
        const data = await withTimeout(
          fs.readFile(filepath, 'utf-8'),
          TIMEOUT_CONFIG.READ_TIMEOUT,
          '读取文件'
        )
        const checkpoint = JSON.parse(data)
        // 恢复Date对象
        checkpoint.timestamp = new Date(checkpoint.timestamp)
        checkpoints.push(checkpoint)
      }
      // 按迭代次数排序
      return checkpoints.sort((a, b) => a.iteration - b.iteration)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [] // 目录不存在，返回空数组
      }
      console.error({
        message: '[检查点存储] 列出检查点失败',
        executionId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }
  /**
   * 列出所有可恢复的执行
   */
  async listResumableExecutions() {
    try {
      const executionDirs = await withTimeout(
        fs.readdir(this.rootDir),
        TIMEOUT_CONFIG.DIR_TIMEOUT,
        '列出根目录'
      )
      const executions = []
      for (const execDir of executionDirs) {
        const executionDir = path.join(this.rootDir, execDir)
        // 检查是否是目录（带超时）
        const stat = await withTimeout(
          fs.stat(executionDir),
          TIMEOUT_CONFIG.DIR_TIMEOUT,
          '获取文件状态'
        )
        if (!stat.isDirectory()) {
          continue
        }
        // 读取该执行的最新检查点
        const checkpoints = await this.listCheckpoints(execDir)
        if (checkpoints.length > 0) {
          const latest = checkpoints[checkpoints.length - 1]
          executions.push({
            executionId: execDir,
            agentName: latest.agentName,
            iteration: latest.iteration,
            timestamp: latest.timestamp,
          })
        }
      }
      // 按时间戳排序（最新的在前）
      return executions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    } catch (error) {
      console.error({
        message: '[检查点存储] 列出执行失败',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
      return []
    }
  }
  /**
   * 删除检查点
   */
  async delete(checkpointId, executionId) {
    const execId = executionId ?? this.extractExecutionId(checkpointId)
    if (!execId) {
      throw new Error(`无法从检查点ID提取执行ID: ${checkpointId}`)
    }
    const executionDir = safeJoin(this.rootDir, execId)
    try {
      const files = await withTimeout(
        fs.readdir(executionDir),
        TIMEOUT_CONFIG.DIR_TIMEOUT,
        '列出目录'
      )
      const checkpointFiles = files.filter((f) => f.endsWith('.json'))
      for (const file of checkpointFiles) {
        const filepath = path.join(executionDir, file)
        const data = await withTimeout(
          fs.readFile(filepath, 'utf-8'),
          TIMEOUT_CONFIG.READ_TIMEOUT,
          '读取文件'
        )
        const checkpoint = JSON.parse(data)
        if (checkpoint.id === checkpointId) {
          await fs.unlink(filepath)
          console.log(`[检查点存储] 已删除: ${filepath}`)
          return
        }
      }
      throw new Error(`检查点不存在: ${checkpointId}`)
    } catch (error) {
      console.error({
        message: '[检查点存储] 删除失败',
        checkpointId,
        executionId: execId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }
  /**
   * 删除执行的所有检查点
   */
  async deleteExecution(executionId) {
    const executionDir = path.join(this.rootDir, executionId)
    try {
      await fs.rm(executionDir, { recursive: true, force: true })
      console.log(`[检查点存储] 已删除执行: ${executionId}`)
    } catch (error) {
      console.error(`[检查点存储] 删除执行失败: ${error}`)
      throw error
    }
  }
  /**
   * 清空所有检查点
   */
  async clear() {
    try {
      await fs.rm(this.rootDir, { recursive: true, force: true })
      await fs.mkdir(this.rootDir, { recursive: true })
      console.log(`[检查点存储] 已清空所有检查点`)
    } catch (error) {
      console.error(`[检查点存储] 清空失败: ${error}`)
      throw error
    }
  }
  /**
   * 从检查点ID提取执行ID
   */
  extractExecutionId(checkpointId) {
    // 检查点ID格式: {executionId}-iter{iteration}-{timestamp}
    const match = checkpointId.match(/^([^-]+)-/)
    return match ? match[1] : null
  }
  /**
   * 获取存储统计信息
   */
  async getStats() {
    try {
      const executionDirs = await withTimeout(
        fs.readdir(this.rootDir),
        TIMEOUT_CONFIG.DIR_TIMEOUT,
        '列出根目录'
      )
      let totalCheckpoints = 0
      let totalSize = 0
      for (const execDir of executionDirs) {
        const executionDir = path.join(this.rootDir, execDir)
        const stat = await withTimeout(
          fs.stat(executionDir),
          TIMEOUT_CONFIG.DIR_TIMEOUT,
          '获取文件状态'
        )
        if (stat.isDirectory()) {
          const files = await withTimeout(
            fs.readdir(executionDir),
            TIMEOUT_CONFIG.DIR_TIMEOUT,
            '列出执行目录'
          )
          const checkpointFiles = files.filter((f) => f.endsWith('.json'))
          totalCheckpoints += checkpointFiles.length
          for (const file of checkpointFiles) {
            const filepath = path.join(executionDir, file)
            const fileStat = await withTimeout(
              fs.stat(filepath),
              TIMEOUT_CONFIG.DIR_TIMEOUT,
              '获取文件状态'
            )
            totalSize += fileStat.size
          }
        }
      }
      return {
        totalExecutions: executionDirs.length,
        totalCheckpoints,
        totalSize,
      }
    } catch (error) {
      console.error({
        message: '[检查点存储] 获取统计信息失败',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
      return {
        totalExecutions: 0,
        totalCheckpoints: 0,
        totalSize: 0,
      }
    }
  }
}
//# sourceMappingURL=FileSystemCheckpointStore.js.map
