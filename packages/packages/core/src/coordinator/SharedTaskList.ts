/**
 * 共享任务列表（Shared Task List）
 *
 * Phase 3.3 核心组件：
 * - 多 Agent 共享的任务状态板
 * - 支持任务 CRUD、状态流转、订阅通知
 * - 基于 EventBus 实现实时状态同步
 */

import { EventBus } from '../eventbus/EventBus.js'
import { type AgentTask, CoordinatorTaskStatus, type CoordinatorEventType } from './types.js'

/**
 * 任务过滤器
 */
export interface TaskFilter {
  /** 按状态过滤 */
  status?: CoordinatorTaskStatus | CoordinatorTaskStatus[]

  /** 按分配者过滤 */
  assignee?: string

  /** 按步骤 ID 过滤 */
  stepId?: string

  /** 按父任务 ID 过滤 */
  parentTaskId?: string
}

/**
 * 任务更新事件处理器
 */
export type TaskUpdateHandler = (
  task: AgentTask,
  eventType: 'created' | 'updated' | 'completed' | 'failed'
) => void

/**
 * 共享任务列表
 */
export class SharedTaskList {
  private readonly workflowId: string
  private readonly eventBus: EventBus
  private readonly tasks: Map<string, AgentTask> = new Map()
  private readonly handlers: Set<TaskUpdateHandler> = new Set()

  constructor(workflowId: string, eventBus: EventBus) {
    this.workflowId = workflowId
    this.eventBus = eventBus
  }

  /**
   * 创建任务
   */
  createTask(
    id: string,
    description: string,
    assignee: string,
    input: unknown,
    options?: {
      stepId?: string
      parentTaskId?: string
    }
  ): AgentTask {
    if (this.tasks.has(id)) {
      throw new Error(`任务已存在: ${id}`)
    }

    const task: AgentTask = {
      id,
      description,
      assignee,
      status: CoordinatorTaskStatus.PENDING,
      input,
      createdAt: new Date(),
      stepId: options?.stepId,
      parentTaskId: options?.parentTaskId,
      retryCount: 0,
    }

    this.tasks.set(id, task)

    // 发布创建事件
    this.publishTaskEvent('coordinator:task_delegated', task)
    this.notifyHandlers(task, 'created')

    console.log(`[SharedTaskList:${this.workflowId}] 创建任务: ${id} → ${assignee}`)

    return task
  }

  /**
   * 获取任务
   */
  getTask(id: string): AgentTask | undefined {
    return this.tasks.get(id)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): AgentTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 过滤任务
   */
  getTasks(filter?: TaskFilter): AgentTask[] {
    let tasks = this.getAllTasks()

    if (filter) {
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
        tasks = tasks.filter((t) => statuses.includes(t.status))
      }

      if (filter.assignee) {
        tasks = tasks.filter((t) => t.assignee === filter.assignee)
      }

      if (filter.stepId) {
        tasks = tasks.filter((t) => t.stepId === filter.stepId)
      }

      if (filter.parentTaskId) {
        tasks = tasks.filter((t) => t.parentTaskId === filter.parentTaskId)
      }
    }

    return tasks
  }

  /**
   * 更新任务状态
   */
  updateTask(
    id: string,
    updates: Partial<Pick<AgentTask, 'status' | 'output' | 'error'>>
  ): AgentTask {
    const task = this.tasks.get(id)
    if (!task) {
      throw new Error(`任务不存在: ${id}`)
    }

    if (updates.status) {
      task.status = updates.status

      if (updates.status === CoordinatorTaskStatus.IN_PROGRESS && !task.startedAt) {
        task.startedAt = new Date()
      }

      if (
        updates.status === CoordinatorTaskStatus.COMPLETED ||
        updates.status === CoordinatorTaskStatus.FAILED
      ) {
        task.completedAt = new Date()
      }
    }

    if (updates.output !== undefined) {
      task.output = updates.output
    }

    if (updates.error !== undefined) {
      task.error = updates.error
    }

    // 发布更新事件
    const eventType =
      task.status === CoordinatorTaskStatus.COMPLETED
        ? 'completed'
        : task.status === CoordinatorTaskStatus.FAILED
          ? 'failed'
          : 'updated'

    if (task.status === CoordinatorTaskStatus.COMPLETED) {
      this.publishTaskEvent('coordinator:task_completed', task)
    } else if (task.status === CoordinatorTaskStatus.FAILED) {
      this.publishTaskEvent('coordinator:task_failed', task)
    }

    this.notifyHandlers(task, eventType)

    return task
  }

  /**
   * 开始任务
   */
  startTask(id: string): AgentTask {
    return this.updateTask(id, { status: CoordinatorTaskStatus.IN_PROGRESS })
  }

  /**
   * 完成任务
   */
  completeTask(id: string, output: unknown): AgentTask {
    return this.updateTask(id, { status: CoordinatorTaskStatus.COMPLETED, output })
  }

  /**
   * 标记任务失败
   */
  failTask(id: string, error: string): AgentTask {
    return this.updateTask(id, { status: CoordinatorTaskStatus.FAILED, error })
  }

  /**
   * 删除任务
   */
  deleteTask(id: string): void {
    if (!this.tasks.has(id)) {
      throw new Error(`任务不存在: ${id}`)
    }
    this.tasks.delete(id)
    console.log(`[SharedTaskList:${this.workflowId}] 删除任务: ${id}`)
  }

  /**
   * 订阅任务更新
   */
  subscribeToUpdates(handler: TaskUpdateHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number
    pending: number
    inProgress: number
    completed: number
    failed: number
    blocked: number
  } {
    const tasks = this.getAllTasks()
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === CoordinatorTaskStatus.PENDING).length,
      inProgress: tasks.filter((t) => t.status === CoordinatorTaskStatus.IN_PROGRESS).length,
      completed: tasks.filter((t) => t.status === CoordinatorTaskStatus.COMPLETED).length,
      failed: tasks.filter((t) => t.status === CoordinatorTaskStatus.FAILED).length,
      blocked: tasks.filter((t) => t.status === CoordinatorTaskStatus.BLOCKED).length,
    }
  }

  /**
   * 获取工作流进度（0-100）
   */
  getProgress(): number {
    const stats = this.getStats()
    if (stats.total === 0) return 0
    const done = stats.completed + stats.failed
    return Math.round((done / stats.total) * 100)
  }

  /**
   * 清空所有任务
   */
  clear(): void {
    this.tasks.clear()
    console.log(`[SharedTaskList:${this.workflowId}] 清空所有任务`)
  }

  // ========== 私有方法 ==========

  private publishTaskEvent(eventType: CoordinatorEventType, task: AgentTask): void {
    this.eventBus.publish({
      type: eventType,
      source: 'SharedTaskList',
      data: {
        workflowId: this.workflowId,
        taskId: task.id,
        assignee: task.assignee,
        status: task.status,
        stepId: task.stepId,
      },
      timestamp: new Date(),
    })
  }

  private notifyHandlers(
    task: AgentTask,
    eventType: 'created' | 'updated' | 'completed' | 'failed'
  ): void {
    for (const handler of this.handlers) {
      try {
        handler(task, eventType)
      } catch (error) {
        console.error(`[SharedTaskList:${this.workflowId}] 任务更新处理器错误:`, error)
      }
    }
  }
}

/**
 * 创建共享任务列表（工厂函数）
 */
export function createSharedTaskList(workflowId: string, eventBus: EventBus): SharedTaskList {
  return new SharedTaskList(workflowId, eventBus)
}
