/**
 * 端到端测试 - 完整专利工作流程
 *
 * 测试场景：
 * 1. 专利撰写流程：交底书 → 专利申请文件
 * 2. OA 答复流程：OA → 答复文档
 * 3. 专利分析流程：专利 → 分析报告
 * 4. 专利管理流程：全生命周期管理
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import { PatentWriterAgent } from '@yunpat/agent-patent-writer'
import { PatentAnalyzerAgent } from '@yunpat/agent-patent-analyzer'
import { PatentResponderAgent } from '@yunpat/agent-patent-responder'
import { PatentManagerAgent } from '@yunpat/agent-patent-manager'

describe('端到端测试 - 专利工作流程', () => {
  let eventBus: EventBus
  let memory: ShortTermMemory
  let tools: ToolRegistry

  beforeAll(() => {
    eventBus = new EventBus()
    memory = new ShortTermMemory()
    tools = new ToolRegistry(eventBus)
  })

  describe('场景1: 专利撰写流程', () => {
    it('应该完成从交底书到专利申请文件的完整流程', async () => {
      const writerAgent = new PatentWriterAgent({
        name: 'e2e-writer',
        description: '端到端测试 - 专利撰写',
        eventBus,
        memory,
        tools,
        llm: {
          chat: async (messages) => {
            // 模拟 LLM 响应
            return {
              message: {
                content: JSON.stringify({
                  abstract: '本发明提供一种基于深度学习的图像识别方法...',
                  technicalField: '人工智能',
                  backgroundArt: '现有技术存在识别准确率低的问题...',
                  summary: '本发明通过卷积神经网络提取图像特征...',
                  claims: ['1. 一种图像识别方法，其特征在于...'],
                  detailedDescription: '具体实施方式...',
                }),
              },
            }
          },
        } as any,
        enableKnowledge: false,
        enableTemplates: false,
      })

      // 执行撰写
      const writeResult = await writerAgent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        applicant: '测试科技有限公司',
        inventors: ['张三', '李四'],
        technicalDisclosure: `
本发明提供一种基于深度学习的图像识别方法。

技术问题：
现有图像识别方法在复杂场景下准确率低，抗干扰能力差。

技术方案：
采用多层卷积神经网络提取图像特征，通过注意力机制增强关键特征，
最后使用Softmax分类器进行识别。

技术效果：
识别准确率提升20%，抗干扰能力显著增强。
        `,
        drawings: ['图1: 系统架构图', '图2: 网络结构图'],
      })

      // 验证撰写结果
      expect(writeResult).toBeDefined()
      expect(writeResult.patentApplication).toBeDefined()
      expect(writeResult.patentApplication.title).toBe('一种基于深度学习的图像识别方法')
      expect(writeResult.patentApplication.claims).toBeDefined()
      expect(writeResult.patentApplication.claims.length).toBeGreaterThan(0)
      expect(writeResult.metrics).toBeDefined()
      expect(writeResult.metrics.durationMinutes).toBeGreaterThanOrEqual(0)

      // 导出为 CN 格式
      const exportResult = await writerAgent.exportToFormat('cn')

      expect(exportResult.format).toBe('cn')
      expect(exportResult.content).toContain('发明名称')
      expect(exportResult.content).toContain('摘要')
      expect(exportResult.content).toContain('权利要求书')
      expect(exportResult.metadata.title).toBe('一种基于深度学习的图像识别方法')
    })

    it('应该支持批量处理多个专利', async () => {
      const writerAgent = new PatentWriterAgent({
        name: 'e2e-batch-writer',
        description: '端到端测试 - 批量撰写',
        eventBus,
        memory,
        tools,
        llm: {
          chat: async (messages) => ({
            message: {
              content: JSON.stringify({
                abstract: '测试摘要',
                technicalField: '测试领域',
                backgroundArt: '测试背景',
                summary: '测试摘要内容',
                claims: ['1. 测试权利要求'],
                detailedDescription: '测试详细描述',
              }),
            },
          }),
        } as any,
        enableKnowledge: false,
        enableTemplates: false,
      })

      const disclosures = [
        {
          title: '专利1',
          field: 'AI',
          applicant: '公司A',
          inventors: ['张三'],
          technicalDisclosure: '技术交底1',
          drawings: [],
        },
        {
          title: '专利2',
          field: '区块链',
          applicant: '公司B',
          inventors: ['李四'],
          technicalDisclosure: '技术交底2',
          drawings: [],
        },
      ]

      const results = await Promise.all(
        disclosures.map((disclosure) => writerAgent.execute(disclosure))
      )

      expect(results).toHaveLength(2)
      results.forEach((result) => {
        expect(result.patentApplication).toBeDefined()
        expect(result.patentApplication.title).toBeDefined()
      })
    })
  })

  describe('场景2: OA 答复流程', () => {
    it('应该完成从 OA 到答复文档的完整流程', async () => {
      const responderAgent = new PatentResponderAgent({
        name: 'e2e-responder',
        description: '端到端测试 - OA 答复',
        eventBus,
        memory,
        tools,
        llm: {
          chat: async (messages) => {
            // 模拟不同阶段的响应
            const lastMessage = messages[messages.length - 1]
            const content = (lastMessage?.content || '').toLowerCase()
            if (content.includes('分析')) {
              return {
                message: {
                  content: JSON.stringify({
                    summary: '审查员认为权利要求1-3不具备创造性',
                    keyIssues: [
                      {
                        type: 'inventiveness',
                        description: '与对比文件1相比缺乏创造性',
                        severity: 'high',
                      },
                    ],
                    overcomeProbability: 75,
                  }),
                },
              }
            } else if (content.includes('策略')) {
              return {
                message: {
                  content: JSON.stringify({
                    overallStrategy: 'argue',
                    successProbability: 75,
                    keyArguments: ['对比文件1未公开特征X', '特征X带来预料不到的技术效果'],
                    suggestedAmendments: [],
                    additionalEvidence: [],
                    risks: ['成功概率中等'],
                  }),
                },
              }
            } else {
              return {
                message: {
                  content: JSON.stringify({
                    documentType: 'cn',
                    responseLetter:
                      '尊敬的审查员：\n\n关于申请号CN202310000000.0的审查意见，申请人陈述如下意见...',
                    detailedArguments: [
                      {
                        category: '创造性争辩',
                        argument: '对比文件1未公开特征X...',
                        evidence: ['对比文件1第X段', '本申请说明书第Y段'],
                      },
                    ],
                  }),
                },
              }
            }
          },
        } as any,
        enableKnowledge: false,
        enableTemplates: false,
      })

      // 执行答复
      const responseResult = await responderAgent.execute({
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '一种图像识别方法',
          notificationDate: '2024-01-15',
          deadline: '2024-04-15',
          officeActionContent: `
权利要求1-3不具备专利法第22条第3款规定的创造性。

对比文件1(CN112345678A)公开了一种图像识别方法，包括：
- 特征提取步骤
- 分类步骤

权利要求1与对比文件1的区别在于：
权利要求1增加了"注意力机制"。

然而，注意力机制在图像识别领域的应用是本领域技术人员的常规技术手段，
不具备突出的实质性特点和显著的进步。
          `,
          citedReferences: [
            {
              publicationNumber: 'CN112345678A',
              title: '一种图像识别方法',
              relevance: '用于评价创造性',
            },
          ],
          rejectionTypes: ['inventiveness'],
        },
        originalApplication: {
          title: '一种图像识别方法',
          claims: `
1. 一种图像识别方法，其特征在于，包括：
   提取图像特征；
   通过注意力机制增强关键特征；
   使用分类器进行识别。

2. 根据权利要求1所述的方法，其特征在于...
          `,
          description: '本发明提供一种图像识别方法...',
        },
        strategyPreference: 'moderate',
        documentType: 'cn',
      })

      // 验证答复结果
      expect(responseResult).toBeDefined()
      expect(responseResult.analysis).toBeDefined()
      expect(responseResult.analysis.keyIssues).toBeInstanceOf(Array)
      expect(responseResult.strategy).toBeDefined()
      expect(responseResult.strategy.overallStrategy).toBe('argue')
      expect(responseResult.responseDocument).toBeDefined()
      expect(responseResult.responseDocument.responseLetter).toBeDefined()
      expect(responseResult.nextSteps).toBeDefined()

      // 导出答复文档（需要提供input参数）
      const officeActionForExport = {
        applicationNumber: 'CN202310000000.0',
        patentTitle: '一种图像识别方法',
        notificationDate: '2024-01-15',
        deadline: '2024-04-15',
        officeActionContent: '权利要求1-3不具备创造性...',
        citedReferences: [],
        rejectionTypes: ['inventiveness'],
      }

      const mockPatent = {
        applicationNumber: 'CN202310000000.0',
        title: '测试专利',
        claims: ['1. 一种测试方法']
      }

      const exportResult = await responderAgent.exportToFormat(
        responseResult,
        {
          officeAction: officeActionForExport,
          patent: mockPatent,
          responseStrategy: responseResult.strategy,
          responseDocument: responseResult.responseDocument
        },
        'cn'
      )

      expect(exportResult.format).toBe('cn')
      expect(exportResult.content).toContain('审查意见答复书')
      expect(exportResult.metadata.applicationNumber).toBe('CN202310000000.0')
    })
  })

  describe('场景3: 专利分析流程', () => {
    it('应该完成从专利到分析报告的完整流程', async () => {
      const analyzerAgent = new PatentAnalyzerAgent({
        name: 'e2e-analyzer',
        description: '端到端测试 - 专利分析',
        eventBus,
        memory,
        tools,
        llm: {
          chat: async (messages) => {
            const lastMessage = messages[messages.length - 1]
            const content = (lastMessage?.content || '').toLowerCase()
            if (content.includes('技术分析')) {
              return {
                message: {
                  content: JSON.stringify({
                    field: '人工智能',
                    problems: ['识别准确率低'],
                    solution: '采用深度神经网络',
                    effects: ['准确率提升20%'],
                    keyFeatures: ['卷积层', '池化层', '全连接层'],
                  }),
                },
              }
            } else if (content.includes('权利要求')) {
              return {
                message: {
                  content: JSON.stringify({
                    independentCount: 1,
                    dependentCount: 3,
                    protectionScope: { breadth: 'medium', clarity: 'clear', risk: 'low' },
                    qualityScore: 85,
                  }),
                },
              }
            } else if (content.includes('创造性')) {
              return {
                message: {
                  content: JSON.stringify({
                    level: 'inventive',
                    score: 85,
                    reasoning: '技术方案非显而易见',
                  }),
                },
              }
            } else if (content.includes('风险')) {
              return {
                message: {
                  content: JSON.stringify({
                    invalidityRisk: 'low',
                    infringementRisk: 'medium',
                    riskFactors: ['可能存在类似专利'],
                  }),
                },
              }
            } else {
              return {
                message: {
                  content: JSON.stringify({
                    closestPriorArt: [],
                    innovations: ['注意力机制'],
                  }),
                },
              }
            }
          },
        } as any,
        enableKnowledge: false,
        enableTemplates: false,
      })

      // 执行分析
      const analysisResult = await analyzerAgent.execute({
        patent: {
          publicationNumber: 'CN112345678A',
          title: '一种基于深度学习的图像识别方法',
          abstract: '本发明公开了一种图像识别方法...',
          applicant: '测试科技有限公司',
          inventors: ['张三', '李四'],
          publicationDate: '2023-10-15',
          fullText: '权利要求书\n\n1. 一种图像识别方法...',
        },
        analysisTypes: ['technical', 'claims', 'creativity', 'risk'],
      })

      // 验证分析结果
      expect(analysisResult).toBeDefined()
      expect(analysisResult.basicInfo).toBeDefined()
      expect(analysisResult.basicInfo.publicationNumber).toBe('CN112345678A')
      expect(analysisResult.technicalAnalysis).toBeDefined()
      expect(analysisResult.technicalAnalysis.field).toBeDefined()
      expect(analysisResult.claimsAnalysis).toBeDefined()
      expect(analysisResult.creativityAssessment).toBeDefined()
      expect(analysisResult.riskAssessment).toBeDefined()
      expect(analysisResult.recommendations).toBeDefined()
    })
  })

  describe('场景4: 专利管理流程', () => {
    it('应该完成完整的专利生命周期管理', async () => {
      const managerAgent = new PatentManagerAgent({
        name: 'e2e-manager',
        description: '端到端测试 - 专利管理',
        eventBus,
        memory,
        tools,
        llm: {
          chat: async (messages) => ({
            message: {
              content: `
# 专利管理报告

## 总体概况
当前专利组合共1件专利，处于 filed 状态。

## 状态分析
专利状态正常，无异常情况。

## 建议
建议按时提交OA答复。
              `,
            },
          }),
        } as any,
        enableKnowledge: false,
        enableTemplates: false,
      })

      const applicationNumber = 'CN202310000000.0'

      // 1. 添加专利
      const addResult = await managerAgent.execute({
        operation: 'add_patent',
        patent: {
          applicationNumber,
          title: '测试专利',
          applicant: '测试公司',
          inventors: ['张三'],
          patentType: 'invention',
          filingDate: new Date('2023-01-01'),
          status: 'filed',
        },
      })

      expect(addResult.success).toBe(true)
      expect(addResult.data.applicationNumber).toBe(applicationNumber)

      // 2. 添加截止日期
      const deadlineResult = await managerAgent.execute({
        operation: 'add_deadline',
        applicationNumber,
        deadline: {
          type: 'oa_response',
          deadlineDate: new Date('2024-12-31'),
          description: 'OA答复期限',
          priority: 'high',
          completed: false,
        },
      })

      expect(deadlineResult.success).toBe(true)

      // 3. 添加费用
      const feeResult = await managerAgent.execute({
        operation: 'add_fee',
        applicationNumber,
        fee: {
          feeType: '申请费',
          amount: 1000,
          currency: 'CNY',
          dueDate: new Date('2024-06-30'),
          status: 'pending',
        },
      })

      expect(feeResult.success).toBe(true)

      // 4. 查询专利
      const getResult = await managerAgent.execute({
        operation: 'get_patent',
        applicationNumber,
      })

      expect(getResult.success).toBe(true)
      expect(getResult.data.applicationNumber).toBe(applicationNumber)

      // 5. 获取专利组合
      const portfolioResult = await managerAgent.execute({
        operation: 'get_portfolio',
      })

      expect(portfolioResult.success).toBe(true)
      expect(portfolioResult.data.statistics.total).toBe(1)

      // 6. 生成报告
      const reportResult = await managerAgent.execute({
        operation: 'generate_report',
      })

      expect(reportResult.success).toBe(true)
      expect(reportResult.data).toBeDefined()
      expect(typeof reportResult.data).toBe('string')

      // 7. 删除专利
      const removeResult = await managerAgent.execute({
        operation: 'remove_patent',
        applicationNumber,
      })

      expect(removeResult.success).toBe(true)
    })
  })

  describe('场景5: 完整工作流集成', () => {
    it('应该整合多个智能体完成完整的专利流程', async () => {
      // 1. 撰写专利
      const writerAgent = new PatentWriterAgent({
        name: 'e2e-integrated-writer',
        description: '端到端测试 - 集成撰写',
        eventBus,
        memory,
        tools,
        llm: {
          chat: async (messages) => ({
            message: {
              content: JSON.stringify({
                abstract: '测试摘要',
                technicalField: 'AI',
                backgroundArt: '背景',
                summary: '摘要',
                claims: ['1. 测试权利要求'],
                detailedDescription: '描述',
              }),
            },
          }),
        } as any,
        enableKnowledge: false,
        enableTemplates: false,
      })

      const writeResult = await writerAgent.execute({
        title: '集成测试专利',
        field: 'AI',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '测试交底书',
        drawings: [],
      })

      expect(writeResult.patentApplication).toBeDefined()

      // 2. 分析专利
      const analyzerAgent = new PatentAnalyzerAgent({
        name: 'e2e-integrated-analyzer',
        description: '端到端测试 - 集成分析',
        eventBus,
        memory,
        tools,
        llm: {
          chat: async (messages) => ({
            message: {
              content: JSON.stringify({
                field: 'AI',
                problems: [],
                solution: '测试方案',
                effects: [],
                keyFeatures: [],
              }),
            },
          }),
        } as any,
        enableKnowledge: false,
        enableTemplates: false,
      })

      const analysisResult = await analyzerAgent.execute({
        patent: {
          publicationNumber: 'TEST001',
          title: '集成测试专利',
          abstract: '测试摘要',
        },
      })

      expect(analysisResult.technicalAnalysis).toBeDefined()

      // 3. 管理专利
      const managerAgent = new PatentManagerAgent({
        name: 'e2e-integrated-manager',
        description: '端到端测试 - 集成管理',
        eventBus,
        memory,
        tools,
        llm: {
          chat: async (messages) => ({
            message: { content: '管理报告' },
          }),
        } as any,
        enableKnowledge: false,
        enableTemplates: false,
      })

      const managerResult = await managerAgent.execute({
        operation: 'add_patent',
        patent: {
          applicationNumber: 'TEST001',
          title: '集成测试专利',
          applicant: '测试公司',
          inventors: ['张三'],
          patentType: 'invention',
          filingDate: new Date(),
          status: 'filed',
        },
      })

      expect(managerResult.success).toBe(true)

      // 验证整个流程完成
      expect(writeResult.metrics).toBeDefined()
      expect(analysisResult.basicInfo).toBeDefined()
      expect(managerResult.data).toBeDefined()
    })
  })
})
