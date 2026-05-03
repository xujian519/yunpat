/**
 * 增强版审查答复智能体测试套件
 *
 * 测试所有实现的功能模块：
 * 1. ExaminerSimulator - 审查员模拟器
 * 2. SuccessPredictor - 成功率预测器
 * 3. HebbianOptimizer - 赫布学习优化器
 * 4. EnhancedPatentResponderAgent - 增强版答复智能体
 * 5. InteractiveWorkflow - 交互式工作流
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ExaminerSimulator } from '../../patents/agents/responder/ExaminerSimulator.js'
import { SuccessPredictor } from '../../patents/agents/responder/SuccessPredictor.js'
import { HebbianOptimizer } from '../../patents/agents/responder/HebbianOptimizer.js'
import { EnhancedPatentResponderAgent } from '../../patents/agents/responder/EnhancedPatentResponderAgent.js'
import { InteractiveWorkflow } from '../../patents/agents/responder/InteractiveWorkflow.js'

// Mock LLM Adapter
class MockLLMAdapter {
  async chat(params: any): Promise<any> {
    // 返回模拟的 LLM 响应
    return {
      message: {
        content: JSON.stringify({
          score: 75,
          reasoning: '模拟的LLM响应',
        }),
      },
    }
  }
}

describe('增强版审查答复智能体测试套件', () => {
  let mockLLM: MockLLMAdapter

  beforeEach(() => {
    mockLLM = new MockLLMAdapter()
  })

  describe('ExaminerSimulator - 审查员模拟器', () => {
    let simulator: ExaminerSimulator

    beforeEach(() => {
      simulator = new ExaminerSimulator(mockLLM as any, {
        strictness: 0.7,
        conservativeMode: false,
      })
    })

    it('应该成功初始化审查员模拟器', () => {
      expect(simulator).toBeDefined()
    })

    it('应该模拟审查答复文档', async () => {
      const mockOfficeAction = {
        oa_type: 'Novelty',
        citations: [{ document_number: 'D1', relevancy: 'high', claims_affected: [1, 2] }],
        affected_claims: [1, 2],
        examiner_arguments: '对比文件D1公开了所有技术特征',
      }

      const mockResponse = {
        writtenArgument: '意见陈述书内容',
        amendedClaims: ['1. 修改后的权利要求'],
        amendmentComparison: '修改对照',
        responseStrategy: 'amendment' as const,
      }

      const result = await simulator.simulateReview(mockOfficeAction as any, mockResponse)

      expect(result).toBeDefined()
      expect(result.acceptProbability).toBeGreaterThanOrEqual(0)
      expect(result.acceptProbability).toBeLessThanOrEqual(100)
      expect(result.likelyRejections).toBeInstanceOf(Array)
      expect(result.suggestions).toBeInstanceOf(Array)
      expect(result.riskAssessment).toHaveProperty('level')
    })

    it('应该批量模拟多个答复方案', async () => {
      const mockOfficeAction = {
        oa_type: 'InventiveStep',
        citations: [],
        affected_claims: [1],
        examiner_arguments: '缺乏创造性',
      }

      const mockResponses = [
        {
          writtenArgument: '方案1',
          amendedClaims: ['1. 方案1权利要求'],
          amendmentComparison: '对照1',
          responseStrategy: 'amendment' as const,
        },
        {
          writtenArgument: '方案2',
          amendedClaims: ['1. 方案2权利要求'],
          amendmentComparison: '对照2',
          responseStrategy: 'argument' as const,
        },
      ]

      const results = await simulator.simulateMultipleResponses(
        mockOfficeAction as any,
        mockResponses
      )

      expect(results).toHaveLength(2)
      expect(results[0].result).toBeDefined()
      expect(results[1].result).toBeDefined()

      // 应该按接受概率排序
      expect(results[0].result.acceptProbability).toBeGreaterThanOrEqual(
        results[1].result.acceptProbability
      )
    })
  })

  describe('SuccessPredictor - 成功率预测器', () => {
    let predictor: SuccessPredictor

    beforeEach(() => {
      predictor = new SuccessPredictor(mockLLM as any, {
        useHistoricalData: true,
        conservatism: 0.5,
      })
    })

    it('应该成功初始化成功率预测器', () => {
      expect(predictor).toBeDefined()
    })

    it('应该预测答复成功率', async () => {
      const mockOfficeAction = {
        oa_type: 'Novelty',
        citations: [],
        affected_claims: [1],
        examiner_arguments: '缺乏新颖性',
      }

      const mockStrategy = {
        strategy_type: 'AmendClaims' as const,
        reasoning: '修改权利要求',
        confidence: 0.8,
      }

      const result = await predictor.predict(
        mockOfficeAction as any,
        mockStrategy,
        75
      )

      expect(result).toBeDefined()
      expect(result.successProbability).toBeGreaterThanOrEqual(0)
      expect(result.successProbability).toBeLessThanOrEqual(100)
      expect(result.confidenceInterval).toHaveProperty('lower')
      expect(result.confidenceInterval).toHaveProperty('upper')
      expect(result.featureImportance).toBeInstanceOf(Array)
      expect(result.analysis).toHaveProperty('strengths')
      expect(result.analysis).toHaveProperty('weaknesses')
      expect(result.analysis).toHaveProperty('recommendations')
    })

    it('应该执行敏感性分析', async () => {
      const mockOfficeAction = {
        oa_type: 'InventiveStep',
        citations: [],
        affected_claims: [1, 2],
        examiner_arguments: '缺乏创造性',
      }

      const mockStrategy = {
        strategy_type: 'Hybrid' as const,
        reasoning: '混合策略',
        confidence: 0.7,
      }

      const sensitivities = await predictor.sensitivityAnalysis(
        mockOfficeAction as any,
        mockStrategy,
        70
      )

      expect(sensitivities).toBeInstanceOf(Array)
      expect(sensitivities.length).toBeGreaterThan(0)
      expect(sensitivities[0]).toHaveProperty('factor')
      expect(sensitivities[0]).toHaveProperty('impact')
    })
  })

  describe('HebbianOptimizer - 赫布学习优化器', () => {
    let optimizer: HebbianOptimizer

    beforeEach(() => {
      optimizer = new HebbianOptimizer(mockLLM as any, {
        learningRate: 0.1,
        forgettingFactor: 0.05,
        enableContinuousLearning: true,
      })
    })

    it('应该成功初始化赫布学习优化器', () => {
      expect(optimizer).toBeDefined()
      expect(optimizer.getNetworkState()).toBeDefined()
      expect(optimizer.getNetworkState().strategyNeurons).toBe(4) // 4种策略
    })

    it('应该学习并推荐策略', async () => {
      const mockOfficeAction = {
        oa_type: 'Novelty',
        citations: [],
        affected_claims: [1],
        examiner_arguments: '缺乏新颖性',
      }

      const currentClaims = ['1. 一种技术方案，包括特征A、B、C']
      const description = '本发明涉及一种技术方案...'

      const result = await optimizer.learnAndRecommend(
        mockOfficeAction as any,
        currentClaims,
        description
      )

      expect(result).toBeDefined()
      expect(result.recommendedStrategy).toHaveProperty('strategy_type')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
      expect(result.alternatives).toBeInstanceOf(Array)
      expect(result.learningStats).toHaveProperty('totalCases')
    })

    it('应该从反馈中学习', async () => {
      const caseId = 'test-case-001'

      // 先保存一个案例
      const mockOfficeAction = {
        oa_type: 'InventiveStep',
        citations: [],
        affected_claims: [1],
        examiner_arguments: '缺乏创造性',
      }

      const mockStrategy = {
        strategy_type: 'Hybrid' as const,
        reasoning: '混合策略',
        confidence: 0.7,
      }

      const features = ['InventiveStep-medium', 'few-claims-affected']
      optimizer.saveCaseForLearning(caseId, mockOfficeAction as any, mockStrategy, features)

      // 从反馈中学习
      await optimizer.learnFromFeedback(caseId, 'success')

      const stats = optimizer.getLearningStats()
      expect(stats.totalLearningEvents).toBe(1)
      expect(stats.successfulPredictions).toBe(1)
    })

    it('应该提供学习统计信息', () => {
      const stats = optimizer.getLearningStats()
      const networkState = optimizer.getNetworkState()

      expect(stats).toHaveProperty('totalCases')
      expect(stats).toHaveProperty('totalLearningEvents')
      expect(networkState).toHaveProperty('strategyNeurons')
      expect(networkState).toHaveProperty('featureNeurons')
      expect(networkState).toHaveProperty('totalSynapses')
    })
  })

  describe('EnhancedPatentResponderAgent - 增强版答复智能体', () => {
    let agent: EnhancedPatentResponderAgent

    beforeEach(() => {
      agent = new EnhancedPatentResponderAgent({
        llm: mockLLM as any,
        enhancedConfig: {
          enableExaminerSimulation: true,
          enableSuccessPrediction: true,
          enableHebbianLearning: true,
          enableHumanInLoop: false, // 测试时关闭人机交互
          conservatism: 0.5,
          maxIterations: 2,
        },
      })
    })

    it('应该成功初始化增强版答复智能体', () => {
      expect(agent).toBeDefined()
    })

    it('应该返回统计信息', () => {
      const stats = agent.getStats()

      expect(stats).toHaveProperty('hebbianLearning')
      expect(stats).toHaveProperty('networkState')
    })
  })

  describe('InteractiveWorkflow - 交互式工作流', () => {
    let agent: EnhancedPatentResponderAgent
    let workflow: InteractiveWorkflow

    beforeEach(() => {
      agent = new EnhancedPatentResponderAgent({
        llm: mockLLM as any,
        enhancedConfig: {
          enableHumanInLoop: false, // 测试时关闭人机交互
        },
      })

      workflow = new InteractiveWorkflow(agent, {
        enableStepConfirmation: false, // 测试时关闭确认
        enableLivePreview: true,
        maxFeedbackRounds: 2,
      })
    })

    it('应该成功初始化交互式工作流', () => {
      expect(workflow).toBeDefined()
      expect(workflow.getState()).toHaveProperty('currentStep')
      expect(workflow.getState().currentStep).toBe('input')
    })

    it('应该返回工作流状态', () => {
      const state = workflow.getState()

      expect(state).toHaveProperty('currentStep')
      expect(state).toHaveProperty('completedSteps')
      expect(state).toHaveProperty('timestamp')
    })

    it('应该计算进度百分比', () => {
      const progress = workflow.getProgress()

      expect(progress).toBeGreaterThanOrEqual(0)
      expect(progress).toBeLessThanOrEqual(100)
    })

    it('应该重置工作流', () => {
      workflow.reset()

      const state = workflow.getState()
      expect(state.currentStep).toBe('input')
      expect(state.completedSteps).toHaveLength(0)
    })
  })

  describe('集成测试 - 完整工作流', () => {
    it('应该执行完整的审查答复工作流', async () => {
      // 创建智能体
      const agent = new EnhancedPatentResponderAgent({
        llm: mockLLM as any,
        enhancedConfig: {
          enableHumanInLoop: false,
          maxIterations: 1,
        },
      })

      // 创建工作流
      const workflow = new InteractiveWorkflow(agent, {
        enableStepConfirmation: false,
      })

      // 模拟输入
      const mockInput = {
        applicationNumber: 'CN202310123456.7',
        patentTitle: '一种基于AI的图像识别方法',
        officeAction: '审查意见通知书内容...',
        priorArt: ['D1: CN109876543A'],
        claims: ['1. 一种图像识别方法...'],
        description: '本发明公开了一种图像识别方法...',
      }

      // 执行工作流
      const result = await workflow.start(mockInput as any)

      // 验证结果
      expect(result).toBeDefined()
      expect(result.response).toHaveProperty('writtenArgument')
      expect(result.response).toHaveProperty('amendedClaims')
      expect(result.metrics).toHaveProperty('allowanceProbability')
      expect(result.finalRecommendations).toBeInstanceOf(Array)

      // 验证工作流状态
      const state = workflow.getState()
      expect(state.currentStep).toBe('completed')
      expect(state.completedSteps.length).toBeGreaterThan(0)
    })
  })

  describe('边界条件和错误处理', () => {
    it('应该处理空的审查意见', async () => {
      const simulator = new ExaminerSimulator(mockLLM as any)

      const mockOfficeAction = {
        oa_type: '',
        citations: [],
        affected_claims: [],
        examiner_arguments: '',
      }

      const mockResponse = {
        writtenArgument: '',
        amendedClaims: [],
        amendmentComparison: '',
        responseStrategy: 'amendment' as const,
      }

      // 应该不会抛出错误，而是返回一个合理的结果
      const result = await simulator.simulateReview(mockOfficeAction as any, mockResponse)

      expect(result).toBeDefined()
      expect(result.acceptProbability).toBeGreaterThanOrEqual(0)
    })

    it('应该处理极端的质量分数', async () => {
      const predictor = new SuccessPredictor(mockLLM as any)

      const mockOfficeAction = {
        oa_type: 'Novelty',
        citations: [],
        affected_claims: [1],
        examiner_arguments: '缺乏新颖性',
      }

      const mockStrategy = {
        strategy_type: 'AmendClaims' as const,
        reasoning: '修改权利要求',
        confidence: 0.5,
      }

      // 测试极端质量分数
      const resultLow = await predictor.predict(
        mockOfficeAction as any,
        mockStrategy,
        0
      )
      const resultHigh = await predictor.predict(
        mockOfficeAction as any,
        mockStrategy,
        100
      )

      expect(resultLow.successProbability).toBeGreaterThanOrEqual(0)
      expect(resultHigh.successProbability).toBeLessThanOrEqual(100)
    })

    it('应该处理无效的案例ID', async () => {
      const optimizer = new HebbianOptimizer(mockLLM as any)

      // 尝试从不存在的案例学习
      await expect(
        optimizer.learnFromFeedback('invalid-case-id', 'success')
      ).resolves.toBeUndefined() // 应该优雅地处理错误
    })
  })

  describe('性能测试', () => {
    it('应该在合理时间内完成审查员模拟', async () => {
      const simulator = new ExaminerSimulator(mockLLM as any)

      const mockOfficeAction = {
        oa_type: 'Novelty',
        citations: Array(10).fill({ document_number: 'D1', relevancy: 'high', claims_affected: [1] }),
        affected_claims: [1, 2, 3, 4, 5],
        examiner_arguments: '对比文件公开了所有特征',
      }

      const mockResponse = {
        writtenArgument: '意见陈述书',
        amendedClaims: ['1. 权利要求'],
        amendmentComparison: '对照',
        responseStrategy: 'amendment' as const,
      }

      const startTime = Date.now()
      await simulator.simulateReview(mockOfficeAction as any, mockResponse)
      const duration = Date.now() - startTime

      // 应该在5秒内完成
      expect(duration).toBeLessThan(5000)
    })

    it('应该高效处理批量模拟', async () => {
      const simulator = new ExaminerSimulator(mockLLM as any)

      const mockOfficeAction = {
        oa_type: 'InventiveStep',
        citations: [],
        affected_claims: [1],
        examiner_arguments: '缺乏创造性',
      }

      const mockResponses = Array(5).fill({
        writtenArgument: '意见陈述书',
        amendedClaims: ['1. 权利要求'],
        amendmentComparison: '对照',
        responseStrategy: 'amendment' as const,
      })

      const startTime = Date.now()
      await simulator.simulateMultipleResponses(mockOfficeAction as any, mockResponses)
      const duration = Date.now() - startTime

      // 批量处理应该比单独处理更高效
      expect(duration).toBeLessThan(10000)
    })
  })
})

/**
 * 运行测试的说明：
 *
 * 1. 安装依赖：
 *    npm install --save-dev jest @types/jest ts-jest
 *
 * 2. 配置 Jest（在 package.json 中）：
 *    {
 *      "scripts": {
 *        "test": "jest"
 *      },
 *      "jest": {
 *        "preset": "ts-jest",
 *        "testEnvironment": "node",
 *        "testMatch": ["**/test/**/*.test.ts"]
 *      }
 *    }
 *
 * 3. 运行测试：
 *    npm test
 *
 * 4. 查看覆盖率：
 *    npm test -- --coverage
 */
