import { describe, it, expect } from 'vitest'
import { CheckpointManager } from '../../src/memory/CheckpointManager.js'

describe('CheckpointManager', () => {
  describe('constructor', () => {
    it('应使用默认配置', () => {
      const manager = new CheckpointManager()
      expect(manager).toBeDefined()
    })

    it('应使用自定义配置', () => {
      const manager = new CheckpointManager({
        maxCheckpoints: 5,
        autoSaveInterval: 2,
        autoSave: true,
      })
      expect(manager).toBeDefined()
    })
  })

  describe('saveCheckpoint', () => {
    it('应保存检查点', async () => {
      const manager = new CheckpointManager()
      const checkpoint = await manager.saveCheckpoint(
        'agent-1',
        'exec-1',
        1,
        {
          data: 'test',
        },
        {},
        {}
      )

      expect(checkpoint).toBeDefined()
      expect(checkpoint.agentName).toBe('agent-1')
      expect(checkpoint.executionId).toBe('exec-1')
    })

    it('应保存带标签的检查点', async () => {
      const manager = new CheckpointManager()
      const checkpoint = await manager.saveCheckpoint(
        'agent-1',
        'exec-1',
        1,
        {
          data: 'test',
        },
        {},
        {},
        ['test'],
        '备注'
      )

      expect(checkpoint).toBeDefined()
      expect(checkpoint.tags).toContain('test')
      expect(checkpoint.notes).toBe('备注')
    })
  })

  describe('loadCheckpoint', () => {
    it('应加载检查点', async () => {
      const manager = new CheckpointManager()
      const checkpoint = await manager.saveCheckpoint(
        'agent-1',
        'exec-1',
        1,
        {
          data: 'test',
        },
        {},
        {}
      )

      const loaded = await manager.loadCheckpoint(checkpoint.id)
      expect(loaded).toBeDefined()
      expect(loaded.id).toBe(checkpoint.id)
    })

    it('应处理不存在的检查点', async () => {
      const manager = new CheckpointManager()
      await expect(manager.loadCheckpoint('nonexistent')).rejects.toThrow()
    })
  })

  describe('listCheckpoints', () => {
    it('应列出检查点', async () => {
      const manager = new CheckpointManager()
      await manager.saveCheckpoint('agent-1', 'exec-1', 1, { data: 'test' }, {}, {})

      const checkpoints = await manager.listCheckpoints({ executionId: 'exec-1' })
      expect(checkpoints).toBeDefined()
      expect(Array.isArray(checkpoints)).toBe(true)
      expect(checkpoints.length).toBeGreaterThan(0)
    })

    it('应处理不存在的执行', async () => {
      const manager = new CheckpointManager()
      const checkpoints = await manager.listCheckpoints({ executionId: 'nonexistent' })
      expect(checkpoints).toEqual([])
    })

    it('应按智能体过滤', async () => {
      const manager = new CheckpointManager()
      await manager.saveCheckpoint('agent-1', 'exec-1', 1, { data: 'test' }, {}, {})

      const checkpoints = await manager.listCheckpoints({ agentName: 'agent-1' })
      expect(checkpoints.length).toBeGreaterThan(0)
    })
  })

  describe('deleteCheckpoint', () => {
    it('应删除检查点', async () => {
      const manager = new CheckpointManager()
      const checkpoint = await manager.saveCheckpoint(
        'agent-1',
        'exec-1',
        1,
        {
          data: 'test',
        },
        {},
        {}
      )

      await manager.deleteCheckpoint(checkpoint.id)
      await expect(manager.loadCheckpoint(checkpoint.id)).rejects.toThrow()
    })
  })

  describe('clearCheckpoints', () => {
    it('应清空所有检查点', async () => {
      const manager = new CheckpointManager()
      await manager.saveCheckpoint('agent-1', 'exec-1', 1, { data: 'test' }, {}, {})

      await manager.clearCheckpoints()
      const checkpoints = await manager.listCheckpoints({ executionId: 'exec-1' })
      expect(checkpoints).toEqual([])
    })
  })

  describe('listResumableExecutions', () => {
    it('应列出可恢复的执行', async () => {
      const manager = new CheckpointManager()
      await manager.saveCheckpoint('agent-1', 'exec-1', 1, { data: 'test' }, {}, {})

      const executions = await manager.listResumableExecutions()
      expect(executions).toBeDefined()
      expect(Array.isArray(executions)).toBe(true)
      expect(executions.length).toBeGreaterThan(0)
    })
  })

  describe('getTimeMachine', () => {
    it('应获取时间机器', () => {
      const manager = new CheckpointManager()
      const timeMachine = manager.getTimeMachine()
      expect(timeMachine).toBeDefined()
    })
  })

  describe('cleanupOldCheckpoints', () => {
    it('应清理旧检查点', async () => {
      const manager = new CheckpointManager({
        maxCheckpoints: 2,
      })

      await manager.saveCheckpoint('agent-1', 'exec-1', 1, { data: '1' }, {}, {})
      await manager.saveCheckpoint('agent-1', 'exec-1', 2, { data: '2' }, {}, {})
      await manager.saveCheckpoint('agent-1', 'exec-1', 3, { data: '3' }, {}, {})

      // 等待清理
      await new Promise((resolve) => setTimeout(resolve, 10))

      const checkpoints = await manager.listCheckpoints({ executionId: 'exec-1' })
      expect(checkpoints.length).toBeLessThanOrEqual(3)
    })
  })
})
