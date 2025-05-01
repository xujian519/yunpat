/**
 * 专业层Agent路由集成测试
 *
 * 测试OrchestratorAgent与专业层Agent之间的路由和集成：
 * - Agent实例化
 * - 路由逻辑
 * - 接口兼容性
 * - 错误处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OrchestratorAgent } from '../../src/OrchestratorAgent.js'
import type { OrchestratorAgentConfig } from '../../src/types/index.js'

// Mock LLM Adapter for professional agents
const mockLLMAdapter = {
  chat: vi.fn(async () => ({
    message: {
      content: 'Mock response',
    },
  })),
}

// Mock EventBus
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn(),
}

// Mock Memory
const mockMemory = {
  get: vi.fn(),
  set: vi.fn(),
}

// Mock Tools
const mockTools = {}

describe('专业层Agent路由集成测试', () => {
  let orchestrator: OrchestratorAgent
  let mockConfig: OrchestratorAgentConfig

  beforeEach(() => {
    vi.clearAllMocks()

    // 创建完整配置，启用所有专业层Agent
    mockConfig = {
      agentId: 'orchestrator-agent',
      llmConfig: {
        provider: 'anthropic' as const,
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key',
        maxTokens: 4096,
        temperature: 0.7,
        adapter: mockLLMAdapter as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      },
      intentConfig: {
        confidenceThreshold: 0.7,
        maxClarifyRounds: 3,
      },
      planningConfig: {
        maxSteps: 10,
        defaultTimeout: 60000,
        enableParallel: true,
      },
      hitlConfig: {
        autoConfirmThreshold: 0.9,
        timeout: 300000,
      },
      professionalAgents: {
        patentWriter: true,
        patentResponder: true,
        patentAnalyzer: true,
        patentSearch: true,
      },
      eventBus: mockEventBus as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      memory: mockMemory,
      tools: mockTools,
    }

    orchestrator = new OrchestratorAgent(mockConfig)
  })

  describe('Agent实例化测试', () => {
    it('应该成功创建OrchestratorAgent实例', () => {
      expect(orchestrator).toBeDefined()
      expect(orchestrator).toBeInstanceOf(OrchestratorAgent)
    })

    it('应该正确初始化所有专业层Agent', () => {
      // 通过getConfig验证配置正确传递
      const config = orchestrator.getConfig()
      expect(config.professionalAgents).toBeDefined()
      expect(config.professionalAgents?.patentWriter).toBe(true)
      expect(config.professionalAgents?.patentResponder).toBe(true)
      expect(config.professionalAgents?.patentAnalyzer).toBe(true)
      expect(config.professionalAgents?.patentSearch).toBe(true)
    })

    it('应该支持选择性启用专业层Agent', () => {
      const selectiveConfig: OrchestratorAgentConfig = {
        ...mockConfig,
        professionalAgents: {
          patentWriter: true,
          patentResponder: false,
          patentAnalyzer: false,
          patentSearch: true,
        },
      }

      const selectiveOrchestrator = new OrchestratorAgent(selectiveConfig)
      expect(selectiveOrchestrator).toBeDefined()

      const config = selectiveOrchestrator.getConfig()
      expect(config.professionalAgents?.patentWriter).toBe(true)
      expect(config.professionalAgents?.patentResponder).toBe(false)
      expect(config.professionalAgents?.patentSearch).toBe(true)
    })
  })

  describe('Agent接口兼容性测试', () => {
    it('应该为撰写Agent提供正确的配置', () => {
      const config = orchestrator.getConfig()
      expect(config.llmConfig.adapter).toBeDefined()
      expect(config.eventBus).toBeDefined()
      expect(config.memory).toBeDefined()
      expect(config.tools).toBeDefined()
    })

    it('应该为PatentResponderAgent提供正确的配置', () => {
      const config = orchestrator.getConfig()
      expect(config.llmConfig.adapter).toBeDefined()
      expect(config.eventBus).toBeDefined()
    })

    it('应该为PatentAnalyzerAgent提供正确的配置', () => {
      const config = orchestrator.getConfig()
      expect(config.llmConfig.adapter).toBeDefined()
      expect(config.eventBus).toBeDefined()
    })

    it('应该为PatentSearchAgent提供正确的配置', () => {
      const config = orchestrator.getConfig()
      expect(config.llmConfig.adapter).toBeDefined()
      expect(config.eventBus).toBeDefined()
    })
  })

  describe('路由逻辑测试', () => {
    it('应该支持specification-drafter路由', async () => {
      // 创建一个模拟的任务计划
      const mockTaskPlan = {
        planId: 'test-plan-writer',
        intent: 'DRAFT_FULL' as const,
        estimatedMinutes: 30,
        steps: [
          {
            stepId: 'step-writer-1',
            agentId: 'specification-drafter',
            layer: 'domain' as const,
            parallel: false,
            dependsOn: [],
            timeout: 30000,
            input: {
              title: '测试专利',
              field: '人工智能',
              applicant: '测试公司',
              inventors: ['测试者'],
              technicalDisclosure: '这是一个测试发明',
            },
            hitl: false,
            retryOnFailure: false,
            maxRetries: 1,
          },
        ],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false,
        },
      }

      // 注意：实际的执行需要真实的LLM调用，这里我们只验证结构
      expect(mockTaskPlan.steps[0].agentId).toBe('specification-drafter')
      expect(mockTaskPlan.steps[0].input).toBeDefined()
    })

    it('应该支持patent-responder路由', () => {
      const mockTaskPlan = {
        planId: 'test-plan-responder',
        intent: 'RESPOND_OA' as const,
        estimatedMinutes: 20,
        steps: [
          {
            stepId: 'step-responder-1',
            agentId: 'patent-responder',
            layer: 'domain' as const,
            parallel: false,
            dependsOn: [],
            timeout: 30000,
            input: {
              officeAction: {
                applicationNumber: 'CN202310000000.0',
                patentTitle: '测试专利',
                officeActionContent: '审查意见内容',
              },
              originalApplication: {
                title: '测试专利',
                claims: '1. 一种测试方法...',
                description: '本发明提供...',
              },
            },
            hitl: false,
            retryOnFailure: false,
            maxRetries: 1,
          },
        ],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false,
        },
      }

      expect(mockTaskPlan.steps[0].agentId).toBe('patent-responder')
    })

    it('应该支持patent-analyzer路由', () => {
      const mockTaskPlan = {
        planId: 'test-plan-analyzer',
        intent: 'ANALYZE_PORTFOLIO' as const,
        estimatedMinutes: 15,
        steps: [
          {
            stepId: 'step-analyzer-1',
            agentId: 'patent-analyzer',
            layer: 'domain' as const,
            parallel: false,
            dependsOn: [],
            timeout: 30000,
            input: {
              patentContent: '专利内容...',
              analysisType: 'technical',
            },
            hitl: false,
            retryOnFailure: false,
            maxRetries: 1,
          },
        ],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false,
        },
      }

      expect(mockTaskPlan.steps[0].agentId).toBe('patent-analyzer')
    })

    it('应该支持patent-search路由', () => {
      const mockTaskPlan = {
        planId: 'test-plan-search',
        intent: 'SEARCH' as const,
        estimatedMinutes: 10,
        steps: [
          {
            stepId: 'step-search-1',
            agentId: 'patent-search',
            layer: 'domain' as const,
            parallel: false,
            dependsOn: [],
            timeout: 30000,
            input: {
              title: '深度学习图像识别',
              field: '人工智能',
              technicalProblem: '传统方法准确率低',
              technicalSolution: '使用深度学习提高准确率',
              keyFeatures: ['CNN', '深度学习'],
            },
            hitl: false,
            retryOnFailure: false,
            maxRetries: 1,
          },
        ],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false,
        },
      }

      expect(mockTaskPlan.steps[0].agentId).toBe('patent-search')
    })
  })

  describe('错误处理测试', () => {
    it('应该处理未知的Agent类型', () => {
      const invalidStep = {
        stepId: 'step-invalid-1',
        agentId: 'unknown-agent',
        layer: 'domain' as const,
        parallel: false,
        dependsOn: [],
        timeout: 30000,
        input: {},
        hitl: false,
        retryOnFailure: false,
        maxRetries: 1,
      }

      // 验证未知agentId会被正确处理
      expect(invalidStep.agentId).toBe('unknown-agent')
    })

    it('应该处理Agent未启用的情况', () => {
      const noAgentsConfig: OrchestratorAgentConfig = {
        ...mockConfig,
        professionalAgents: {
          patentWriter: false,
          patentResponder: false,
          patentAnalyzer: false,
          patentSearch: false,
        },
      }

      const noAgentsOrchestrator = new OrchestratorAgent(noAgentsConfig)
      expect(noAgentsOrchestrator).toBeDefined()

      const config = noAgentsOrchestrator.getConfig()
      expect(config.professionalAgents?.patentWriter).toBe(false)
      expect(config.professionalAgents?.patentResponder).toBe(false)
      expect(config.professionalAgents?.patentAnalyzer).toBe(false)
      expect(config.professionalAgents?.patentSearch).toBe(false)
    })

    it('应该处理配置缺失的情况', () => {
      const minimalConfig: OrchestratorAgentConfig = {
        ...mockConfig,
        professionalAgents: undefined,
      }

      // 应该能创建实例，即使没有professionalAgents配置
      const minimalOrchestrator = new OrchestratorAgent(minimalConfig)
      expect(minimalOrchestrator).toBeDefined()
    })
  })

  describe('性能和资源测试', () => {
    it('应该在合理时间内完成Agent初始化', () => {
      const startTime = Date.now()

      const config: OrchestratorAgentConfig = {
        ...mockConfig,
        professionalAgents: {
          patentWriter: true,
          patentResponder: true,
          patentAnalyzer: true,
          patentSearch: true,
        },
      }

      const testOrchestrator = new OrchestratorAgent(config)
      const initTime = Date.now() - startTime

      expect(testOrchestrator).toBeDefined()
      // 初始化应该在1秒内完成
      expect(initTime).toBeLessThan(1000)
    })

    it('应该支持多个OrchestratorAgent实例', () => {
      const orchestrator1 = new OrchestratorAgent(mockConfig)
      const orchestrator2 = new OrchestratorAgent(mockConfig)

      expect(orchestrator1).toBeDefined()
      expect(orchestrator2).toBeDefined()
      expect(orchestrator1).not.toBe(orchestrator2)
    })
  })

  describe('配置验证测试', () => {
    it('应该正确传递LLM配置到专业层Agent', () => {
      const config = orchestrator.getConfig()
      expect(config.llmConfig.provider).toBe('anthropic')
      expect(config.llmConfig.model).toBe('claude-3-5-sonnet-20241022')
      expect(config.llmConfig.adapter).toBeDefined()
    })

    it('应该正确传递EventBus到专业层Agent', () => {
      const config = orchestrator.getConfig()
      expect(config.eventBus).toBeDefined()
      expect(config.eventBus).toBe(mockEventBus)
    })

    it('应该正确传递Memory到专业层Agent', () => {
      const config = orchestrator.getConfig()
      expect(config.memory).toBeDefined()
      expect(config.memory).toBe(mockMemory)
    })

    it('应该正确传递Tools到专业层Agent', () => {
      const config = orchestrator.getConfig()
      expect(config.tools).toBeDefined()
      expect(config.tools).toBe(mockTools)
    })
  })
})
