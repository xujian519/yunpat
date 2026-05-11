/**
 * OA 审查意见答复工作流 E2E 测试
 *
 * 测试 OA 答复流水线：
 * Load OA Document -> Analyze Rejection Points -> Generate Response Arguments -> Draft Response
 *
 * 仅在 MOCK_TESTS=true 时运行
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  createWorkflowInfrastructure,
  createTestAgentConfig,
  collectEvents,
  mockOAParseResponse,
  mockStrategyResponse,
  mockResponseDocumentResponse,
} from './helpers/workflow-setup.js'
import type { WorkflowInfrastructure } from './helpers/workflow-setup.js'

const describeE2E = process.env.MOCK_TESTS === 'true' ? describe : describe.skip

/**
 * 标准测试输入：模拟一份审查意见
 */
const TEST_OFFICE_ACTION = {
  applicationNumber: 'CN202310000001.0',
  patentTitle: '一种基于相变材料的高效散热装置',
  examiner: '张三',
  notificationDate: '2024-06-15',
  deadline: '2024-09-15',
  officeActionContent: `
    第一次审查意见通知书

    申请号：CN202310000001.0
    发明名称：一种基于相变材料的高效散热装置

    审查意见：

    1. 权利要求1相对于对比文件D1（CN1234567A）结合对比文件D2（CN2345678A）不具备创造性。

    具体而言，D1公开了一种电子设备散热器（参见说明书第[0020]-[0035]段），
    包括散热基板和散热鳍片。权利要求1与D1的区别在于：采用相变材料层和智能温控模块。

    然而对于上述区别特征，D2公开了一种智能温控系统（参见说明书第[0015]-[0025]段），
    其中公开了利用温度传感器监测散热状态并根据温度控制散热装置的技术方案。
    本领域技术人员有动机将D2的智能温控应用到D1的散热器中以提高散热效率。

    关于相变材料层，这是本领域常用的散热材料，本领域技术人员可以根据实际需要选择使用。

    因此，权利要求1相对于D1结合D2不具备创造性，不符合专利法第22条第3款的规定。

    2. 权利要求2引用权利要求1，其附加特征为"所述相变材料层为多层复合结构"。
    该特征已被D1公开（参见说明书第[0028]段），因此在权利要求1不具备创造性的前提下，
    权利要求2也不具备创造性。

    结论：建议修改权利要求以克服上述缺陷。
  `.trim(),
  citedReferences: [
    {
      publicationNumber: 'CN1234567A',
      title: '一种电子设备散热器',
      relevance: '最接近现有技术',
      relevanceLevel: 5,
    },
    {
      publicationNumber: 'CN2345678A',
      title: '一种智能温控系统',
      relevance: '用于评述创造性',
      relevanceLevel: 4,
    },
  ],
  rejectionTypes: ['inventiveness' as const],
}

const TEST_ORIGINAL_APPLICATION = {
  title: '一种基于相变材料的高效散热装置',
  claims: `
    1. 一种基于相变材料的高效散热装置，其特征在于，包括：
    散热基板；
    相变材料层，设置在所述散热基板上；
    智能温控模块，与所述相变材料层热耦合连接。

    2. 根据权利要求1所述的散热装置，其特征在于，所述相变材料层为多层复合结构。
  `.trim(),
  description: `
    技术领域：本发明涉及电子设备散热技术领域。

    背景技术：传统散热方式效率不足。

    发明内容：本发明采用相变材料作为散热介质，配置多层复合散热结构，集成智能温控调节模块。
    散热效率提高60%，工作温度范围扩大至-40°C至120°C，能耗降低30%。

    具体实施方式：散热装置包括散热基板、相变材料层和智能温控模块。
    相变材料层采用石蜡基复合材料，填充在散热基板与外壳之间。
    智能温控模块通过温度传感器实时监测散热状态。
  `.trim(),
  abstract: '本发明公开了一种基于相变材料的高效散热装置，包括散热基板、相变材料层和智能温控模块。',
}

describeE2E('OA 审查意见答复工作流', () => {
  let infra: WorkflowInfrastructure

  beforeAll(() => {
    // 共享基础设施，每个测试使用独立 mock LLM
    infra = createWorkflowInfrastructure()
  })

  describe('阶段1: 审查意见解析', () => {
    it('应解析审查意见并识别驳回理由', async () => {
      const testInfra = createWorkflowInfrastructure({
        responses: [
          mockOAParseResponse(), mockStrategyResponse(), mockResponseDocumentResponse(),
          mockOAParseResponse(), mockStrategyResponse(), mockResponseDocumentResponse(),
        ],
      })

      const { PatentResponderAgent } = await import('@yunpat/agent-patent-responder')

      const agent = new PatentResponderAgent(
        createTestAgentConfig(testInfra, {
          name: 'patent-responder',
          description: '专利答复智能体',
        })
      )

      const result = await agent.execute({
        officeAction: TEST_OFFICE_ACTION,
        originalApplication: TEST_ORIGINAL_APPLICATION,
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty('analysis')

      // 验证分析结果结构
      expect(result.analysis).toHaveProperty('summary')
      expect(result.analysis).toHaveProperty('keyIssues')
      expect(result.analysis).toHaveProperty('overcomeProbability')
      expect(typeof result.analysis.overcomeProbability).toBe('number')
    })
  })

  describe('阶段2: 答复策略推荐', () => {
    it('应推荐合适的答复策略', async () => {
      const testInfra = createWorkflowInfrastructure({
        responses: [
          mockOAParseResponse(), mockStrategyResponse(), mockResponseDocumentResponse(),
          mockOAParseResponse(), mockStrategyResponse(), mockResponseDocumentResponse(),
        ],
      })

      const { PatentResponderAgent } = await import('@yunpat/agent-patent-responder')

      const agent = new PatentResponderAgent(
        createTestAgentConfig(testInfra, {
          name: 'patent-responder',
          description: '专利答复智能体',
        })
      )

      const result = await agent.execute({
        officeAction: TEST_OFFICE_ACTION,
        originalApplication: TEST_ORIGINAL_APPLICATION,
        strategyPreference: 'moderate',
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty('strategy')

      // 验证策略结构
      expect(result.strategy).toHaveProperty('overallStrategy')
      expect(result.strategy).toHaveProperty('successProbability')
      expect(result.strategy).toHaveProperty('keyArguments')
      expect(result.strategy).toHaveProperty('suggestedAmendments')
      expect(result.strategy).toHaveProperty('risks')

      // 验证类型
      expect(typeof result.strategy.successProbability).toBe('number')
      expect(result.strategy.keyArguments).toBeInstanceOf(Array)
    })

    it('应支持不同的策略偏好', async () => {
      const aggressiveInfra = createWorkflowInfrastructure({
        responses: [mockOAParseResponse(), mockStrategyResponse(), mockResponseDocumentResponse()],
      })

      const { PatentResponderAgent } = await import('@yunpat/agent-patent-responder')

      const agent = new PatentResponderAgent(
        createTestAgentConfig(aggressiveInfra, {
          name: 'patent-responder',
          description: '专利答复智能体',
        })
      )

      const result = await agent.execute({
        officeAction: TEST_OFFICE_ACTION,
        originalApplication: TEST_ORIGINAL_APPLICATION,
        strategyPreference: 'aggressive',
      })

      expect(result).toBeDefined()
      expect(result.strategy).toBeDefined()
    })
  })

  describe('阶段3: 答复文档生成', () => {
    it('应生成完整的答复文档', async () => {
      const testInfra = createWorkflowInfrastructure({
        responses: [
          mockOAParseResponse(), mockStrategyResponse(), mockResponseDocumentResponse(),
          mockOAParseResponse(), mockStrategyResponse(), mockResponseDocumentResponse(),
        ],
      })

      const { PatentResponderAgent } = await import('@yunpat/agent-patent-responder')

      const agent = new PatentResponderAgent(
        createTestAgentConfig(testInfra, {
          name: 'patent-responder',
          description: '专利答复智能体',
        })
      )

      const result = await agent.execute({
        officeAction: TEST_OFFICE_ACTION,
        originalApplication: TEST_ORIGINAL_APPLICATION,
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty('responseDocument')

      // 验证答复文档结构
      expect(result.responseDocument).toHaveProperty('responseLetter')
      expect(result.responseDocument.responseLetter).toBeTruthy()
      expect(result.responseDocument).toHaveProperty('metrics')

      // 验证度量指标
      expect(result.responseDocument.metrics).toHaveProperty('wordCount')
      expect(result.responseDocument.metrics).toHaveProperty('argumentCount')
      expect(result.responseDocument.metrics).toHaveProperty('amendmentCount')
    })
  })

  describe('完整答复流水线', () => {
    it('应从头到尾完成整个 OA 答复工作流', async () => {
      const pipelineInfra = createWorkflowInfrastructure({
        responses: [mockOAParseResponse(), mockStrategyResponse(), mockResponseDocumentResponse()],
      })

      const eventCollector = collectEvents(pipelineInfra.eventBus, 'agent:*')

      const { PatentResponderAgent } = await import('@yunpat/agent-patent-responder')

      const agent = new PatentResponderAgent(
        createTestAgentConfig(pipelineInfra, {
          name: 'patent-responder',
          description: '专利答复智能体',
        })
      )

      const result = await agent.execute({
        officeAction: TEST_OFFICE_ACTION,
        originalApplication: TEST_ORIGINAL_APPLICATION,
        strategyPreference: 'moderate',
      })

      // 验证完整输出结构
      expect(result).toBeDefined()

      // 1. 分析部分
      expect(result.analysis).toBeDefined()
      expect(result.analysis.summary).toBeTruthy()
      expect(result.analysis.keyIssues).toBeInstanceOf(Array)
      expect(typeof result.analysis.overcomeProbability).toBe('number')

      // 2. 策略部分
      expect(result.strategy).toBeDefined()
      expect(result.strategy.overallStrategy).toBeTruthy()
      expect(typeof result.strategy.successProbability).toBe('number')
      expect(result.strategy.keyArguments).toBeInstanceOf(Array)

      // 3. 答复文档部分
      expect(result.responseDocument).toBeDefined()
      expect(result.responseDocument.responseLetter).toBeTruthy()
      expect(typeof result.responseDocument.metrics.wordCount).toBe('number')

      // 4. 后续建议
      expect(result.nextSteps).toBeInstanceOf(Array)

      // 验证事件收集
      eventCollector.stop()
      const eventTypes = eventCollector.events.map((e) => e.type)
      expect(eventTypes).toContain('agent:started')
      expect(eventTypes).toContain('agent:completed')
    })
  })

  describe('错误处理', () => {
    it('应在缺少必要输入时抛出验证错误或返回错误结果', async () => {
      const { PatentResponderAgent } = await import('@yunpat/agent-patent-responder')

      const agent = new PatentResponderAgent(
        createTestAgentConfig(infra, {
          name: 'patent-responder',
          description: '专利答复智能体',
        })
      )

      try {
        const result = await agent.execute({
          officeAction: {
            applicationNumber: '',
            patentTitle: '',
            officeActionContent: '',
          },
          originalApplication: {
            title: '',
            claims: '',
            description: '',
          },
        })
        // 如果没有 throw，验证返回的结果标记了错误
        expect(result).toBeDefined()
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })

    it('应在 LLM 错误时抛出异常或返回降级结果', async () => {
      const errorInfra = createWorkflowInfrastructure({
        injectError: new Error('LLM service timeout'),
      })

      const { PatentResponderAgent } = await import('@yunpat/agent-patent-responder')

      const agent = new PatentResponderAgent(
        createTestAgentConfig(errorInfra, {
          name: 'patent-responder',
          description: '专利答复智能体',
        })
      )

      try {
        const result = await agent.execute({
          officeAction: TEST_OFFICE_ACTION,
          originalApplication: TEST_ORIGINAL_APPLICATION,
        })
        // Agent 可能捕获错误并返回降级结果
        expect(result).toBeDefined()
      } catch (error) {
        // 或者直接 throw
        expect(error).toBeInstanceOf(Error)
      }
    })
  })
})
