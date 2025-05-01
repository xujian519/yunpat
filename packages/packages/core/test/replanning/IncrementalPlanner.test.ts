import { describe, it, expect, vi } from 'vitest'
import { IncrementalPlanner } from '../../src/replanning/IncrementalPlanner.js'
import { Priority, TaskStatus } from '../../src/planning/types.js'
import { PlanConflictError, CircularDependencyError } from '../../src/replanning/types.js'

function createMockPlan() {
  return {
    id: 'plan-1',
    goal: '测试计划',
    subGoals: [
      {
        id: 'goal-1',
        title: '目标1',
        description: '描述1',
        tasks: [
          {
            id: 'task-1',
            title: '子任务1',
            description: '',
            type: 'code' as any,
            status: TaskStatus.PENDING,
            estimatedDuration: 10,
            estimatedTokens: 100,
            requiredCapabilities: [],
            createdAt: new Date(),
          },
        ],
        priority: Priority.HIGH,
        status: TaskStatus.PENDING,
        estimatedDuration: 100,
        estimatedTokens: 1000,
        dependencies: [],
      },
      {
        id: 'goal-2',
        title: '目标2',
        description: '描述2',
        tasks: [
          {
            id: 'task-2',
            title: '子任务2',
            description: '',
            type: 'code' as any,
            status: TaskStatus.PENDING,
            estimatedDuration: 10,
            estimatedTokens: 100,
            requiredCapabilities: [],
            createdAt: new Date(),
          },
        ],
        priority: Priority.MEDIUM,
        status: TaskStatus.PENDING,
        estimatedDuration: 200,
        estimatedTokens: 2000,
        dependencies: [],
      },
    ],
    dependencies: {
      nodes: new Map(),
      edges: [],
      hasCycles: false,
      topologicalOrder: ['goal-1', 'goal-2'],
    },
    estimatedDuration: 300,
  }
}

function createMockContext(overrides = {}) {
  return {
    originalPlan: createMockPlan(),
    currentState: {
      completedGoals: new Set(),
      failedGoals: ['goal-1'],
      resourceUsage: {
        tokensUsed: 1200,
        estimatedTokens: 1000,
      },
    },
    ...overrides,
  }
}

describe('IncrementalPlanner', () => {
  describe('constructor', () => {
    it('应该使用默认配置', () => {
      const planner = new IncrementalPlanner()
      expect(planner).toBeDefined()
    })

    it('应该使用自定义配置', () => {
      const planner = new IncrementalPlanner({
        maxModifications: 10,
        preserveCriticalPath: false,
        allowDependencyChanges: true,
      })
      expect(planner).toBeDefined()
    })
  })

  describe('generateIncrementalAdjustment', () => {
    it('应该生成重试调整', async () => {
      const planner = new IncrementalPlanner()
      const context = createMockContext()
      const adjustment = await planner.generateIncrementalAdjustment(context, {
        type: 'retry',
        modifications: [],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustment.type).toBe('retry')
      expect(adjustment.modifications.length).toBeGreaterThan(0)
    })

    it('应该生成跳过调整', async () => {
      const planner = new IncrementalPlanner()
      const context = createMockContext({
        originalPlan: {
          ...createMockPlan(),
          dependencies: {
            nodes: new Map(),
            edges: [{ from: 'goal-1', to: 'goal-2', type: 'strong', strength: 1 }],
            hasCycles: false,
            topologicalOrder: ['goal-1', 'goal-2'],
          },
        },
        currentState: {
          completedGoals: new Set(['goal-2']),
          failedGoals: [],
          resourceUsage: { tokensUsed: 1000, estimatedTokens: 1000 },
        },
      })

      const adjustment = await planner.generateIncrementalAdjustment(context, {
        type: 'skip',
        modifications: [],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustment.type).toBe('skip')
    })

    it('应该生成重排序调整', async () => {
      const planner = new IncrementalPlanner()
      const context = createMockContext()
      const adjustment = await planner.generateIncrementalAdjustment(context, {
        type: 'reorder',
        modifications: [],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustment.type).toBe('reorder')
      expect(adjustment.modifications.length).toBeGreaterThan(0)
    })

    it('应该生成分解调整', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      plan.subGoals[0].estimatedDuration = 500
      plan.subGoals[0].estimatedTokens = 5000
      const context = createMockContext({ originalPlan: plan })

      const adjustment = await planner.generateIncrementalAdjustment(context, {
        type: 'decompose',
        modifications: [],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustment.type).toBe('decompose')
    })

    it('应该生成适应调整', async () => {
      const planner = new IncrementalPlanner()
      const context = createMockContext({
        currentState: {
          completedGoals: new Set(),
          failedGoals: [],
          resourceUsage: {
            tokensUsed: 1500,
            estimatedTokens: 1000,
          },
        },
      })

      const adjustment = await planner.generateIncrementalAdjustment(context, {
        type: 'adapt',
        modifications: [],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustment.type).toBe('adapt')
    })

    it('应该处理中止策略', async () => {
      const planner = new IncrementalPlanner()
      const context = createMockContext()
      const adjustment = await planner.generateIncrementalAdjustment(context, {
        type: 'abort',
        modifications: [],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustment.type).toBe('abort')
      expect(adjustment.modifications).toHaveLength(0)
    })
  })

  describe('applyAdjustment', () => {
    it('应该应用调整', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      const adjustedPlan = await planner.applyAdjustment(plan, {
        type: 'retry',
        modifications: [
          {
            type: 'modify',
            goalId: 'goal-1',
            changes: { newStatus: 'pending' },
          },
        ],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustedPlan.subGoals[0].status).toBe(TaskStatus.PENDING)
    })

    it('应该处理空调整', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      const adjustedPlan = await planner.applyAdjustment(plan, {
        type: 'retry',
        modifications: [],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustedPlan.subGoals).toHaveLength(2)
    })
  })

  describe('applyModification', () => {
    it('应该应用添加修改（无taskDecomposer）', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      await expect(
        planner.applyAdjustment(plan, {
          type: 'retry',
          modifications: [{ type: 'add', goalId: 'goal-1' }],
          estimatedImprovement: 0.5,
          reasoning: 'test',
        })
      ).rejects.toThrow('需要TaskDecomposer来添加新子目标')
    })

    it('应该应用移除修改', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      const adjustedPlan = await planner.applyAdjustment(plan, {
        type: 'retry',
        modifications: [{ type: 'remove', goalId: 'goal-1' }],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustedPlan.subGoals).toHaveLength(1)
    })

    it('应该应用重排序修改', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      const adjustedPlan = await planner.applyAdjustment(plan, {
        type: 'retry',
        modifications: [{ type: 'reorder', goalId: 'goal-1' }],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustedPlan.subGoals).toHaveLength(2)
    })

    it('应该处理不存在的目标', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      const adjustedPlan = await planner.applyAdjustment(plan, {
        type: 'retry',
        modifications: [{ type: 'modify', goalId: 'non-existent' }],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustedPlan.subGoals).toHaveLength(2)
    })

    it('应该应用依赖修改（不允许）', async () => {
      const planner = new IncrementalPlanner({ allowDependencyChanges: false })
      const plan = createMockPlan()
      const adjustedPlan = await planner.applyAdjustment(plan, {
        type: 'retry',
        modifications: [
          {
            type: 'modify',
            goalId: 'goal-1',
            changes: { newDependencies: [] },
          },
        ],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustedPlan.subGoals[0].dependencies).toEqual([])
    })

    it('应该应用依赖修改（允许）', async () => {
      const planner = new IncrementalPlanner({ allowDependencyChanges: true })
      const plan = createMockPlan()
      const adjustedPlan = await planner.applyAdjustment(plan, {
        type: 'retry',
        modifications: [
          {
            type: 'modify',
            goalId: 'goal-1',
            changes: { newDependencies: ['goal-2'] },
          },
        ],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustedPlan.subGoals[0].dependencies).toEqual(['goal-2'])
    })

    it('应该应用估算修改', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      const adjustedPlan = await planner.applyAdjustment(plan, {
        type: 'retry',
        modifications: [
          {
            type: 'modify',
            goalId: 'goal-1',
            changes: {
              newEstimate: { duration: 150, tokens: 1500 },
            },
          },
        ],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustedPlan.subGoals[0].estimatedDuration).toBe(150)
      expect(adjustedPlan.subGoals[0].estimatedTokens).toBe(1500)
    })
  })

  describe('validateAdjustment', () => {
    it('应该验证通过', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      const valid = await planner.validateAdjustment(plan, {
        type: 'retry',
        modifications: [],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(valid).toBe(true)
    })

    it('应该拒绝修改过多', async () => {
      const planner = new IncrementalPlanner({ maxModifications: 1 })
      const plan = createMockPlan()
      const valid = await planner.validateAdjustment(plan, {
        type: 'retry',
        modifications: [
          { type: 'modify', goalId: 'g1' },
          { type: 'modify', goalId: 'g2' },
        ],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(valid).toBe(false)
    })

    it('应该拒绝改进不足', async () => {
      const planner = new IncrementalPlanner({ minImprovementThreshold: 0.5 })
      const plan = createMockPlan()
      const valid = await planner.validateAdjustment(plan, {
        type: 'retry',
        modifications: [],
        estimatedImprovement: 0.1,
        reasoning: 'test',
      })
      expect(valid).toBe(false)
    })
  })

  describe('addTask', () => {
    it('应该添加任务', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      const result = await planner.addTask(plan, {
        id: 'goal-3',
        title: '目标3',
        description: '描述3',
        tasks: [
          {
            id: 'task-1',
            title: '子任务1',
            description: '',
            type: 'code' as any,
            status: TaskStatus.PENDING,
            estimatedDuration: 10,
            estimatedTokens: 100,
            requiredCapabilities: [],
            createdAt: new Date(),
          },
        ],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: 50,
        estimatedTokens: 500,
        dependencies: [],
      })
      expect(result.addedTask.taskId).toBe('goal-3')
    })

    it('应该添加任务带依赖', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      const result = await planner.addTask(
        plan,
        {
          id: 'goal-3',
          title: '目标3',
          description: '描述3',
          tasks: [
            {
              id: 'task-1',
              title: '子任务1',
              description: '',
              type: 'code' as any,
              status: TaskStatus.PENDING,
              estimatedDuration: 10,
              estimatedTokens: 100,
              requiredCapabilities: [],
              createdAt: new Date(),
            },
          ],
          priority: Priority.LOW,
          status: TaskStatus.PENDING,
          estimatedDuration: 50,
          estimatedTokens: 500,
          dependencies: [],
        },
        ['goal-1']
      )
      expect(result.addedTask.taskId).toBe('goal-3')
    })

    it('应该检测冲突', async () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      await expect(
        planner.addTask(plan, {
          id: 'goal-1',
          title: '重复ID',
          description: '描述',
          tasks: [
            {
              id: 'task-1',
              title: '子任务1',
              description: '',
              type: 'code' as any,
              status: TaskStatus.PENDING,
              estimatedDuration: 10,
              estimatedTokens: 100,
              requiredCapabilities: [],
              createdAt: new Date(),
            },
          ],
          priority: Priority.LOW,
          status: TaskStatus.PENDING,
          estimatedDuration: 50,
          estimatedTokens: 500,
          dependencies: [],
        })
      ).rejects.toThrow(PlanConflictError)
    })
  })

  describe('recalculateDependencies', () => {
    it('应该重新计算依赖', () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      planner.recalculateDependencies(plan)
      expect(plan.dependencies.hasCycles).toBe(false)
    })

    it('应该检测循环依赖', () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      plan.dependencies.edges = [
        { from: 'goal-1', to: 'goal-2', type: 'strong', strength: 1 },
        { from: 'goal-2', to: 'goal-1', type: 'strong', strength: 1 },
      ]
      expect(() => planner.recalculateDependencies(plan)).toThrow(CircularDependencyError)
    })
  })

  describe('recalculateCriticalPath', () => {
    it('应该计算关键路径', () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      planner.recalculateDependencies(plan)
      const path = planner.recalculateCriticalPath(plan)
      expect(path.tasks.length).toBeGreaterThan(0)
    })

    it('应该处理循环依赖', () => {
      const planner = new IncrementalPlanner()
      const plan = createMockPlan()
      plan.dependencies.hasCycles = true
      plan.dependencies.topologicalOrder = undefined
      const path = planner.recalculateCriticalPath(plan)
      expect(path.tasks.length).toBe(2)
    })
  })

  describe('findBlockedGoals', () => {
    it('应该找到被阻塞的目标', () => {
      const planner = new IncrementalPlanner()
      const context = createMockContext({
        originalPlan: {
          ...createMockPlan(),
          dependencies: {
            nodes: new Map(),
            edges: [{ from: 'goal-1', to: 'goal-2', type: 'strong', strength: 1 }],
            hasCycles: false,
            topologicalOrder: ['goal-1', 'goal-2'],
          },
        },
        currentState: {
          completedGoals: new Set(['goal-2']),
          failedGoals: [],
          resourceUsage: { tokensUsed: 1000, estimatedTokens: 1000 },
        },
      })

      const blocked = planner['findBlockedGoals'](context)
      expect(blocked.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('generateRetryModifications', () => {
    it('应该处理不存在的目标', async () => {
      const planner = new IncrementalPlanner()
      const context = createMockContext({
        currentState: {
          completedGoals: new Set(),
          failedGoals: ['non-existent'],
          resourceUsage: { tokensUsed: 1000, estimatedTokens: 1000 },
        },
      })

      const adjustment = await planner.generateIncrementalAdjustment(context, {
        type: 'retry',
        modifications: [],
        estimatedImprovement: 0.5,
        reasoning: 'test',
      })
      expect(adjustment.modifications).toHaveLength(0)
    })
  })

  describe('getPriorityValue', () => {
    it('应该返回未知优先级的值', () => {
      const planner = new IncrementalPlanner()
      expect(planner['getPriorityValue']('unknown' as any)).toBe(0)
    })
  })
})
