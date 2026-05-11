/**
 * E2E 工作流测试共享工具
 *
 * 复用 core 包中的 mock 基础设施，为 E2E 测试提供统一的工作流设置
 */

import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import type { LLMAdapter, ChatResponse, ChatChunk, ChatParams } from '@yunpat/core'
import { vi } from 'vitest'

// 从 core 测试工具中导入 mock 工厂
import {
  createMockLLMAdapter,
  createMockLLMWithResponses,
  createMockLLMWithError,
} from '../../../packages/core/test/helpers/mock-llm.js'

// 重新导出 core 的 mock 工具，便于测试文件直接使用
export { createMockLLMAdapter, createMockLLMWithResponses, createMockLLMWithError }

/**
 * 工作流测试基础设施
 */
export interface WorkflowInfrastructure {
  eventBus: EventBus
  memory: ShortTermMemory
  tools: ToolRegistry
  llm: LLMAdapter
}

/**
 * 工作流选项
 */
export interface WorkflowOptions {
  /** 自定义 LLM 响应序列 */
  responses?: ChatResponse[]
  /** 是否注入错误 */
  injectError?: Error
  /** 自定义 LLM 适配器覆盖 */
  llmOverrides?: Partial<LLMAdapter>
  /** 最大迭代次数 */
  maxIterations?: number
}

/**
 * 创建完整的 E2E 工作流基础设施
 *
 * 包含 EventBus、ShortTermMemory、ToolRegistry 和 Mock LLM
 */
export function createWorkflowInfrastructure(options?: WorkflowOptions): WorkflowInfrastructure {
  const eventBus = new EventBus()
  const memory = new ShortTermMemory()
  const tools = new ToolRegistry(eventBus)

  let llm: LLMAdapter

  if (options?.injectError) {
    llm = createMockLLMWithError(options.injectError)
  } else if (options?.responses && options.responses.length > 0) {
    llm = createMockLLMWithResponses(options.responses)
  } else if (options?.llmOverrides) {
    llm = createMockLLMAdapter(options.llmOverrides)
  } else {
    llm = createMockLLMAdapter()
  }

  return { eventBus, memory, tools, llm }
}

/**
 * 为 E2E 测试创建 Agent 配置
 *
 * 自动禁用知识图谱等需要外部服务的功能
 */
export function createTestAgentConfig(
  infra: WorkflowInfrastructure,
  overrides: { name: string; description: string }
) {
  return {
    ...overrides,
    llm: infra.llm,
    eventBus: infra.eventBus,
    memory: infra.memory,
    tools: infra.tools,
    enableKnowledgeGraph: false,
  }
}

/**
 * 收集事件总线上的事件
 *
 * 返回一个数组和停止收集的函数
 */
export function collectEvents(
  eventBus: EventBus,
  pattern: string = '*'
): { events: Array<{ type: string; data: unknown }>; stop: () => void } {
  const events: Array<{ type: string; data: unknown }> = []
  const subscription = eventBus.subscribe(pattern, (event) => {
    events.push({ type: event.type, data: event.data })
  })
  return {
    events,
    stop: () => subscription.unsubscribe(),
  }
}

// ========== Mock LLM 响应预设 ==========

/**
 * 发明理解阶段的 mock 响应
 */
export function mockInventionResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        inventionConcepts: [
          {
            technicalProblem: '现有设备在高温环境下散热效率低',
            keyFeatures: [
              '采用相变材料作为散热介质',
              '配置多层复合散热结构',
              '集成智能温控调节模块',
            ],
            technicalEffects: ['散热效率提高60%', '工作温度范围扩大至-40°C至120°C', '能耗降低30%'],
            confidence: 0.9,
          },
        ],
        technicalField: '电子设备散热技术',
        embodimentSummary:
          '本发明涉及一种基于相变材料的高效散热装置，包括散热基板、相变材料层和温控模块。',
        drawingDescriptions: ['图1: 散热装置整体结构示意图', '图2: 相变材料层剖面图'],
      }),
    },
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
  }
}

/**
 * 现有技术检索阶段的 mock 响应
 */
export function mockPriorArtSearchResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        searchStrategy: ['关键词: 相变材料 散热 电子设备', 'IPC分类: H01L23/367, H05K7/20'],
        analysis: {
          technologyField: '电子设备散热',
          noveltyAssessment: {
            score: 0.85,
            distinguishingFeatures: ['相变材料与智能温控结合', '多层复合结构'],
            closestPriorArt: [],
          },
        },
        comparisonAnalysis: {
          closestPriorArt: {
            title: '一种电子设备散热器',
            similarityScore: 0.65,
          },
          differences: ['本发明采用相变材料', '本发明具有智能温控'],
          technicalProblemSolved: '提高散热效率并降低能耗',
        },
      }),
    },
    usage: { promptTokens: 80, completionTokens: 150, totalTokens: 230 },
  }
}

/**
 * 说明书撰写阶段的 mock 响应
 */
export function mockSpecificationResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        specification: {
          technical_field: {
            chapter: 'technical_field',
            title: '技术领域',
            content: '本发明涉及电子设备散热技术领域，尤其涉及一种基于相变材料的高效散热装置。',
            wordCount: 30,
          },
          background_art: {
            chapter: 'background_art',
            title: '背景技术',
            content:
              '随着电子设备性能不断提升，散热问题日益突出。传统风冷散热在高温环境下效率不足，液冷散热则存在体积大、成本高的问题。',
            wordCount: 60,
          },
          invention_content: {
            chapter: 'invention_content',
            title: '发明内容',
            content: '本发明要解决的技术问题是提供一种散热效率高、适用温度范围广的散热装置。',
            technical_problem: '现有散热装置在高温环境下散热效率低',
            technical_solution:
              '采用相变材料作为散热介质，配置多层复合散热结构，集成智能温控调节模块',
            beneficial_effects: '散热效率提高60%，工作温度范围扩大，能耗降低30%',
            beneficial_effects_list: [
              { effect: '散热效率提高60%', metric: '散热效率', improvement: '60%' },
              { effect: '工作温度范围扩大至-40°C至120°C', metric: '温度范围', improvement: '3倍' },
              { effect: '能耗降低30%', metric: '能耗', improvement: '30%' },
            ],
            wordCount: 100,
          },
          detailed_description: {
            chapter: 'embodiments',
            title: '具体实施方式',
            content:
              '下面结合附图和具体实施方式对本发明作进一步详细说明。实施例1：一种基于相变材料的高效散热装置，包括散热基板、相变材料层和智能温控模块。',
            wordCount: 150,
          },
        },
        metrics: { totalWordCount: 340, chapterCount: 4 },
      }),
    },
    usage: { promptTokens: 200, completionTokens: 400, totalTokens: 600 },
  }
}

/**
 * 权利要求撰写阶段的 mock 响应
 *
 * ClaimGeneratorAgent 的 normalizeOutput 在 JSON 根层查找
 * independent_claims / dependent_claims，而非嵌套在 claimsSet 内。
 */
export function mockClaimsResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        independent_claims: [
          {
            claim_number: 1,
            claim_type: 'device',
            preamble: '一种基于相变材料的高效散热装置',
            transition: '其特征在于，包括：',
            body: '散热基板；相变材料层，设置在所述散热基板上；智能温控模块，与所述相变材料层热耦合连接。',
            full_text:
              '1. 一种基于相变材料的高效散热装置，其特征在于，包括：散热基板；相变材料层，设置在所述散热基板上；智能温控模块，与所述相变材料层热耦合连接。',
            essential_features: ['散热基板', '相变材料层', '智能温控模块'],
          },
        ],
        dependent_claims: [
          {
            claim_number: 2,
            parent_claim: 1,
            content: '2. 根据权利要求1所述的散热装置，其特征在于，所述相变材料层为多层复合结构。',
            additional_features: ['多层复合结构'],
            limitation_type: 'further_limitation' as const,
          },
        ],
        layout_strategy: '先独后从，覆盖核心创新点',
        protection_scope_analysis: '独立权利要求覆盖核心散热结构，从属权利要求保护优选实施方式',
        quality_check: {
          clarity: '权利要求表述清晰',
          support: '权利要求得到说明书支持',
          essential_features: '必要技术特征完整',
          potential_issues: [],
        },
        confidence: 0.85,
      }),
    },
    usage: { promptTokens: 150, completionTokens: 250, totalTokens: 400 },
  }
}

/**
 * 摘要撰写阶段的 mock 响应
 *
 * 注意：AbstractDrafterAgent 的 normalizeOutput 在 JSON 根层查找 content/wordCount/confidence，
 * 而非嵌套在 abstract 对象内。mock 响应需匹配此格式。
 */
export function mockAbstractResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        content:
          '本发明公开了一种基于相变材料的高效散热装置，包括散热基板、相变材料层和智能温控模块。通过采用相变材料作为散热介质，配合多层复合散热结构和智能温控调节，实现散热效率提高60%、工作温度范围扩大至-40°C至120°C、能耗降低30%的技术效果。',
        wordCount: 120,
        keyElements: {
          technicalField: true,
          technicalSolution: true,
          beneficialEffects: true,
          application: false,
        },
        confidence: 0.9,
      }),
    },
    usage: { promptTokens: 100, completionTokens: 150, totalTokens: 250 },
  }
}

/**
 * 质量检查阶段的 mock 响应
 */
export function mockQualityCheckResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        overallScore: 82,
        claimsCheck: {
          score: 80,
          protectionScope: { status: 'pass', issues: [] },
          clarity: { status: 'pass', issues: [] },
          support: { status: 'pass', issues: [] },
        },
        specificationCheck: {
          score: 85,
          disclosure: { status: 'pass', issues: [] },
          termConsistency: {
            status: 'warning',
            inconsistentTerms: [],
          },
          completeness: { status: 'pass', issues: [] },
        },
        formalCheck: {
          score: 80,
          errors: [],
        },
        improvementSuggestions: [
          {
            category: '权利要求',
            priority: 'medium' as const,
            description: '建议增加方法权利要求以扩大保护范围',
            location: '权利要求书',
          },
        ],
      }),
    },
    usage: { promptTokens: 150, completionTokens: 200, totalTokens: 350 },
  }
}

/**
 * 专利技术分析阶段的 mock 响应
 */
export function mockTechnicalAnalysisResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        technicalProblems: {
          main: '散热效率不足',
          sub: ['高温环境下性能下降', '散热装置体积过大'],
          severity: 'high',
        },
        technicalSolution: {
          core: '采用相变材料与智能温控结合的散热方案',
          keyFeatures: [
            { feature: '相变材料层', necessity: 'essential', confidence: 0.95 },
            { feature: '智能温控模块', necessity: 'important', confidence: 0.85 },
          ],
          implementation: '多层复合散热结构集成相变材料',
          technicalEffects: [
            {
              effect: '散热效率提高60%',
              metric: '散热效率',
              improvement: '60%',
              confidence: 0.9,
            },
          ],
        },
      }),
    },
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
  }
}

/**
 * 对比分析报告阶段的 mock 响应
 */
export function mockComparisonReportResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        closestPriorArt: {
          publicationNumber: 'CN1234567A',
          title: '一种电子设备散热器',
          similarity: 0.65,
          reason: '均涉及电子设备散热，但技术方案差异较大',
        },
        distinctFeatures: [
          {
            feature: '相变材料散热介质',
            novelty: 'high',
            evidence: ['对比文件使用传统金属散热片'],
          },
          {
            feature: '智能温控调节模块',
            novelty: 'medium',
            evidence: ['对比文件未提及温控功能'],
          },
        ],
        technicalProblem: {
          original: '散热效率低',
          refined: '高温环境下传统散热方式效率不足',
          refinementReason: '更精确地描述技术挑战',
        },
        inventiveness: {
          score: 0.85,
          keyFactors: ['相变材料的创新应用', '智能温控的集成'],
        },
      }),
    },
    usage: { promptTokens: 120, completionTokens: 250, totalTokens: 370 },
  }
}

/**
 * OA 解析阶段的 mock 响应
 */
export function mockOAParseResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        applicationNumber: 'CN202310000001.0',
        patentTitle: '一种基于相变材料的高效散热装置',
        examiner: '张三',
        rejectionReasons: [
          {
            type: 'inventiveness',
            description: '权利要求1相对于D1（CN1234567A）结合D2（CN2345678A）不具备创造性',
            severity: 'high',
            affectedClaims: [1, 2],
            overcomeProbability: 70,
            suggestedResponse: 'both',
          },
        ],
        citedReferences: [
          {
            publicationNumber: 'CN1234567A',
            title: '一种电子设备散热器',
            relevance: '最接近现有技术',
            referenceType: 'D1',
          },
        ],
        summary: '审查员引用两篇对比文件，认为权利要求1-2不具备创造性',
        confidence: 0.85,
      }),
    },
    usage: { promptTokens: 200, completionTokens: 300, totalTokens: 500 },
  }
}

/**
 * OA 答复策略推荐阶段的 mock 响应
 */
export function mockStrategyResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        strategy: 'both',
        successProbability: 75,
        rationale:
          '建议同时修改权利要求并争辩创造性。通过将相变材料层进一步限定为多层复合结构，可以与D1形成区别。',
        keyArguments: [
          'D1未公开相变材料作为散热介质的技术特征',
          'D2的技术领域不同，不构成技术启示',
          '本发明取得了意想不到的技术效果',
        ],
        suggestedAmendments: [
          {
            claimNumber: 1,
            currentText: '相变材料层，设置在所述散热基板上',
            proposedText:
              '多层复合相变材料层，包括第一相变材料和第二相变材料，依次层叠设置在所述散热基板上',
            reason: '进一步限定相变材料层结构，增加与D1的区别特征',
            amendmentType: 'modify',
          },
        ],
        additionalEvidence: ['实验数据对比报告', '相变材料性能测试结果'],
        risks: ['修改后的权利要求保护范围缩小', '审查员可能认为修改超范围'],
      }),
    },
    usage: { promptTokens: 150, completionTokens: 250, totalTokens: 400 },
  }
}

/**
 * OA 答复文档生成阶段的 mock 响应
 */
export function mockResponseDocumentResponse(): ChatResponse {
  return {
    message: {
      role: 'assistant',
      content: JSON.stringify({
        responseLetter:
          '关于申请号CN202310000001.0的审查意见答复书\n\n尊敬的审查员：\n\n申请人仔细研究了审查意见，现答复如下：\n\n一、关于创造性\n申请人认为，权利要求1相对于D1结合D2具备创造性...\n\n二、修改说明\n根据审查意见，申请人对权利要求书进行了修改...',
        amendedClaims:
          '1. 一种基于相变材料的高效散热装置，其特征在于，包括：散热基板；多层复合相变材料层，包括第一相变材料和第二相变材料，依次层叠设置在所述散热基板上；智能温控模块，与所述相变材料层热耦合连接。',
        metrics: {
          wordCount: 2000,
          argumentCount: 3,
          amendmentCount: 1,
          generationTime: 5000,
        },
      }),
    },
    usage: { promptTokens: 300, completionTokens: 500, totalTokens: 800 },
  }
}

/**
 * 创建完整撰写工作流的 mock LLM（按阶段依次返回对应响应）
 */
export function createDraftWorkflowLLM(): LLMAdapter {
  return createMockLLMWithResponses([
    mockInventionResponse(),
    mockPriorArtSearchResponse(),
    mockSpecificationResponse(),
    mockClaimsResponse(),
    mockAbstractResponse(),
    mockQualityCheckResponse(),
  ])
}

/**
 * 创建分析工作流的 mock LLM
 */
export function createAnalyzeWorkflowLLM(): LLMAdapter {
  return createMockLLMWithResponses([
    mockInventionResponse(),
    mockTechnicalAnalysisResponse(),
    mockComparisonReportResponse(),
  ])
}

/**
 * 创建 OA 答复工作流的 mock LLM
 */
export function createRespondWorkflowLLM(): LLMAdapter {
  return createMockLLMWithResponses([
    mockOAParseResponse(),
    mockStrategyResponse(),
    mockResponseDocumentResponse(),
  ])
}
