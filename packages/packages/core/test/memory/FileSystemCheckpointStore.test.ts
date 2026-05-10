import { describe, it, expect } from 'vitest'
import * as os from 'os'
import * as path from 'path'
import { FileSystemCheckpointStore } from '../../src/memory/FileSystemCheckpointStore.js'

const tmpDir = os.tmpdir()

describe('FileSystemCheckpointStore', () => {
  describe('constructor', () => {
    it('应使用默认配置', () => {
      const store = new FileSystemCheckpointStore()
      expect(store).toBeDefined()
    })

    it('应使用自定义配置', () => {
      const store = new FileSystemCheckpointStore({
        rootDir: '/tmp/test-checkpoints',
        autoCreateDir: true,
      })
      expect(store).toBeDefined()
    })
  })

  describe('save', () => {
    it('应保存检查点', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      await store.save({
        id: 'cp-1',
        executionId: 'exec-1',
        iteration: 1,
        timestamp: new Date(),
        state: { data: 'test' },
      } as any)
    })
  })

  describe('load', () => {
    it('应加载检查点', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      await store.save({
        id: 'cp-1',
        executionId: 'exec-1',
        iteration: 1,
        timestamp: new Date(),
        state: { data: 'test' },
      } as any)

      const checkpoint = await store.load('cp-1', 'exec-1')
      expect(checkpoint).toBeDefined()
      expect(checkpoint.id).toBe('cp-1')
    })

    it('应处理不存在的检查点', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      await expect(store.load('nonexistent', 'exec-1')).rejects.toThrow()
    })

    it('应处理无效的检查点ID', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      await expect(store.load('invalid-id')).rejects.toThrow()
    })
  })

  describe('listCheckpoints', () => {
    it('应列出检查点', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      await store.save({
        id: 'cp-1',
        executionId: 'exec-1',
        iteration: 1,
        timestamp: new Date(),
        state: { data: 'test' },
      } as any)

      const checkpoints = await store.listCheckpoints('exec-1')
      expect(checkpoints).toBeDefined()
      expect(Array.isArray(checkpoints)).toBe(true)
      expect(checkpoints.length).toBeGreaterThan(0)
    })

    it('应处理不存在的执行', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      const checkpoints = await store.listCheckpoints('nonexistent')
      expect(checkpoints).toEqual([])
    })
  })

  describe('delete', () => {
    it('应删除检查点', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      await store.save({
        id: 'cp-1',
        executionId: 'exec-1',
        iteration: 1,
        timestamp: new Date(),
        state: { data: 'test' },
      } as any)

      await store.delete('cp-1', 'exec-1')
      await expect(store.load('cp-1', 'exec-1')).rejects.toThrow()
    })
  })

  describe('deleteExecution', () => {
    it('应删除执行', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      await store.save({
        id: 'cp-1',
        executionId: 'exec-1',
        iteration: 1,
        timestamp: new Date(),
        state: { data: 'test' },
      } as any)

      await store.deleteExecution('exec-1')
      await expect(store.load('cp-1', 'exec-1')).rejects.toThrow()
    })
  })

  describe('clear', () => {
    it('应清空所有检查点', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      await store.save({
        id: 'cp-1',
        executionId: 'exec-1',
        iteration: 1,
        timestamp: new Date(),
        state: { data: 'test' },
      } as any)

      await store.clear()
      await expect(store.load('cp-1', 'exec-1')).rejects.toThrow()
    })
  })

  describe('listResumableExecutions', () => {
    it('应列出可恢复的执行', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      await store.save({
        id: 'cp-1',
        executionId: 'exec-1',
        agentName: 'test-agent',
        iteration: 1,
        timestamp: new Date(),
        state: { data: 'test' },
      } as any)

      const executions = await store.listResumableExecutions()
      expect(executions).toBeDefined()
      expect(Array.isArray(executions)).toBe(true)
    })
  })

  describe('getStats', () => {
    it('应获取统计信息', async () => {
      const store = new FileSystemCheckpointStore({
        rootDir: path.join(tmpDir, 'test-checkpoints-' + Date.now()),
      })

      await store.save({
        id: 'cp-1',
        executionId: 'exec-1',
        iteration: 1,
        timestamp: new Date(),
        state: { data: 'test' },
      } as any)

      const stats = await store.getStats()
      expect(stats).toBeDefined()
      expect(stats.totalExecutions).toBeGreaterThanOrEqual(0)
      expect(stats.totalCheckpoints).toBeGreaterThanOrEqual(0)
    })
  })
})
