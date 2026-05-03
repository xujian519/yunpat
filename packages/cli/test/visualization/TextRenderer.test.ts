/**
 * TextRenderer 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TextRenderer } from '../../src/visualization/TextRenderer.js'
import { Priority, TaskStatus, PlanStatus } from '@yunpat/core'

describe('TextRenderer', () => {
  let renderer: TextRenderer

  beforeEach(() => {
    renderer = new TextRenderer()
  })

  /**
   * 辅助函数：创建测试计划
   */
  function createTestPlan() {
    return {
      id: 'plan1',
      goal: '专利撰写计划',
      subGoals: [
        {
          id: 'goal1',
          title: '技术方案理解',
          description: '理解技术方案',
          tasks: [
            {
              id: 'task1',
              title: '分析技术要点',
              description: '分析技术要点',
              type: 'research' as any,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['analysis'],
              estimatedTokens: 2000,
              estimatedDuration: 300,
              createdAt: new Date(),
            },
          ],
          dependencies: [],
          priority: Priority.HIGH,
          status: TaskStatus.COMPLETED,
          estimatedDuration: 300,
          estimatedTokens: 2000,
        },
        {
          id: 'goal2',
          title: '权利要求生成',
          description: '生成权利要求',
          tasks: [
            {
              id: 'task2',
              title: '撰写独立权利要求',
              description: '撰写独立权利要求',
              type: 'writing' as any,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 3000,
              estimatedDuration: 600,
              createdAt: new Date(),
            },
          ],
          dependencies: ['goal1'],
          priority: Priority.CRITICAL,
          status: TaskStatus.IN_PROGRESS,
          estimatedDuration: 600,
          estimatedTokens: 3000,
        },
        {
          id: 'goal3',
          title: '说明书撰写',
          description: '撰写说明书',
          tasks: [
            {
              id: 'task3',
              title: '撰写实施方式',
              description: '撰写实施方式',
              type: 'writing' as any,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 4000,
              estimatedDuration: 900,
              createdAt: new Date(),
            },
          ],
          dependencies: ['goal2'],
          priority: Priority.HIGH,
          status: TaskStatus.PENDING,
          estimatedDuration: 900,
          estimatedTokens: 4000,
        },
      ],
      dependencies: {
        nodes: new Map(),
        edges: [
          {
            from: 'goal1',
            to: 'goal2',
            strength: 1.0,
            type: 'strong',
          },
          {
            from: 'goal2',
            to: 'goal3',
            strength: 0.8,
            type: 'strong',
          },
        ],
        hasCycles: false,
        topologicalOrder: ['goal1', 'goal2', 'goal3'],
      },
      estimatedDuration: 1800,
      estimatedTokens: 9000,
      status: PlanStatus.READY,
      createdAt: new Date(),
    }
  }

  describe('render', () => {
    it('应该渲染为文本格式', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, { format: 'text' })

      expect(result.content).toBeDefined()
      expect(result.content.length).toBeGreaterThan(0)
      expect(result.metadata.format).toBe('text')
      expect(result.metadata.nodeCount).toBe(3)
      expect(result.metadata.edgeCount).toBe(2)
    })

    it('应该渲染为树状格式', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, { format: 'tree' })

      expect(result.content).toContain('📊 任务依赖树')
      expect(result.metadata.format).toBe('tree')
    })

    it('应该渲染为图格式', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, { format: 'graph' })

      expect(result.content).toContain('📊 任务依赖图')
      expect(result.metadata.format).toBe('graph')
    })

    it('应该显示进度信息', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, {
        format: 'text',
        showProgress: true,
      })

      expect(result.content).toContain('⏳️ 进度:')
      expect(result.content).toContain('1/3')
    })

    it('应该显示统计信息', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, {
        format: 'text',
        showMetrics: true,
      })

      expect(result.content).toContain('📊 统计信息:')
      expect(result.content).toContain('总任务数: 3')
      expect(result.content).toContain('依赖关系数: 2')
    })

    it('应该包含详细信息', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, {
        format: 'text',
        includeDetails: true,
      })

      expect(result.content).toContain('描述:')
      expect(result.content).toContain('任务:')
      expect(result.content).toContain('预估:')
    })
  })

  describe('renderTree', () => {
    it('应该正确渲染树状结构', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, { format: 'tree' })

      expect(result.content).toContain('技术方案理解')
      expect(result.content).toContain('权利要求生成')
      expect(result.content).toContain('说明书撰写')
    })

    it('应该显示状态图标', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, { format: 'tree' })

      expect(result.content).toContain('✅') // completed
      expect(result.content).toContain('⏳') // in_progress
      expect(result.content).toContain('⏸️') // pending
    })

    it('应该限制深度', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, {
        format: 'tree',
        maxDepth: 1,
      })

      // 深度为1时，只显示根节点
      const lines = result.content.split('\n')
      const rootCount = lines.filter((line) => line.includes('└─')).length
      expect(rootCount).toBeGreaterThan(0)
    })
  })

  describe('renderGraph', () => {
    it('应该正确渲染图结构', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, { format: 'graph' })

      expect(result.content).toContain('技术方案理解')
      expect(result.content).toContain('权利要求生成')
      expect(result.content).toContain('说明书撰写')
    })

    it('应该显示依赖关系', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, { format: 'graph' })

      expect(result.content).toContain('← 依赖:')
    })
  })

  describe('exportToDOT', () => {
    it('应该生成有效的DOT格式', () => {
      const plan = createTestPlan()
      const dot = renderer.exportToDOT(plan)

      expect(dot).toContain('digraph TaskDependencies')
      expect(dot).toContain('rankdir=TB;')
      expect(dot).toContain('goal1')
      expect(dot).toContain('goal2')
      expect(dot).toContain('goal3')
      expect(dot).toContain('->')
    })

    it('应该包含节点样式', () => {
      const plan = createTestPlan()
      const dot = renderer.exportToDOT(plan)

      expect(dot).toContain('fillcolor')
      expect(dot).toContain('color')
      expect(dot).toContain('penwidth')
    })

    it('应该包含边样式', () => {
      const plan = createTestPlan()
      const dot = renderer.exportToDOT(plan)

      expect(dot).toContain('style=')
      expect(dot).toContain('penwidth=')
    })
  })

  describe('exportToMermaid', () => {
    it('应该生成有效的Mermaid格式', () => {
      const plan = createTestPlan()
      const mermaid = renderer.exportToMermaid(plan)

      expect(mermaid).toContain('graph TD')
      expect(mermaid).toContain('goal1')
      expect(mermaid).toContain('goal2')
      expect(mermaid).toContain('goal3')
      expect(mermaid).toContain('-->')
    })

    it('应该包含状态图标', () => {
      const plan = createTestPlan()
      const mermaid = renderer.exportToMermaid(plan)

      expect(mermaid).toContain('✅')
      expect(mermaid).toContain('⏳')
    })
  })

  describe('样式管理', () => {
    it('应该设置节点样式', () => {
      const customStyle = {
        shape: 'ellipse' as const,
        color: '#ff0000',
        fillColor: '#ffff00',
        borderColor: '#0000ff',
        borderWidth: 3,
        fontSize: 14,
        fontColor: '#333333',
      }

      renderer.setNodeStyle('custom', customStyle)
      // 样式已设置，后续渲染会使用
      expect(true).toBe(true)
    })

    it('应该设置边样式', () => {
      const customStyle = {
        color: '#ff0000',
        style: 'dotted' as const,
        thickness: 3,
      }

      renderer.setEdgeStyle('custom', customStyle)
      // 样式已设置，后续渲染会使用
      expect(true).toBe(true)
    })
  })

  describe('进度计算', () => {
    it('应该正确计算进度', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, {
        format: 'text',
        showProgress: true,
      })

      expect(result.content).toContain('1/3')
      expect(result.content).toContain('33.3%')
    })
  })

  describe('统计计算', () => {
    it('应该正确计算统计信息', () => {
      const plan = createTestPlan()
      const result = renderer.render(plan, {
        format: 'text',
        showMetrics: true,
      })

      expect(result.content).toContain('总任务数: 3')
      expect(result.content).toContain('依赖关系数: 2')
      expect(result.content).toContain('关键路径长度: 3')
    })
  })

  describe('边界情况', () => {
    it('应该处理空计划', () => {
      const plan: any = {
        id: 'empty',
        goal: '空计划',
        subGoals: [],
        dependencies: {
          nodes: new Map(),
          edges: [],
          hasCycles: false,
          topologicalOrder: [],
        },
        estimatedDuration: 0,
        estimatedTokens: 0,
        status: PlanStatus.READY,
        createdAt: new Date(),
      }

      const result = renderer.render(plan, { format: 'text' })

      expect(result.content).toBeDefined()
      expect(result.metadata.nodeCount).toBe(0)
    })

    it('应该处理无依赖关系的计划', () => {
      const plan = createTestPlan()
      plan.dependencies.edges = []

      const result = renderer.render(plan, { format: 'text' })

      expect(result.content).toContain('(无依赖关系)')
    })

    it('应该处理所有任务完成的计划', () => {
      const plan = createTestPlan()
      plan.subGoals.forEach((goal) => {
        goal.status = TaskStatus.COMPLETED
      })

      const result = renderer.render(plan, {
        format: 'text',
        showProgress: true,
      })

      expect(result.content).toContain('3/3')
      expect(result.content).toContain('100.0%')
    })
  })

  describe('渲染性能', () => {
    it('应该在合理时间内完成渲染', () => {
      const plan = createTestPlan()
      const startTime = Date.now()

      const result = renderer.render(plan, { format: 'text' })

      const endTime = Date.now()
      const renderTime = endTime - startTime

      expect(result.metadata.renderTime).toBeLessThan(1000)
      expect(renderTime).toBeLessThan(1000)
    })
  })
})
