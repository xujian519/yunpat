/**
 * FileSystemCheckpointStore 使用示例
 *
 * 展示如何使用文件系统持久化检查点
 */

import { CheckpointManager, FileSystemCheckpointStore } from '@yunpat/core'

async function main() {
  // 1. 创建文件系统存储
  const store = new FileSystemCheckpointStore({
    rootDir: 'data/checkpoints', // 存储目录
  })

  // 2. 创建CheckpointManager并注入外部存储
  const checkpointManager = new CheckpointManager({
    autoSave: true,
    autoSaveInterval: 1, // 每次迭代保存
    maxCheckpoints: 100,
    store, // 注入外部存储
  })

  // 3. 保存检查点
  const checkpoint = await checkpointManager.saveCheckpoint(
    'MyAgent', // agentName
    'exec-001', // executionId
    1, // iteration
    { memoryKey: 'memoryValue' }, // memorySnapshot
    { contextKey: 'contextValue' }, // contextSnapshot
    { stateKey: 'stateValue' }, // stateSnapshot
    ['important', 'milestone'], // tags
    '完成第一阶段' // notes
  )

  console.log('✅ 检查点已保存:', checkpoint.id)

  // 4. 列出所有可恢复的执行
  const executions = await checkpointManager.listResumableExecutions()
  console.log('📋 可恢复的执行:', executions)

  // 5. 加载检查点
  const loaded = await checkpointManager.loadCheckpoint(checkpoint.id)
  console.log('✅ 检查点已加载:', loaded.id)
  console.log('   记忆快照:', loaded.memorySnapshot)

  // 6. 列出某个执行的所有检查点
  const checkpoints = await checkpointManager.listCheckpoints({
    executionId: 'exec-001',
  })
  console.log('📋 执行的所有检查点:', checkpoints.length)

  // 7. 删除检查点
  await checkpointManager.deleteCheckpoint(checkpoint.id)
  console.log('✅ 检查点已删除')
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
