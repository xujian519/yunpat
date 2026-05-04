import { describe, it, expect, vi } from 'vitest'
import { TaskDecomposer } from '../../src/planning/TaskDecomposer.js'

/**
 * 创建完整的LLM mock对象
 * 包含chat和generate方法，避免测试环境中的方法缺失错误
 */
function createMockLLM(response: any = {}) {
  return {
    chat: vi.fn().mockResolvedValue({
      content: JSON.stringify(response.subGoals || []),
      usage: { promptTokens: 100, completionTokens: 50 },
    }),
    generate: vi.fn().mockResolvedValue(response),
  }
}

describe('TaskDecomposer', () => {
  describe('constructor', () => {
    it('应该使用默认配置', () => {
      const decomposer = new TaskDecomposer()
      expect(decomposer).toBeDefined()
    })

    it('应该使用自定义配置', () => {
      const decomposer = new TaskDecomposer({
        maxDepth: 5,
        maxTasksPerGoal: 20,
        enableIntelligentDecomposition: true,
        domain: 'patent',
      })
      expect(decomposer).toBeDefined()
    })
  })

  describe('decompose', () => {
    it('应该分解简单目标', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose('测试目标')
      expect(plan.goal).toBe('测试目标')
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })

    it('应该处理上下文', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose('测试目标', {
        constraints: ['约束1'],
        resources: ['资源1'],
      })
      expect(plan.goal).toBe('测试目标')
    })

    it('应该处理选项', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { maxDepth: 2, enableIntelligentDecomposition: false }
      )
      expect(plan.goal).toBe('测试目标')
    })

    it('应该使用智能分解', async () => {
      const mockResponse = {
        subGoals: [
          {
            title: '子目标1',
            description: '描述1',
            tasks: [
              {
                title: '任务1',
                description: '任务描述',
                type: 'analysis',
                requiredCapabilities: [],
                estimatedTokens: 100,
                estimatedDuration: 60,
              },
            ],
          },
        ],
      }
      const mockLlm = createMockLLM(mockResponse)

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan.goal).toBe('测试目标')
    })

    it('应该处理自定义规则', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            matchPattern: ['测试'],
            subGoalTemplates: [
              {
                title: '匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务1',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
              },
            ],
          },
        ],
      })

      const plan = await decomposer.decompose('测试目标')
      expect(plan.goal).toBe('测试目标')
    })

    it('应该处理正则规则', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            matchPattern: /测试/,
            subGoalTemplates: [
              {
                title: '匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务1',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
              },
            ],
          },
        ],
      })

      const plan = await decomposer.decompose('测试目标')
      expect(plan.goal).toBe('测试目标')
    })

    it('应该处理空智能分解结果', async () => {
      const mockLlm = createMockLLM({ subGoals: [] })

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan.goal).toBe('测试目标')
    })

    it('应该处理智能分解错误', async () => {
      const mockLlm = {
        generate: vi.fn().mockRejectedValue(new Error('LLM错误')),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan.goal).toBe('测试目标')
    })
  })

  describe('mergeOptions', () => {
    it('应该合并选项', () => {
      const decomposer = new TaskDecomposer({ maxDepth: 5 })
      const plan = decomposer.decompose('测试')
      expect(plan).toBeDefined()
    })
  })

  describe('循环依赖检测', () => {
    it('应该处理循环依赖情况', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose('测试循环依赖')
      expect(plan).toBeDefined()
      expect(plan.dependencies.hasCycles).toBeDefined()
    })
  })

  describe('最大深度限制', () => {
    it('应该在maxDepth=1时创建叶子任务', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose('简单任务', {}, { maxDepth: 1 })
      expect(plan).toBeDefined()
      expect(plan.subGoals).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })

    it('应该在maxDepth=2时分解一层', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose('中等复杂任务', {}, { maxDepth: 2 })
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })
  })

  describe('领域规则匹配', () => {
    it('应该匹配专利领域的规则', async () => {
      const decomposer = new TaskDecomposer({ domain: 'patent' })
      const plan = await decomposer.decompose('撰写专利申请', {}, { domain: 'patent' })
      expect(plan).toBeDefined()
      expect(plan.goal).toBe('撰写专利申请')
    })

    it('应该匹配研究领域的规则', async () => {
      const decomposer = new TaskDecomposer({ domain: 'research' })
      const plan = await decomposer.decompose('进行技术研究', {}, { domain: 'research' })
      expect(plan).toBeDefined()
      expect(plan.goal).toBe('进行技术研究')
    })
  })

  describe('智能分解开关', () => {
    it('应该在不启用智能分解时使用规则分解', async () => {
      const mockLlm = {
        generate: vi.fn(),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: false,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: false }
      )
      expect(plan).toBeDefined()
      expect(mockLlm.generate).not.toHaveBeenCalled()
    })

    it('应该在启用智能分解且有LLM时使用LLM', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              subGoals: [
                {
                  title: '子目标1',
                  description: '描述1',
                  tasks: [
                    {
                      title: '任务1',
                      description: '任务描述',
                      type: 'research',
                      estimatedDuration: 300,
                      estimatedTokens: 2000,
                    },
                  ],
                  priority: 'high',
                },
              ],
            }),
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(mockLlm.chat).toHaveBeenCalled()
    })
  })

  describe('规则匹配模式', () => {
    it('应该使用正则表达式匹配规则', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'regex-rule',
            description: '正则表达式规则',
            matchPattern: /^正则测试/,
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '正则匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务1',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'high' as any,
              },
            ],
          },
        ],
      })

      const plan = await decomposer.decompose('正则测试目标')
      expect(plan).toBeDefined()
    })

    it('应该使用数组模式匹配规则', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'array-rule',
            description: '数组模式规则',
            matchPattern: ['关键词1', '关键词2'],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '数组匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务1',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'medium' as any,
              },
            ],
          },
        ],
      })

      const plan = await decomposer.decompose('包含关键词1的目标')
      expect(plan).toBeDefined()
    })
  })

  describe('LLM未配置情况', () => {
    it('应该在LLM未配置时回退到规则分解', async () => {
      const decomposer = new TaskDecomposer({
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals).toBeDefined()
    })
  })

  describe('LLM响应解析', () => {
    it('应该处理LLM返回的不包含JSON的内容', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: '这是一个纯文本响应，没有JSON',
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })

    it('应该处理LLM返回的无效JSON结构', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              invalidField: 'invalid value',
            }),
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })

    it('应该处理LLM返回的subGoals非数组情况', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              subGoals: '不是数组而是字符串',
            }),
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })
  })

  describe('添加自定义规则', () => {
    it('应该在没有现有规则时添加自定义规则', () => {
      const decomposer = new TaskDecomposer()

      const initialStats = decomposer.getStats()
      expect(initialStats.customRulesCount).toBe(0)

      decomposer.addCustomRule({
        name: 'test-rule',
        description: '测试规则',
        matchPattern: ['测试'],
        strategy: 'sequential',
        subGoalTemplates: [
          {
            title: '子目标',
            description: '描述',
            taskTemplates: [
              {
                title: '任务',
                description: '任务描述',
                type: 'analysis' as any,
                requiredCapabilities: [],
                estimatedTokens: 100,
                estimatedDuration: 60,
              },
            ],
            priority: 'medium' as any,
          },
        ],
      })

      const updatedStats = decomposer.getStats()
      expect(updatedStats.customRulesCount).toBe(1)
    })

    it('应该在有现有规则时添加自定义规则', () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'existing-rule',
            description: '已存在的规则',
            matchPattern: ['已存在'],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '已存在的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'low' as any,
              },
            ],
          },
        ],
      })

      const initialStats = decomposer.getStats()
      expect(initialStats.customRulesCount).toBe(1)

      decomposer.addCustomRule({
        name: 'new-rule',
        description: '新规则',
        matchPattern: ['新规则'],
        strategy: 'sequential',
        subGoalTemplates: [
          {
            title: '新子目标',
            description: '描述',
            taskTemplates: [
              {
                title: '任务',
                description: '任务描述',
                type: 'analysis' as any,
                requiredCapabilities: [],
                estimatedTokens: 100,
                estimatedDuration: 60,
              },
            ],
            priority: 'high' as any,
          },
        ],
      })

      const updatedStats = decomposer.getStats()
      expect(updatedStats.customRulesCount).toBe(2)
    })
  })

  describe('第一个规则匹配', () => {
    it('应该匹配第一个符合的规则', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'first-rule',
            description: '第一个规则',
            matchPattern: ['第一个'],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '第一个规则的子目标',
                description: '第一个规则的描述',
                taskTemplates: [
                  {
                    title: '第一个规则的任务',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'high' as any,
              },
            ],
          },
          {
            name: 'second-rule',
            description: '第二个规则',
            matchPattern: ['第一个', '第二个'],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '第二个规则的子目标',
                description: '第二个规则的描述',
                taskTemplates: [
                  {
                    title: '第二个规则的任务',
                    description: '任务描述',
                    type: 'writing' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 200,
                    estimatedDuration: 120,
                  },
                ],
                priority: 'medium' as any,
              },
            ],
          },
        ],
      })

      const plan = await decomposer.decompose('第一个测试目标')
      expect(plan).toBeDefined()
      expect(plan.subGoals[0].title).toBe('第一个规则的子目标')
    })
  })

  describe('深度分解场景', () => {
    it('应该在 maxDepth 为 3 时正确处理深度', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose('深度测试', {}, { maxDepth: 3 })
      expect(plan).toBeDefined()
    })

    it('应该在 maxDepth 为 1 时立即创建叶子任务', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose('简单任务', {}, { maxDepth: 1 })
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBe(1)
      expect(plan.subGoals[0].title).toBe('简单任务')
    })
  })

  describe('循环依赖检测', () => {
    it('应该在检测到循环依赖时输出警告', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const decomposer = new TaskDecomposer()

      const plan = await decomposer.decompose('循环依赖测试')

      expect(plan).toBeDefined()
      expect(plan.dependencies.hasCycles).toBeDefined()
      consoleWarnSpy.mockRestore()
    })
  })

  describe('规则匹配详细测试', () => {
    it('应该使用正则表达式模式匹配规则（区分大小写）', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'regex-case-sensitive',
            description: '区分大小写的正则规则',
            matchPattern: /^TEST/i,
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '正则匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'medium' as any,
              },
            ],
          },
        ],
      })

      const plan = await decomposer.decompose('test goal')
      expect(plan).toBeDefined()
    })

    it('应该使用数组模式匹配规则（大小写不敏感）', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'array-case-insensitive',
            description: '大小写不敏感的数组规则',
            matchPattern: ['PATENT', '专利'],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '数组匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'medium' as any,
              },
            ],
          },
        ],
      })

      const plan = await decomposer.decompose('patent application')
      expect(plan).toBeDefined()
    })

    it('应该在不匹配任何规则时返回 null', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'never-match',
            description: '永远不会匹配的规则',
            matchPattern: ['xyz123'],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '不会匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'low' as any,
              },
            ],
          },
        ],
      })

      const plan = await decomposer.decompose('普通目标')
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })
  })

  describe('智能分解详细测试', () => {
    it('应该在 LLM 未配置时回退到规则分解', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const decomposer = new TaskDecomposer({
        llm: undefined as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
      consoleErrorSpy.mockRestore()
    })

    it('应该在 LLM 调用失败时回退到规则分解', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockLlm = {
        chat: vi.fn().mockRejectedValue(new Error('网络错误')),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '智能分解失败，回退到规则分解:',
        expect.any(Error)
      )
      consoleErrorSpy.mockRestore()
    })

    it('应该在 LLM 返回空 message.content 时处理', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: undefined,
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })

    it('应该在 LLM 返回 null message 时处理', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: null,
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })
  })

  describe('JSON 解析详细测试', () => {
    it('应该处理 LLM 返回不包含 JSON 的内容', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: '这是一段纯文本，没有任何 JSON 数据',
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
      consoleErrorSpy.mockRestore()
    })

    it('应该处理 LLM 返回无效的 JSON 格式', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: '{ invalid json }',
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
      consoleErrorSpy.mockRestore()
    })

    it('应该处理 JSON 解析异常', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              subGoals: [
                {
                  title: '子目标',
                  tasks: [
                    {
                      title: '任务',
                      type: 'invalid type',
                      estimatedDuration: 'not a number',
                      estimatedTokens: 'not a number',
                    },
                  ],
                },
              ],
            }),
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
      consoleErrorSpy.mockRestore()
    })
  })

  describe('添加自定义规则详细测试', () => {
    it('应该在 customRules 为 undefined 时初始化数组', () => {
      const decomposer = new TaskDecomposer({})

      const initialStats = decomposer.getStats()
      expect(initialStats.customRulesCount).toBe(0)

      decomposer.addCustomRule({
        name: 'new-rule',
        description: '新规则',
        matchPattern: ['新'],
        strategy: 'sequential',
        subGoalTemplates: [
          {
            title: '新子目标',
            description: '描述',
            taskTemplates: [
              {
                title: '任务',
                description: '任务描述',
                type: 'analysis' as any,
                requiredCapabilities: [],
                estimatedTokens: 100,
                estimatedDuration: 60,
              },
            ],
            priority: 'medium' as any,
          },
        ],
      })

      const updatedStats = decomposer.getStats()
      expect(updatedStats.customRulesCount).toBe(1)
    })

    it('应该在 customRules 为空数组时添加规则', () => {
      const decomposer = new TaskDecomposer({
        customRules: [],
      })

      decomposer.addCustomRule({
        name: 'new-rule',
        description: '新规则',
        matchPattern: ['新'],
        strategy: 'sequential',
        subGoalTemplates: [
          {
            title: '新子目标',
            description: '描述',
            taskTemplates: [
              {
                title: '任务',
                description: '任务描述',
                type: 'analysis' as any,
                requiredCapabilities: [],
                estimatedTokens: 100,
                estimatedDuration: 60,
              },
            ],
            priority: 'medium' as any,
          },
        ],
      })

      const stats = decomposer.getStats()
      expect(stats.customRulesCount).toBe(1)
    })
  })

  describe('任务类型和优先级解析', () => {
    it('应该将无效任务类型默认为 WRITING', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              subGoals: [
                {
                  title: '子目标',
                  description: '描述',
                  tasks: [
                    {
                      title: '任务',
                      description: '任务描述',
                      type: 'invalid-type',
                      estimatedDuration: 300,
                      estimatedTokens: 2000,
                    },
                  ],
                  priority: 'high',
                },
              ],
            }),
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals[0].tasks[0].type).toBe('writing')
    })

    it('应该将无效优先级默认为 MEDIUM', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              subGoals: [
                {
                  title: '子目标',
                  description: '描述',
                  tasks: [
                    {
                      title: '任务',
                      description: '任务描述',
                      type: 'research',
                      estimatedDuration: 300,
                      estimatedTokens: 2000,
                    },
                  ],
                  priority: 'invalid-priority',
                },
              ],
            }),
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals[0].priority).toBe('medium')
    })

    it('应该处理缺失的任务类型', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              subGoals: [
                {
                  title: '子目标',
                  description: '描述',
                  tasks: [
                    {
                      title: '任务',
                      description: '任务描述',
                      estimatedDuration: 300,
                      estimatedTokens: 2000,
                    },
                  ],
                  priority: 'high',
                },
              ],
            }),
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals[0].tasks[0].type).toBe('writing')
    })
  })

  describe('统计信息计算', () => {
    it('应该正确计算空目标的统计信息', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose('空目标测试', {}, { maxDepth: 1 })

      expect(plan).toBeDefined()
      expect(plan.metadata).toBeDefined()
      expect(plan.metadata.stats).toBeDefined()
      expect(plan.metadata.stats.totalGoals).toBe(1)
    })

    it('应该正确计算多个子目标的统计信息', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose('多目标测试')

      expect(plan).toBeDefined()
      expect(plan.metadata.stats.totalGoals).toBeGreaterThan(1)
      expect(plan.metadata.stats.totalTasks).toBeGreaterThan(0)
      expect(plan.metadata.stats.totalEstimatedDuration).toBeGreaterThan(0)
      expect(plan.metadata.stats.totalEstimatedTokens).toBeGreaterThan(0)
    })
  })

  describe('领域规则应用', () => {
    it('应该应用专利领域规则', async () => {
      const decomposer = new TaskDecomposer({ domain: 'patent' })
      const plan = await decomposer.decompose('申请专利', {}, { domain: 'patent' })

      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })

    it('应该应用研究领域规则', async () => {
      const decomposer = new TaskDecomposer({ domain: 'research' })
      const plan = await decomposer.decompose('进行学术研究', {}, { domain: 'research' })

      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })

    it('应该在未知领域使用通用规则', async () => {
      const decomposer = new TaskDecomposer({ domain: 'unknown-domain' })
      const plan = await decomposer.decompose('测试目标', {}, { domain: 'unknown-domain' })

      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })
  })

  describe('能力推断', () => {
    it('应该为不同任务类型推断正确的能力', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              subGoals: [
                {
                  title: '研究子目标',
                  description: '描述',
                  tasks: [
                    {
                      title: '研究任务',
                      description: '任务描述',
                      type: 'research',
                      estimatedDuration: 300,
                      estimatedTokens: 2000,
                    },
                    {
                      title: '分析任务',
                      description: '任务描述',
                      type: 'analysis',
                      estimatedDuration: 240,
                      estimatedTokens: 1500,
                    },
                    {
                      title: '撰写任务',
                      description: '任务描述',
                      type: 'writing',
                      estimatedDuration: 600,
                      estimatedTokens: 3000,
                    },
                    {
                      title: '验证任务',
                      description: '任务描述',
                      type: 'validation',
                      estimatedDuration: 300,
                      estimatedTokens: 2000,
                    },
                    {
                      title: '生成任务',
                      description: '任务描述',
                      type: 'generation',
                      estimatedDuration: 900,
                      estimatedTokens: 5000,
                    },
                    {
                      title: '审查任务',
                      description: '任务描述',
                      type: 'review',
                      estimatedDuration: 240,
                      estimatedTokens: 1500,
                    },
                  ],
                  priority: 'high',
                },
              ],
            }),
          },
        }),
      }

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals[0].tasks[0].requiredCapabilities).toContain('search')
      expect(plan.subGoals[0].tasks[1].requiredCapabilities).toContain('analysis')
      expect(plan.subGoals[0].tasks[2].requiredCapabilities).toContain('writing')
      expect(plan.subGoals[0].tasks[3].requiredCapabilities).toContain('validation')
      expect(plan.subGoals[0].tasks[4].requiredCapabilities).toContain('generation')
      expect(plan.subGoals[0].tasks[5].requiredCapabilities).toContain('review')
    })
  })

  describe('规则匹配边界情况', () => {
    it('应该处理既不是正则也不是数组的 matchPattern', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'invalid-pattern-rule',
            description: '无效模式的规则',
            matchPattern: null as any,
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '不会匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'low' as any,
              },
            ],
          },
        ],
      })

      const plan = await decomposer.decompose('测试目标')
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })

    it('应该处理空数组的 matchPattern', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'empty-array-rule',
            description: '空数组模式的规则',
            matchPattern: [],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '不会匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'low' as any,
              },
            ],
          },
        ],
      })

      const plan = await decomposer.decompose('测试目标')
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })
  })

  describe('LLM 配置边界情况', () => {
    it('应该在 config.llm 为 null 时使用规则分解', async () => {
      const decomposer = new TaskDecomposer({
        llm: null as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })

    it('应该在 config.llm 缺失 chat 方法时使用规则分解', async () => {
      const invalidLlm = {
        generate: vi.fn(),
      }

      const decomposer = new TaskDecomposer({
        llm: invalidLlm as any,
        enableIntelligentDecomposition: true,
      })

      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { enableIntelligentDecomposition: true }
      )
      expect(plan).toBeDefined()
      expect(plan.subGoals.length).toBeGreaterThan(0)
    })
  })

  describe('customRules 初始化详细测试', () => {
    it('应该在第一次添加规则时初始化 customRules 数组', () => {
      const decomposer = new TaskDecomposer({})

      const statsBefore = decomposer.getStats()
      expect(statsBefore.customRulesCount).toBe(0)

      decomposer.addCustomRule({
        name: 'first-rule',
        description: '第一个规则',
        matchPattern: ['测试'],
        strategy: 'sequential',
        subGoalTemplates: [
          {
            title: '子目标',
            description: '描述',
            taskTemplates: [
              {
                title: '任务',
                description: '任务描述',
                type: 'analysis' as any,
                requiredCapabilities: [],
                estimatedTokens: 100,
                estimatedDuration: 60,
              },
            ],
            priority: 'medium' as any,
          },
        ],
      })

      const statsAfter = decomposer.getStats()
      expect(statsAfter.customRulesCount).toBe(1)
    })

    it('应该向已有的 customRules 数组添加规则', () => {
      const decomposer = new TaskDecomposer({
        customRules: [],
      })

      decomposer.addCustomRule({
        name: 'another-rule',
        description: '另一个规则',
        matchPattern: ['另一个'],
        strategy: 'sequential',
        subGoalTemplates: [
          {
            title: '子目标',
            description: '描述',
            taskTemplates: [
              {
                title: '任务',
                description: '任务描述',
                type: 'writing' as any,
                requiredCapabilities: [],
                estimatedTokens: 200,
                estimatedDuration: 120,
              },
            ],
            priority: 'high' as any,
          },
        ],
      })

      const stats = decomposer.getStats()
      expect(stats.customRulesCount).toBe(1)
    })
  })

  describe('createTask 方法覆盖', () => {
    it('应该创建正确格式的任务对象', async () => {
      const decomposer = new TaskDecomposer()
      const plan = await decomposer.decompose('测试任务创建', {}, { maxDepth: 1 })

      expect(plan).toBeDefined()
      expect(plan.subGoals).toBeDefined()
      expect(plan.subGoals.length).toBe(1)
      expect(plan.subGoals[0].tasks).toBeDefined()
      expect(plan.subGoals[0].tasks.length).toBe(1)
      expect(plan.subGoals[0].tasks[0].id).toBeDefined()
      expect(plan.subGoals[0].tasks[0].title).toBe('测试任务创建')
      expect(plan.subGoals[0].tasks[0].type).toBe('writing')
      expect(plan.subGoals[0].tasks[0].status).toBe('pending')
      expect(plan.subGoals[0].tasks[0].requiredCapabilities).toEqual(['general'])
      expect(plan.subGoals[0].tasks[0].estimatedTokens).toBe(3000)
      expect(plan.subGoals[0].tasks[0].estimatedDuration).toBe(600)
      expect(plan.subGoals[0].tasks[0].createdAt).toBeInstanceOf(Date)
    })
  })

  describe('mergeOptions 边界情况', () => {
    it('应该正确合并所有选项参数', async () => {
      const decomposer = new TaskDecomposer({
        maxDepth: 2,
        maxTasksPerGoal: 5,
        enableIntelligentDecomposition: true,
        domain: 'test',
      })

      const plan = await decomposer.decompose(
        '测试选项合并',
        {},
        {
          maxDepth: 4,
          enableIntelligentDecomposition: false,
          customRules: [],
        }
      )

      expect(plan).toBeDefined()
      expect(plan.metadata).toBeDefined()
      expect(plan.metadata.decompositionOptions).toBeDefined()
      expect(plan.metadata.decompositionOptions.maxDepth).toBe(4)
      expect(plan.metadata.decompositionOptions.maxTasksPerGoal).toBe(5)
      expect(plan.metadata.decompositionOptions.enableIntelligentDecomposition).toBe(false)
      expect(plan.metadata.decompositionOptions.domain).toBe('test')
    })
  })
})
