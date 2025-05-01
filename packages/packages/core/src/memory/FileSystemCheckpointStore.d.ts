/**
 * 文件系统检查点存储
 *
 * 将检查点序列化为JSON文件存储到磁盘，支持进程重启后恢复
 */
import { Checkpoint } from './CheckpointManager.js'
/**
 * 文件系统检查点存储配置
 */
export interface FileSystemCheckpointStoreConfig {
  /** 存储根目录，默认为 data/checkpoints */
  rootDir?: string
  /** 是否自动创建目录，默认为 true */
  autoCreateDir?: boolean
}
/**
 * 文件系统检查点存储
 */
export declare class FileSystemCheckpointStore {
  private rootDir
  constructor(config?: FileSystemCheckpointStoreConfig)
  /**
   * 初始化存储（同步，确保目录存在）
   */
  private initialize
  /**
   * 保存检查点
   */
  save(checkpoint: Checkpoint): Promise<void>
  /**
   * 加载检查点
   */
  load(checkpointId: string, executionId?: string): Promise<Checkpoint>
  /**
   * 列出执行的所有检查点
   */
  listCheckpoints(executionId: string): Promise<Checkpoint[]>
  /**
   * 列出所有可恢复的执行
   */
  listResumableExecutions(): Promise<
    Array<{
      executionId: string
      agentName: string
      iteration: number
      timestamp: Date
    }>
  >
  /**
   * 删除检查点
   */
  delete(checkpointId: string, executionId?: string): Promise<void>
  /**
   * 删除执行的所有检查点
   */
  deleteExecution(executionId: string): Promise<void>
  /**
   * 清空所有检查点
   */
  clear(): Promise<void>
  /**
   * 从检查点ID提取执行ID
   */
  private extractExecutionId
  /**
   * 获取存储统计信息
   */
  getStats(): Promise<{
    totalExecutions: number
    totalCheckpoints: number
    totalSize: number
  }>
}
//# sourceMappingURL=FileSystemCheckpointStore.d.ts.map
