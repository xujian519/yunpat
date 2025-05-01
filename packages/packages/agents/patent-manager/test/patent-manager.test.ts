/**
 * PatentManagerAgent 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PatentManagerAgent } from '../src/PatentManagerAgent.js'
import { PatentStateMachine } from '../src/state/PatentStateMachine.js'
import { NotificationService } from '../src/notifications/NotificationService.js'

// Mock 数据库
const mockPatentData: Map<string, any> = new Map()
const mockDeadlines: Map<string, any[]> = new Map()
const mockFees: Map<string, any[]> = new Map()

const mockDatabase = {
  createPatent: vi.fn(async (patent) => {
    const p = {
      ...patent,
      id: mockPatentData.size + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPatentData.set(patent.applicationNumber, p)
    return p
  }),
  getPatent: vi.fn(async (applicationNumber) => mockPatentData.get(applicationNumber) || null),
  updatePatent: vi.fn(async (applicationNumber, updates) => {
    const existing = mockPatentData.get(applicationNumber)
    if (!existing) return null
    const updated = { ...existing, ...updates, updatedAt: new Date() }
    mockPatentData.set(applicationNumber, updated)
    return updated
  }),
  deletePatent: vi.fn(async (applicationNumber) => mockPatentData.delete(applicationNumber)),
  queryPatents: vi.fn(async () => ({
    patents: Array.from(mockPatentData.values()),
    total: mockPatentData.size,
  })),
  addDeadline: vi.fn(async (deadline) => {
    const d = { ...deadline, id: Date.now(), createdAt: new Date(), updatedAt: new Date() }
    const existing = mockDeadlines.get(deadline.applicationNumber) || []
    existing.push(d)
    mockDeadlines.set(deadline.applicationNumber, existing)
    return d
  }),
  getUpcomingDeadlines: vi.fn(async () => {
    const all: any[] = []
    for (const deadlines of mockDeadlines.values()) {
      all.push(...deadlines)
    }
    return all.filter((d: any) => !d.completed)
  }),
  addFee: vi.fn(async (fee) => {
    const f = { ...fee, id: Date.now(), createdAt: new Date(), updatedAt: new Date() }
    const existing = mockFees.get(fee.applicationNumber) || []
    existing.push(f)
    mockFees.set(fee.applicationNumber, existing)
    return f
  }),
  getPendingFees: vi.fn(async () => {
    const all: any[] = []
    for (const fees of mockFees.values()) {
      all.push(...fees)
    }
    return all.filter((f: any) => f.status === 'pending')
  }),
  getOverdueFees: vi.fn(async () => []),
  getStatistics: vi.fn(async () => ({
    total: mockPatentData.size,
    byStatus: { draft: 0, filed: mockPatentData.size, under_exam: 0 },
    byType: { invention: mockPatentData.size, utility: 0, design: 0 },
  })),
}

vi.mock('../src/database/PatentDatabase.js', () => ({
  PatentDatabase: vi.fn(() => mockDatabase),
  getDefaultDatabase: vi.fn(() => mockDatabase),
}))

describe('PatentManagerAgent', () => {
  let agent: PatentManagerAgent
  let mockNotificationService: NotificationService

  beforeEach(() => {
    // 清空 mock 数据
    mockPatentData.clear()
    mockDeadlines.clear()
    mockFees.clear()
    vi.clearAllMocks()

    // 创建 mock 通知服务
    mockNotificationService = {
      sendNotification: vi.fn(async () => []),
      addConfig: vi.fn(() => 1),
      getConfig: vi.fn(() => undefined),
      getEnabledConfigs: vi.fn(() => []),
      getConfigsByEvent: vi.fn(() => []),
      updateConfig: vi.fn(() => true),
      removeConfig: vi.fn(() => true),
      getLogs: vi.fn(() => []),
    } as unknown as NotificationService

    agent = new PatentManagerAgent({
      database: mockDatabase as any,
      stateMachine: new PatentStateMachine(),
      notificationService: mockNotificationService,
      enableNotifications: false, // 测试时禁用通知
      eventBus: { publish: vi.fn(), subscribe: vi.fn() },
    })
  })

  const createSamplePatent = (applicationNumber: string = 'CN202310000000.0') => ({
    applicationNumber,
    title: '测试专利',
    applicant: '测试公司',
    inventors: ['张三', '李四'],
    patentType: 'invention' as const,
    filingDate: new Date('2023-01-01'),
    status: 'filed' as const,
  })

  describe('初始化', () => {
    it('应该正确实例化', () => {
      expect(agent).toBeDefined()
      expect(agent.getDatabase()).toBeDefined()
      expect(agent.getStateMachine()).toBeDefined()
      expect(agent.getNotificationService()).toBeDefined()
    })
  })

  describe('add_patent 操作', () => {
    it('应该成功添加专利', async () => {
      const result = await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.applicationNumber).toBe('CN202310000000.0')
      expect(mockDatabase.createPatent).toHaveBeenCalled()
    })

    it('空申请号应该抛出错误', async () => {
      await expect(
        agent.execute({
          operation: 'add_patent',
          patent: { ...createSamplePatent(), applicationNumber: '' },
        })
      ).rejects.toThrow('申请号不能为空')
    })

    it('空标题应该抛出错误', async () => {
      await expect(
        agent.execute({
          operation: 'add_patent',
          patent: { ...createSamplePatent(), title: '' },
        })
      ).rejects.toThrow('专利标题不能为空')
    })

    it('添加时应该包含元数据', async () => {
      const result = await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      })

      expect(result.metadata).toBeDefined()
      expect(result.metadata.operation).toBe('add_patent')
      expect(result.metadata.timestamp).toBeInstanceOf(Date)
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('update_patent 操作', () => {
    it('应该成功更新专利', async () => {
      // 先添加
      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      })

      // 更新
      const result = await agent.execute({
        operation: 'update_patent',
        patent: { ...createSamplePatent(), title: '更新后的标题' },
      })

      expect(result.success).toBe(true)
      expect(result.data.title).toBe('更新后的标题')
    })

    it('不存在的专利应该返回错误', async () => {
      mockDatabase.getPatent.mockResolvedValueOnce(null)

      const result = await agent.execute({
        operation: 'update_patent',
        patent: createSamplePatent('NONEXISTENT'),
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('专利不存在')
    })
  })

  describe('remove_patent 操作', () => {
    it('应该成功删除专利', async () => {
      // 先添加
      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      })

      // 删除
      const result = await agent.execute({
        operation: 'remove_patent',
        applicationNumber: 'CN202310000000.0',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })

    it('不存在的专利删除应该返回错误', async () => {
      mockDatabase.deletePatent.mockResolvedValueOnce(false)

      const result = await agent.execute({
        operation: 'remove_patent',
        applicationNumber: 'NONEXISTENT',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('专利不存在')
    })
  })

  describe('get_patent 操作', () => {
    it('应该成功获取专利', async () => {
      // 先添加
      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      })

      const result = await agent.execute({
        operation: 'get_patent',
        applicationNumber: 'CN202310000000.0',
      })

      expect(result.success).toBe(true)
      expect(result.data.applicationNumber).toBe('CN202310000000.0')
    })

    it('不存在的专利应该返回错误', async () => {
      mockDatabase.getPatent.mockResolvedValueOnce(null)

      const result = await agent.execute({
        operation: 'get_patent',
        applicationNumber: 'NONEXISTENT',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('专利不存在')
    })
  })

  describe('list_patents 操作', () => {
    it('应该列出所有专利', async () => {
      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent('CN001'),
      })
      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent('CN002'),
      })

      const result = await agent.execute({
        operation: 'list_patents',
      })

      expect(result.success).toBe(true)
      expect(result.data.patents).toHaveLength(2)
      expect(result.data.total).toBe(2)
    })
  })

  describe('deadline 操作', () => {
    it('应该成功添加截止日期', async () => {
      const result = await agent.execute({
        operation: 'add_deadline',
        applicationNumber: 'CN202310000000.0',
        deadline: {
          type: 'oa_response',
          deadlineDate: new Date('2024-12-31'),
          description: 'OA答复期限',
          priority: 'high',
          completed: false,
        },
      })

      expect(result.success).toBe(true)
      expect(result.data.applicationNumber).toBe('CN202310000000.0')
    })

    it('应该获取即将到期的截止日期', async () => {
      await agent.execute({
        operation: 'add_deadline',
        applicationNumber: 'CN001',
        deadline: {
          type: 'oa_response',
          deadlineDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          description: '即将到期',
          priority: 'high',
          completed: false,
        },
      })

      const result = await agent.execute({
        operation: 'get_upcoming_deadlines',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeInstanceOf(Array)
    })
  })

  describe('fee 操作', () => {
    it('应该成功添加费用', async () => {
      const result = await agent.execute({
        operation: 'add_fee',
        applicationNumber: 'CN202310000000.0',
        fee: {
          feeType: '申请费',
          amount: 1000,
          currency: 'CNY',
          dueDate: new Date('2024-12-31'),
          status: 'pending',
        },
      })

      expect(result.success).toBe(true)
      expect(result.data.applicationNumber).toBe('CN202310000000.0')
    })

    it('应该获取待支付费用', async () => {
      await agent.execute({
        operation: 'add_fee',
        applicationNumber: 'CN001',
        fee: {
          feeType: '年费',
          amount: 2000,
          currency: 'CNY',
          dueDate: new Date(),
          status: 'pending',
        },
      })

      const result = await agent.execute({
        operation: 'get_pending_fees',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeInstanceOf(Array)
    })
  })

  describe('get_portfolio 操作', () => {
    it('应该获取专利组合概览', async () => {
      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      })

      const result = await agent.execute({
        operation: 'get_portfolio',
      })

      expect(result.success).toBe(true)
      expect(result.data.patents).toBeDefined()
      expect(result.data.statistics).toBeDefined()
      expect(result.data.statistics.total).toBe(1)
    })
  })
})

describe('PatentStateMachine', () => {
  let stateMachine: PatentStateMachine

  beforeEach(() => {
    stateMachine = new PatentStateMachine()
  })

  const createSamplePatent = (status: any = 'draft') => ({
    applicationNumber: 'CN001',
    title: '测试专利',
    applicant: '测试公司',
    inventors: ['张三'],
    patentType: 'invention' as const,
    filingDate: new Date(),
    status,
  })

  describe('状态转换验证', () => {
    it('应该允许从 draft 转换到 filed', () => {
      expect(stateMachine.canTransition('draft', 'filed')).toBe(true)
    })

    it('应该允许从 filed 转换到 under_exam', () => {
      expect(stateMachine.canTransition('filed', 'under_exam')).toBe(true)
    })

    it('应该允许从 under_exam 转换到 oa_issued', () => {
      expect(stateMachine.canTransition('under_exam', 'oa_issued')).toBe(true)
    })

    it('应该允许从 oa_issued 转换到 amended', () => {
      expect(stateMachine.canTransition('oa_issued', 'amended')).toBe(true)
    })

    it('应该允许从 allowed 转换到 granted', () => {
      expect(stateMachine.canTransition('allowed', 'granted')).toBe(true)
    })

    it('不应该允许非法的状态转换', () => {
      expect(stateMachine.canTransition('draft', 'granted')).toBe(false)
      expect(stateMachine.canTransition('granted', 'draft')).toBe(false)
    })

    it('相同状态不应该允许转换', () => {
      expect(stateMachine.canTransition('filed', 'filed')).toBe(false)
    })
  })

  describe('终态检查', () => {
    it('应该正确识别终态', () => {
      expect(stateMachine.isTerminalState('granted')).toBe(true)
      expect(stateMachine.isTerminalState('rejected')).toBe(true)
      expect(stateMachine.isTerminalState('abandoned')).toBe(true)
      expect(stateMachine.isTerminalState('expired')).toBe(true)
      expect(stateMachine.isTerminalState('withdrawn')).toBe(true)
      expect(stateMachine.isTerminalState('filed')).toBe(false)
    })
  })

  describe('状态转换执行', () => {
    it('应该成功执行有效的状态转换', async () => {
      const patent = createSamplePatent('draft')
      const result = await stateMachine.transition(patent, 'filed')

      expect(result.success).toBe(true)
      expect(result.newState).toBe('filed')
    })

    it('应该拒绝无效的状态转换', async () => {
      const patent = createSamplePatent('draft')
      const result = await stateMachine.transition(patent, 'granted')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('应该拒绝相同状态的转换', async () => {
      const patent = createSamplePatent('filed')
      const result = await stateMachine.transition(patent, 'filed')

      expect(result.success).toBe(false)
    })
  })

  describe('状态路径查找', () => {
    it('应该找到有效的状态转换路径', () => {
      const paths = stateMachine.getStatePath('draft', 'granted')
      expect(paths.length).toBeGreaterThan(0)
    })

    it('应该找到最短路径', () => {
      const path = stateMachine.getShortestPath('draft', 'granted')
      expect(path).toBeDefined()
      expect(path![0]).toBe('draft')
      expect(path![path!.length - 1]).toBe('granted')
    })

    it('无法到达的状态应该返回空路径', () => {
      const path = stateMachine.getShortestPath('granted', 'draft')
      expect(path).toBeNull()
    })
  })

  describe('状态描述', () => {
    it('应该返回正确的状态描述', () => {
      expect(stateMachine.getStateDescription('draft')).toBe('草稿')
      expect(stateMachine.getStateDescription('filed')).toBe('已提交')
      expect(stateMachine.getStateDescription('granted')).toBe('已授权')
    })
  })
})

describe('NotificationService', () => {
  let notificationService: NotificationService

  beforeEach(() => {
    notificationService = new NotificationService()
  })

  describe('配置管理', () => {
    it('应该成功添加通知配置', () => {
      const id = notificationService.addConfig({
        name: '邮件通知',
        type: 'email',
        config: { email: 'test@example.com' },
        enabled: true,
        events: ['deadline_approaching', 'fee_due'],
      })

      expect(id).toBeGreaterThan(0)

      const config = notificationService.getConfig(id)
      expect(config).toBeDefined()
      expect(config?.name).toBe('邮件通知')
    })

    it('应该获取启用的配置', () => {
      notificationService.addConfig({
        name: '启用通知',
        type: 'email',
        config: { email: 'test@example.com' },
        enabled: true,
        events: ['deadline_approaching'],
      })

      notificationService.addConfig({
        name: '禁用通知',
        type: 'email',
        config: { email: 'test2@example.com' },
        enabled: false,
        events: ['deadline_approaching'],
      })

      const enabled = notificationService.getEnabledConfigs()
      expect(enabled).toHaveLength(1)
      expect(enabled[0].name).toBe('启用通知')
    })

    it('应该根据事件获取配置', () => {
      notificationService.addConfig({
        name: '截止日期通知',
        type: 'email',
        config: { email: 'test@example.com' },
        enabled: true,
        events: ['deadline_approaching'],
      })

      notificationService.addConfig({
        name: '费用通知',
        type: 'email',
        config: { email: 'test2@example.com' },
        enabled: true,
        events: ['fee_due'],
      })

      const configs = notificationService.getConfigsByEvent('deadline_approaching')
      expect(configs).toHaveLength(1)
      expect(configs[0].name).toBe('截止日期通知')
    })

    it('应该成功更新配置', () => {
      const id = notificationService.addConfig({
        name: '原始名称',
        type: 'email',
        config: { email: 'test@example.com' },
        enabled: true,
        events: ['deadline_approaching'],
      })

      const success = notificationService.updateConfig(id, { name: '更新名称' })
      expect(success).toBe(true)

      const config = notificationService.getConfig(id)
      expect(config?.name).toBe('更新名称')
    })

    it('应该成功删除配置', () => {
      const id = notificationService.addConfig({
        name: '待删除',
        type: 'email',
        config: { email: 'test@example.com' },
        enabled: true,
        events: ['deadline_approaching'],
      })

      const success = notificationService.removeConfig(id)
      expect(success).toBe(true)

      const config = notificationService.getConfig(id)
      expect(config).toBeUndefined()
    })
  })

  describe('日志管理', () => {
    it('应该记录通知日志', async () => {
      notificationService.addConfig({
        name: '测试通知',
        type: 'email',
        config: { email: 'test@example.com' },
        enabled: true,
        events: ['deadline_approaching'],
      })

      const results = await notificationService.sendNotification('deadline_approaching', {
        applicationNumber: 'CN001',
        title: '测试专利',
        event: 'deadline_approaching',
        deadlineDate: new Date('2024-12-31'),
      })

      expect(results).toHaveLength(1)
    })

    it('应该获取日志记录', async () => {
      notificationService.addConfig({
        name: '测试通知',
        type: 'email',
        config: { email: 'test@example.com' },
        enabled: true,
        events: ['deadline_approaching'],
      })

      await notificationService.sendNotification('deadline_approaching', {
        applicationNumber: 'CN001',
        title: '测试专利',
        event: 'deadline_approaching',
      })

      const logs = notificationService.getLogs({ event: 'deadline_approaching' })
      expect(logs.length).toBeGreaterThan(0)
    })
  })
})
