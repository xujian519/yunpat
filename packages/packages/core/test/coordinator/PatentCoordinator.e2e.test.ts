/**
 * PatentCoordinator 端到端测试
 *
 * 测试覆盖完整专利工作流：
 * - InventionUnderstanding → Search → ClaimGenerator → SpecificationDrafter → QualityChecker
 * - 使用 existingCaseUnderstanding 跳过 LLM 案件理解
 * - 使用 mock Agent 角色替代真实 Agent
 */

import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../src/eventbus/EventBus.js'
import {
  PatentCoordinator,
  createPatentCoordinator,
} from '../../src/coordinator/PatentCoordinator.js'
import type { CoordinatorInput, CaseUnderstanding, AgentRole } from '../../src/coordinator/types.js'
import type { Agent } from '../../src/agent/Agent.js'
import type { MemoryStore, LLMAdapter, ToolRegistry } from '../../src/lifecycle/Lifecycle.js'

// ========== Mock 工厂 ==========

function createMockMemory(): MemoryStore {
  const store = new Map<string, unknown>()
  return {
    get: async (key: string) => store.get(key),
    set: async (key: string, value: unknown) => store.set(key, value),
    delete: async (key: string) => store.delete(key),
    has: async (key: string) => store.has(key),
    getAll: async () => Object.fromEntries(store),
    setAll: async (entries: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(entries)) store.set(k, v)
    },
    clear: async () => store.clear(),
    search: async () => [],
  }
}

function createMockLLM(): LLMAdapter {
  return {
    chat: vi.fn(async () => ({
      content: '',
      message: { content: '' },
    })),
  } as unknown as LLMAdapter
}

function createMockToolRegistry(): ToolRegistry {
  return {
    getTool: vi.fn(),
    getAllTools: vi.fn(() => []),
    register: vi.fn(),
  } as unknown as ToolRegistry
}

function createMockAgent(name: string, output: unknown): Agent {
  return {
    name,
    description: `Mock ${name}`,
    execute: vi.fn(async () => output),
  } as unknown as Agent
}

function createMockAgentRole(id: string, name: string, agent: Agent): AgentRole {
  return {
    id,
    name,
    capabilities: ['mock'],
    agent,
    maxConcurrency: 1,
  }
}

// ========== 测试数据 ==========

const mockCaseUnderstanding: CaseUnderstanding = {
  technicalField: '人工智能 - 自然语言处理',
  technicalProblem: '现有技术在处理长文本时效率低下',
  technicalSolution: '使用分层注意力机制优化长文本处理',
  technicalEffects: ['提高处理速度', '降低内存占用'],
  keyFeatures: ['分层注意力', '动态截断', '并行计算'],
  keywords: ['AI', 'NLP', '注意力机制'],
  ipcHint: 'G06F 16/35',
  patentType: 'invention',
  confidence: 0.92,
  originalInput: '一种基于分层注意力机制的长文本处理方法...',
}

// ========== 测试套件 ==========

describe('PatentCoordinator E2E', () => {
  it('应该执行完整的专利撰写工作流', async () => {
    const eventBus = new EventBus()
    const memory = createMockMemory()
    const tools = createMockToolRegistry()
    const llm = createMockLLM()

    const coordinator = createPatentCoordinator({
      name: 'patent_coordinator',
      description: '专利工作流协调器',
      eventBus,
      memory,
      tools,
      llm,
      coordinatorConfig: {
        enableParallelExecution: true,
        reviewThreshold: 70,
        maxRetries: 1,
      },
    })

    // 注册 mock Agent 角色（覆盖完整工作流）
    coordinator.registerAgentRole(
      createMockAgentRole(
        'invention-understanding',
        '发明理解',
        createMockAgent('invention-understanding', { understood: true })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'prior-art-search',
        '现有技术检索',
        createMockAgent('prior-art-search', { patents: ['CN12345678A'] })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'comparison-analyzer',
        '对比分析',
        createMockAgent('comparison-analyzer', { analysis: 'novel' })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'claim-generator',
        '权利要求生成',
        createMockAgent('claim-generator', { claims: ['1. 一种...'] })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'specification-drafter',
        '说明书撰写',
        createMockAgent('specification-drafter', { specification: '说明书内容...' })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'abstract-drafter',
        '摘要撰写',
        createMockAgent('abstract-drafter', { abstract: '摘要内容...' })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'quality-checker',
        '质量检查',
        createMockAgent('quality-checker', { passed: true })
      )
    )

    const input: CoordinatorInput = {
      userInput: '一种基于分层注意力机制的长文本处理方法...',
      intent: 'draft_full',
      existingCaseUnderstanding: mockCaseUnderstanding,
    }

    const result = await coordinator.execute(input)

    // 验证结果结构
    expect(result).toBeDefined()
    expect(result.caseUnderstanding).toEqual(mockCaseUnderstanding)
    expect(result.workflowPlan).toBeDefined()
    expect(result.workflowPlan.steps.length).toBeGreaterThan(0)
    expect(result.taskResults).toBeDefined()
    expect(result.taskResults.length).toBe(result.workflowPlan.steps.length)
    expect(result.finalOutput).toBeDefined()
    expect(result.executionSummary).toBeDefined()
    expect(result.executionSummary.totalSteps).toBe(result.workflowPlan.steps.length)
    expect(result.executionSummary.completedSteps).toBe(result.workflowPlan.steps.length)
    expect(result.executionSummary.failedSteps).toBe(0)
    expect(result.executionSummary.totalDuration).toBeGreaterThanOrEqual(0)

    // 验证所有步骤都成功完成
    for (const taskResult of result.taskResults) {
      expect(taskResult.status).toBe('completed')
      expect(taskResult.error).toBeUndefined()
    }

    // 验证并行组步骤存在
    const parallelSteps = result.workflowPlan.steps.filter((s) => s.parallelGroup)
    if (parallelSteps.length > 0) {
      const parallelResults = result.taskResults.filter((r) =>
        parallelSteps.some((s) => s.id === r.stepId)
      )
      expect(parallelResults.length).toBe(parallelSteps.length)
    }
  })

  it('应该处理 Agent 执行失败的情况', async () => {
    const eventBus = new EventBus()
    const memory = createMockMemory()
    const tools = createMockToolRegistry()
    const llm = createMockLLM()

    const coordinator = createPatentCoordinator({
      name: 'patent_coordinator',
      description: '专利工作流协调器',
      eventBus,
      memory,
      tools,
      llm,
      coordinatorConfig: {
        enableParallelExecution: false,
        reviewThreshold: 70,
        maxRetries: 1,
      },
    })

    // 注册一个会失败的 Agent
    const failingAgent = createMockAgent('failing-agent', null)
    failingAgent.execute = vi.fn(async () => {
      throw new Error('模拟执行失败')
    })

    // 注册所有需要的 Agent 角色（让 comparison-analyzer 失败）
    coordinator.registerAgentRole(
      createMockAgentRole(
        'invention-understanding',
        '发明理解',
        createMockAgent('invention-understanding', { understood: true })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'prior-art-search',
        '现有技术检索',
        createMockAgent('prior-art-search', { patents: ['CN12345678A'] })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole('comparison-analyzer', '对比分析', failingAgent)
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'claim-generator',
        '权利要求生成',
        createMockAgent('claim-generator', { claims: ['1. 一种...'] })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'specification-drafter',
        '说明书撰写',
        createMockAgent('specification-drafter', { specification: '说明书内容...' })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'abstract-drafter',
        '摘要撰写',
        createMockAgent('abstract-drafter', { abstract: '摘要内容...' })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'quality-checker',
        '质量检查',
        createMockAgent('quality-checker', { passed: true })
      )
    )

    const input: CoordinatorInput = {
      userInput: '一种新型电池技术...',
      intent: 'draft_full',
      existingCaseUnderstanding: {
        ...mockCaseUnderstanding,
        technicalField: '能源 - 电池技术',
      },
    }

    // comparison-analyzer 失败后，依赖它的步骤（claims, spec, abstract, quality）不应执行
    await expect(coordinator.execute(input)).rejects.toThrow(/依赖步骤.*执行失败/)
  })

  it('应该正确执行检索工作流', async () => {
    const eventBus = new EventBus()
    const memory = createMockMemory()
    const tools = createMockToolRegistry()
    const llm = createMockLLM()

    const coordinator = createPatentCoordinator({
      name: 'patent_coordinator',
      description: '专利工作流协调器',
      eventBus,
      memory,
      tools,
      llm,
      coordinatorConfig: {
        enableParallelExecution: true,
      },
    })

    coordinator.registerAgentRole(
      createMockAgentRole(
        'invention-understanding',
        '发明理解',
        createMockAgent('invention-understanding', { understood: true })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'patent-search',
        '专利检索',
        createMockAgent('patent-search', { patents: ['CN12345678A', 'CN87654321B'] })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'researcher',
        '学术检索',
        createMockAgent('researcher', { papers: ['Paper A', 'Paper B'] })
      )
    )
    coordinator.registerAgentRole(
      createMockAgentRole(
        'comparison-report',
        '结果整合',
        createMockAgent('comparison-report', { report: '检索报告' })
      )
    )

    const input: CoordinatorInput = {
      userInput: '检索关于量子计算的最新专利...',
      intent: 'search',
      existingCaseUnderstanding: mockCaseUnderstanding,
    }

    const result = await coordinator.execute(input)

    expect(result).toBeDefined()
    expect(result.workflowPlan.name).toContain('检索')
    expect(result.taskResults.length).toBe(result.workflowPlan.steps.length)
    expect(result.executionSummary.failedSteps).toBe(0)
  })
})
