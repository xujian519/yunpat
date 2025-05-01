/**
 * @file 本地执行引擎
 * @description 无需 Gateway，直接使用 @yunpat/core 原语和智能体包执行工作流
 *
 * 核心设计：
 * 1. 动态 import() 智能体包，避免启动时加载全部
 * 2. runStep() 高阶函数消除每个步骤的 try-catch-emit 重复
 * 3. 向 Zustand store 发出与 Gateway SSE 格式一致的状态更新
 */

import {
  EventBus,
  ShortTermMemory,
  ToolRegistry,
  NativeLLMAdapter,
  NativeModel,
} from '@yunpat/core'
import type { Engine, EngineConfig } from './engine.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DynamicResult = any

import type { IntentType, OrchestratorStage, WorkflowState, WorkflowStep } from '../types/index.js'
import { storeApi } from '../store/index.js'

/** 智能体执行结果（宽松类型，用于 dynamic import 返回值） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentOutput = any

// ═══════════════════════════════════════════════════════
// LLM 创建
// ═══════════════════════════════════════════════════════

const PROVIDER_CONFIGS: Record<string, { baseURL: string; model: NativeModel }> = {
  deepseek: { baseURL: 'https://api.deepseek.com', model: NativeModel.DEEPSEEK_V4_PRO },
  aliyun: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: NativeModel.QWEN_MAX,
  },
  zhipu: { baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: NativeModel.GLM_4_7 },
  ollama: { baseURL: 'http://localhost:11434/v1', model: NativeModel.OLLAMA_LLAMA3 },
}

function createLLM(config: EngineConfig): NativeLLMAdapter {
  const apiKey =
    config.apiKey ||
    process.env.GLM_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.OPENAI_API_KEY
  if (!apiKey)
    throw new Error(
      '未找到 LLM API Key。请设置环境变量 GLM_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY'
    )

  const provider = config.provider || detectProvider()
  const pc = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.deepseek

  return new NativeLLMAdapter({
    name: pc.model,
    apiKey,
    baseURL: pc.baseURL,
    timeout: config.timeout || 120000,
  })
}

function detectProvider(): string {
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER
  if (process.env.GLM_API_KEY) return 'zhipu'
  if (process.env.OMLX_ENABLED === 'true') return 'ollama'
  return 'deepseek'
}

// ═══════════════════════════════════════════════════════
// Store 发射器（Emit helpers）
// ═══════════════════════════════════════════════════════

function emitIntent(intent: string): void {
  storeApi.getState().updateOrchestratorStatus({ intent, stage: 'intent' })
}

function emitProgress(progress: number, currentAgent?: string, stage?: OrchestratorStage): void {
  storeApi.getState().updateOrchestratorStatus({
    progress,
    ...(currentAgent && { currentAgent }),
    ...(stage && { stage }),
  })
}

function emitStepStart(stepId: string, stepName: string, index: number, total: number): void {
  storeApi
    .getState()
    .updateWorkflowStep(stepId, { stepId, name: stepName, status: 'running', progress: 0 })
  storeApi.getState().updateOrchestratorStatus({
    currentAgent: stepName,
    stage: 'execution',
    progress: (index + 1) / total,
  })
}

function emitStepComplete(
  stepId: string,
  status: 'completed' | 'failed',
  duration?: number,
  details?: string
): void {
  storeApi.getState().updateWorkflowStep(stepId, { status, duration, details })
  if (status === 'completed') storeApi.getState().advanceWorkflowStep()
}

function emitResult(result: string): void {
  storeApi.getState().addMessage({ role: 'assistant', content: result, timestamp: Date.now() })
  storeApi.getState().updateOrchestratorStatus({ stage: 'done', progress: 1 })
}

function emitError(error: string): void {
  storeApi.getState().setError(error)
  storeApi
    .getState()
    .addMessage({ role: 'system', content: `处理错误: ${error}`, timestamp: Date.now() })
  storeApi.getState().updateOrchestratorStatus({ stage: 'error' })
}

function emitHITL(request: {
  requestId: string
  sessionId: string
  checkpointId: string
  content: { type: 'confirmation'; message: string }
  options: Array<{ id: string; label: string; action: 'approve' | 'reject' | 'modify' | 'skip' }>
  timeout: number
}): void {
  storeApi.getState().setPendingHITL(request)
  storeApi.getState().updateOrchestratorStatus({ stage: 'hitl' })
}

// ═══════════════════════════════════════════════════════
// runStep: 消除重复的高阶函数
// ═══════════════════════════════════════════════════════

/**
 * 执行单个工作流步骤，自动处理 emit + 错误回退。
 *
 * @returns [成功结果, fallback结果] — 失败时返回 fallback
 */
async function runStep(
  step: { id: string; name: string },
  index: number,
  total: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executor: () => Promise<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fallback: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const start = Date.now()
  emitStepStart(step.id, step.name, index, total)
  try {
    const result = await executor()
    emitStepComplete(step.id, 'completed', Date.now() - start)
    return result
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    emitStepComplete(step.id, 'failed', Date.now() - start, msg)
    return fallback
  }
}

// ═══════════════════════════════════════════════════════
// 工作流定义
// ═══════════════════════════════════════════════════════

const WORKFLOW_STEPS: Record<string, Array<{ id: string; name: string }>> = {
  DRAFT_FULL: [
    { id: 'invention', name: '发明理解' },
    { id: 'prior-art', name: '现有技术检索' },
    { id: 'specification', name: '撰写说明书' },
    { id: 'claims', name: '撰写权利要求' },
    { id: 'abstract', name: '撰写摘要' },
    { id: 'quality', name: '质量检查' },
  ],
  DRAFT_CLAIMS: [
    { id: 'invention', name: '发明理解' },
    { id: 'claims', name: '撰写权利要求' },
  ],
  DRAFT_SPEC: [
    { id: 'invention', name: '发明理解' },
    { id: 'specification', name: '撰写说明书' },
  ],
  RESPOND_OA: [
    { id: 'oa-parse', name: 'OA 解析' },
    { id: 'oa-strategy', name: '策略分析' },
    { id: 'oa-draft', name: '答复撰写' },
  ],
  SEARCH: [
    { id: 'invention', name: '发明理解' },
    { id: 'search', name: '专利检索' },
  ],
  ANALYZE_PORTFOLIO: [
    { id: 'analysis', name: '技术分析' },
    { id: 'report', name: '报告生成' },
  ],
}

function initWorkflow(intent: IntentType): Array<{ id: string; name: string }> {
  const steps = WORKFLOW_STEPS[intent]
  if (!steps) return []

  const workflowSteps: WorkflowStep[] = steps.map((s) => ({
    stepId: s.id,
    name: s.name,
    status: 'pending' as const,
    progress: 0,
  }))
  storeApi.getState().setWorkflow({
    type: intent as WorkflowState['type'],
    totalSteps: steps.length,
    steps: workflowSteps,
    startTime: Date.now(),
    currentStepIndex: 0,
  })

  return steps
}

// ═══════════════════════════════════════════════════════
// 安全取值
// ═══════════════════════════════════════════════════════

function getStr(obj: AgentOutput | undefined, key: string): string | undefined {
  const v = obj?.[key]
  return typeof v === 'string' ? v : undefined
}
function getNested(obj: AgentOutput | undefined, key: string): AgentOutput | undefined {
  const v = obj?.[key]
  return typeof v === 'object' && v !== null ? (v as AgentOutput) : undefined
}
function getErrMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ═══════════════════════════════════════════════════════
// LocalEngine
// ═══════════════════════════════════════════════════════

export class LocalEngine implements Engine {
  readonly type = 'local' as const

  private config: EngineConfig = {}
  private llm: NativeLLMAdapter | null = null
  private eventBus: EventBus | null = null
  private memory: ShortTermMemory | null = null
  private tools: ToolRegistry | null = null
  private _initialized = false
  private _pendingHITLResolve: ((response: unknown) => void) | null = null

  async initialize(config: EngineConfig): Promise<void> {
    this.config = config
    this.llm = createLLM(config)
    this.eventBus = new EventBus()
    this.memory = new ShortTermMemory()
    this.tools = new ToolRegistry(this.eventBus)
    this._initialized = true

    storeApi.setState({
      submitHITLResponse: async (response) => {
        if (this._pendingHITLResolve) {
          this._pendingHITLResolve(response)
          this._pendingHITLResolve = null
        }
      },
    })
  }

  async executeWorkflow(intent: IntentType, params: Record<string, unknown>): Promise<void> {
    if (!this._initialized || !this.llm || !this.eventBus || !this.memory || !this.tools) {
      throw new Error('LocalEngine 未初始化，请先调用 initialize()')
    }

    emitIntent(intent)
    const steps = initWorkflow(intent)

    try {
      switch (intent) {
        case 'DRAFT_FULL':
          await this.fullPatentWorkflow(params, steps)
          break
        case 'DRAFT_CLAIMS':
          await this.claimsWorkflow(params, steps)
          break
        case 'DRAFT_SPEC':
          await this.specWorkflow(params, steps)
          break
        case 'SEARCH':
          await this.searchWorkflow(params, steps)
          break
        case 'ANALYZE_PORTFOLIO':
          await this.analyzeWorkflow(params, steps)
          break
        case 'RESPOND_OA':
          await this.oaWorkflow(params, steps)
          break
        default:
          emitError(`不支持的工作流类型: ${intent}`)
      }
    } catch (error) {
      emitError(getErrMsg(error))
    }
  }

  async submitHITLResponse(response: unknown): Promise<void> {
    if (this._pendingHITLResolve) {
      this._pendingHITLResolve(response)
      this._pendingHITLResolve = null
    }
  }

  disconnect?(): void {
    this._initialized = false
    this.llm = null
    this.eventBus = null
    this.memory = null
    this.tools = null
  }

  // ─── 智能体创建辅助 ──────────────────────────

  private agentBase(): {
    llm: NativeLLMAdapter
    memory: ShortTermMemory
    tools: ToolRegistry
    eventBus: EventBus
  } {
    return { llm: this.llm!, memory: this.memory!, tools: this.tools!, eventBus: this.eventBus! }
  }

  // ─── 完整专利撰写（6 步）────────────────────

  private async fullPatentWorkflow(
    params: Record<string, unknown>,
    steps: Array<{ id: string; name: string }>
  ): Promise<void> {
    const { title, field, disclosure } = extractDraftParams(params)
    const base = this.agentBase()

    const inventionResult = await runStep(
      steps[0],
      0,
      steps.length,
      async () => {
        const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
        return new InventionUnderstandingAgent({
          name: 'invention',
          description: '发明理解',
          ...base,
        }).execute({ title, field, technicalDisclosure: disclosure })
      },
      { title, field, technicalField: field, keyFeatures: [], technicalDisclosure: disclosure }
    )

    const searchResult = await runStep(
      steps[1],
      1,
      steps.length,
      async () => {
        const { PriorArtSearchAgent } = await import('@yunpat/agent-prior-art-search')
        return new PriorArtSearchAgent({
          name: 'prior-art',
          description: '现有技术检索',
          ...base,
        }).execute({
          inventionUnderstanding: inventionResult,
          claims: [],
          patentType: 'invention',
          inventionTitle: title,
        })
      },
      {
        comparisonAnalysis: undefined,
        relevantPatents: [],
        searchReport: {},
        analysis: {},
        overallReport: '',
      }
    )

    const specResult = await runStep(
      steps[2],
      2,
      steps.length,
      async () => {
        const { SpecificationDrafterAgent } = await import('@yunpat/agent-specification-drafter')
        return new SpecificationDrafterAgent({
          name: 'spec-drafter',
          description: '说明书撰写',
          ...base,
        }).execute({
          inventionUnderstanding: inventionResult as DynamicResult,
          priorArtSearch: searchResult as DynamicResult,
        })
      },
      {
        specification: {
          technical_field: { content: field },
          background_art: { content: '' },
          invention_content: { content: disclosure },
          detailed_description: { content: '' },
        },
        metrics: { totalWordCount: 0, chapterCount: 0 },
      }
    )

    const claimsResult = await runStep(
      steps[3],
      3,
      steps.length,
      async () => {
        const { ClaimGeneratorAgent } = await import('@yunpat/agent-claim-generator')
        return new ClaimGeneratorAgent({
          name: 'claim-gen',
          description: '权利要求撰写',
          ...base,
        }).execute({
          inventionUnderstanding: inventionResult as DynamicResult,
          priorArtSearch: searchResult as DynamicResult,
          specificationDraft: JSON.stringify((specResult as AgentOutput).specification, null, 2),
        })
      },
      { claimsSet: { independent_claims: [], dependent_claims: [] } }
    )

    const abstractResult = await runStep(
      steps[4],
      4,
      steps.length,
      async () => {
        const { AbstractDrafterAgent } = await import('@yunpat/agent-abstract-drafter')
        return new AbstractDrafterAgent({
          name: 'abstract-drafter',
          description: '摘要撰写',
          ...base,
        }).execute({
          inventionUnderstanding: inventionResult as DynamicResult,
          specification: (specResult as AgentOutput).specification as DynamicResult,
          claims: (claimsResult as AgentOutput).claimsSet as DynamicResult | undefined,
        })
      },
      { abstract: { content: title, wordCount: 0 } }
    )

    const qualityResult = await runStep(
      steps[5],
      5,
      steps.length,
      async () => {
        const { QualityCheckerAgent } = await import('@yunpat/agent-quality')
        return new QualityCheckerAgent({
          name: 'quality',
          description: '质量检查',
          ...base,
        }).execute({
          claims: (claimsResult as AgentOutput).claimsSet,
          specification: (specResult as AgentOutput).specification,
          inventionUnderstanding: inventionResult,
        })
      },
      { overallScore: 0 }
    )

    emitResult(
      formatDraftResult({
        inventionResult: inventionResult as AgentOutput,
        searchResult: searchResult as AgentOutput,
        specResult: specResult as AgentOutput,
        claimsResult: claimsResult as AgentOutput,
        abstractResult: abstractResult as AgentOutput,
        qualityResult: qualityResult as AgentOutput,
      })
    )
  }

  // ─── 权利要求工作流 ──────────────────────────

  private async claimsWorkflow(
    params: Record<string, unknown>,
    steps: Array<{ id: string; name: string }>
  ): Promise<void> {
    const { title, field, disclosure } = extractDraftParams(params)
    const base = this.agentBase()

    const inventionResult = await runStep(
      steps[0],
      0,
      steps.length,
      async () => {
        const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
        return new InventionUnderstandingAgent({
          name: 'invention',
          description: '发明理解',
          ...base,
        }).execute({ title, field, technicalDisclosure: disclosure })
      },
      { title, field, technicalField: field, keyFeatures: [], technicalDisclosure: disclosure }
    )

    const claimsResult = await runStep(
      steps[1],
      1,
      steps.length,
      async () => {
        const { ClaimGeneratorAgent } = await import('@yunpat/agent-claim-generator')
        return new ClaimGeneratorAgent({
          name: 'claim-gen',
          description: '权利要求撰写',
          ...base,
        }).execute({
          inventionUnderstanding: inventionResult as DynamicResult,
          priorArtSearch: {
            comparisonAnalysis: undefined,
            relevantPatents: [],
            searchReport: {} as DynamicResult,
            analysis: {} as DynamicResult,
            overallReport: { passed: true, totalIssues: 0, recommendations: [] },
          },
          specificationDraft: disclosure,
        })
      },
      { claimsSet: { independent_claims: [], dependent_claims: [] } }
    )

    emitResult(formatClaimsResult(claimsResult as AgentOutput))
  }

  // ─── 说明书工作流 ────────────────────────────

  private async specWorkflow(
    params: Record<string, unknown>,
    steps: Array<{ id: string; name: string }>
  ): Promise<void> {
    const { title, field, disclosure } = extractDraftParams(params)
    const base = this.agentBase()

    const inventionResult = await runStep(
      steps[0],
      0,
      steps.length,
      async () => {
        const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
        return new InventionUnderstandingAgent({
          name: 'invention',
          description: '发明理解',
          ...base,
        }).execute({ title, field, technicalDisclosure: disclosure })
      },
      { title, field, technicalField: field, keyFeatures: [], technicalDisclosure: disclosure }
    )

    const specResult = await runStep(
      steps[1],
      1,
      steps.length,
      async () => {
        const { SpecificationDrafterAgent } = await import('@yunpat/agent-specification-drafter')
        return new SpecificationDrafterAgent({
          name: 'spec-drafter',
          description: '说明书撰写',
          ...base,
        }).execute({
          inventionUnderstanding: inventionResult as DynamicResult,
          priorArtSearch: {
            comparisonAnalysis: undefined,
            relevantPatents: [],
            searchReport: {} as DynamicResult,
            analysis: {} as DynamicResult,
            overallReport: { passed: true, totalIssues: 0, recommendations: [] },
          },
        })
      },
      {
        specification: {
          technical_field: { content: field },
          background_art: { content: '' },
          invention_content: { content: disclosure },
          detailed_description: { content: '' },
        },
        metrics: { totalWordCount: 0, chapterCount: 0 },
      }
    )

    emitResult(formatSpecResult(specResult as AgentOutput))
  }

  // ─── 专利检索工作流 ──────────────────────────

  private async searchWorkflow(
    params: Record<string, unknown>,
    steps: Array<{ id: string; name: string }>
  ): Promise<void> {
    const { title, field, disclosure } = extractDraftParams(params)
    const base = this.agentBase()

    const inventionResult = await runStep(
      steps[0],
      0,
      steps.length,
      async () => {
        const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
        return new InventionUnderstandingAgent({
          name: 'invention',
          description: '发明理解',
          ...base,
        }).execute({ title, field, technicalDisclosure: disclosure })
      },
      { title, field, technicalField: field, keyFeatures: [], technicalDisclosure: disclosure }
    )

    const searchResult = await runStep(
      steps[1],
      1,
      steps.length,
      async () => {
        const { PatentSearchAgent } = await import('@yunpat/agent-search')
        const inv = inventionResult as AgentOutput
        return new PatentSearchAgent({ ...base }).execute({
          title,
          field,
          technicalProblem: inv.technicalProblem as string,
          technicalSolution: inv.technicalSolution as string,
          keyFeatures: inv.keyFeatures as string[],
        })
      },
      { totalFound: 0, results: [] as unknown[], strategy: {} }
    )

    emitResult(formatSearchResult(inventionResult as AgentOutput, searchResult as AgentOutput))
  }

  // ─── 专利分析工作流 ──────────────────────────

  private async analyzeWorkflow(
    params: Record<string, unknown>,
    steps: Array<{ id: string; name: string }>
  ): Promise<void> {
    const patentText = (params.patentText as string) || ''
    const base = this.agentBase()

    const analysisResult = await runStep(
      steps[0],
      0,
      steps.length,
      async () => {
        const { PriorArtAnalyzerAgent } = await import('@yunpat/agent-analysis')
        return new PriorArtAnalyzerAgent({
          name: 'analyzer',
          description: '对比文件分析',
          ...base,
        }).execute({
          document: {
            type: 'patent',
            title: '待分析专利',
            content: patentText.substring(0, 500),
            metadata: { publicationNumber: 'TUI-INPUT' },
          },
          analysisDepth: 2,
        })
      },
      { analysis: '分析失败' }
    )

    const reportResult = await runStep(
      steps[1],
      1,
      steps.length,
      async () => {
        const { ComparisonAnalyzerAgent } = await import('@yunpat/agent-patent-analyzer')
        const { PriorArtAnalyzerAgent } = await import('@yunpat/agent-analysis')
        // 先分析对比文件
        const priorArtAgent = new PriorArtAnalyzerAgent({
          name: 'prior-art-analyzer',
          description: '对比文件分析',
          ...base,
        })
        const priorArtResult = await priorArtAgent.execute({
          document: {
            type: 'patent',
            title: '待分析专利',
            content: patentText.substring(0, 500),
            metadata: { publicationNumber: 'TUI-INPUT' },
          },
          analysisDepth: 2,
        })
        // 再执行对比分析
        return new ComparisonAnalyzerAgent({
          name: 'comparison-analyzer',
          description: '对比分析',
          ...base,
        }).execute({
          priorArtAnalyses: [priorArtResult],
          scenario: 'new_application',
        })
      },
      null
    )

    emitResult(
      formatAnalyzeResult(analysisResult as AgentOutput, reportResult as AgentOutput | null)
    )
  }

  // ─── OA 答复工作流 ──────────────────────────

  private async oaWorkflow(
    params: Record<string, unknown>,
    steps: Array<{ id: string; name: string }>
  ): Promise<void> {
    const oaText = (params.oaText as string) || ''
    const patentText = (params.patentText as string) || ''
    const base = this.agentBase()

    const oaResult = await runStep(
      steps[0],
      0,
      steps.length,
      async () => {
        const { PatentResponderAgent } = await import('@yunpat/agent-patent-responder')
        return new PatentResponderAgent({
          name: 'responder',
          description: 'OA答复',
          ...base,
        }).execute({
          officeAction: { applicationNumber: '', patentTitle: '', officeActionContent: oaText },
          originalApplication: { title: '', claims: '', description: patentText },
        })
      },
      { response: 'OA 答复生成失败，请重试' }
    )

    // PatentResponderAgent 内部已处理全部步骤，标记剩余完成
    for (let i = 1; i < steps.length; i++) emitStepComplete(steps[i].id, 'completed')

    emitResult(formatOAResult(oaResult as AgentOutput))
  }

  // ─── HITL ────────────────────────────────────

  private async waitForHITL(message: string): Promise<unknown> {
    return new Promise((resolve) => {
      this._pendingHITLResolve = resolve
      emitHITL({
        requestId: `hitl-${Date.now()}`,
        sessionId: 'local',
        checkpointId: `cp-${Date.now()}`,
        content: { type: 'confirmation', message },
        options: [
          { id: 'approve', label: '确认继续', action: 'approve' },
          { id: 'reject', label: '拒绝', action: 'reject' },
          { id: 'modify', label: '修改', action: 'modify' },
        ],
        timeout: 300000,
      })
    })
  }
}

// ═══════════════════════════════════════════════════════
// 参数提取
// ═══════════════════════════════════════════════════════

function extractDraftParams(params: Record<string, unknown>): {
  title: string
  field: string
  disclosure: string
} {
  const message = (params.message as string) || ''
  return {
    title: (params.title as string) || message.split('\n')[0] || '',
    field: (params.field as string) || '',
    disclosure: (params.disclosure as string) || message,
  }
}

// ═══════════════════════════════════════════════════════
// 结果格式化
// ═══════════════════════════════════════════════════════

function formatDraftResult(r: {
  inventionResult: AgentOutput
  searchResult: AgentOutput
  specResult: AgentOutput
  claimsResult: AgentOutput
  abstractResult: AgentOutput
  qualityResult: AgentOutput
}): string {
  const p: string[] = ['=== 完整专利撰写结果 ===\n']
  const tf = getStr(r.inventionResult, 'technicalField')
  if (tf) p.push(`技术领域: ${tf}`)
  const kf = r.inventionResult?.keyFeatures
  if (Array.isArray(kf) && kf.length) p.push(`关键特征: ${kf.length} 个`)

  const cs = getNested(r.claimsResult, 'claimsSet')
  const ic = cs?.independent_claims
  if (Array.isArray(ic) && ic.length) {
    p.push('\n【权利要求书】')
    for (const c of ic as AgentOutput[])
      p.push(`  ${c.claim_number}. ${String(c.full_text ?? '').substring(0, 100)}...`)
  }

  const spec = getNested(r.specResult, 'specification')
  if (spec) {
    const tfc = getNested(spec, 'technical_field')
    if (tfc && getStr(tfc, 'content')) {
      p.push('\n【说明书】')
      p.push(`  技术领域: ${getStr(tfc, 'content')!.substring(0, 100)}...`)
    }
    const m = getNested(r.specResult, 'metrics')
    if (m) {
      p.push(`  总字数: ${Number(m.totalWordCount || 0)}`)
      p.push(`  章节数: ${Number(m.chapterCount || 0)}`)
    }
  }

  const ad = getNested(r.abstractResult, 'abstract')
  const ac = ad ? getStr(ad, 'content') : undefined
  if (ac) {
    p.push('\n【摘要】')
    p.push(`  ${ac.substring(0, 200)}...`)
  }
  const os = r.qualityResult?.overallScore
  if (typeof os === 'number') p.push(`\n综合评分: ${os}/100`)
  return p.join('\n')
}

function formatClaimsResult(cr: AgentOutput): string {
  const p: string[] = ['=== 权利要求书 ===\n']
  const cs = getNested(cr, 'claimsSet')
  const ic = cs?.independent_claims
  if (Array.isArray(ic) && ic.length) {
    for (const c of ic as AgentOutput[]) p.push(`${c.claim_number}. ${c.full_text}`)
  } else p.push('未能生成权利要求')
  return p.join('\n')
}

function formatSpecResult(sr: AgentOutput): string {
  const p: string[] = ['=== 说明书 ===\n']
  const s = getNested(sr, 'specification')
  if (s) {
    const tf = getNested(s, 'technical_field')
    if (tf) p.push(`技术领域:\n${getStr(tf, 'content') ?? ''}\n`)
    const bg = getNested(s, 'background_art')
    if (bg) p.push(`背景技术:\n${getStr(bg, 'content') ?? ''}\n`)
    const ic = getNested(s, 'invention_content')
    if (ic) p.push(`发明内容:\n${getStr(ic, 'content') ?? ''}\n`)
    const dd = getNested(s, 'detailed_description')
    if (dd) p.push(`具体实施方式:\n${getStr(dd, 'content') ?? ''}\n`)
  } else p.push('未能生成说明书')
  return p.join('\n')
}

function formatSearchResult(ir: AgentOutput, sr: AgentOutput): string {
  const p: string[] = ['=== 专利检索结果 ===\n']
  const tf = getStr(ir, 'technicalField')
  if (tf) p.push(`技术领域: ${tf}`)
  const st = getNested(sr, 'strategy')
  if (st) {
    p.push('\n检索策略:')
    const sq = getStr(st, 'searchQuery')
    if (sq) p.push(`  查询: ${sq}`)
    const kw = st.keywords
    if (Array.isArray(kw) && kw.length) p.push(`  关键词: ${kw.join(', ')}`)
    const ipc = st.ipcCodes
    if (Array.isArray(ipc) && ipc.length) p.push(`  IPC分类: ${ipc.join(', ')}`)
  }
  const rs = sr.results
  if (Array.isArray(rs) && rs.length) {
    const tot = Number(sr.totalFound || rs.length)
    p.push(`\n找到 ${tot} 条相关专利:`)
    for (let i = 0; i < Math.min(rs.length, 10); i++) {
      const x = rs[i] as AgentOutput
      p.push(
        `  ${i + 1}. ${String(x.patentName || x.title)} (${String(x.applicationNumber || x.publicationNumber || 'N/A')})`
      )
    }
  } else p.push('\n未找到相关专利')
  return p.join('\n')
}

function formatAnalyzeResult(ar: AgentOutput, rr: AgentOutput | null): string {
  const p: string[] = ['=== 专利分析报告 ===\n']
  const a = ar?.analysis
  if (a) p.push(`技术分析:\n${typeof a === 'string' ? a : JSON.stringify(a, null, 2)}`)
  if (rr) {
    p.push('\n详细报告:')
    p.push(JSON.stringify(rr, null, 2))
  }
  return p.join('\n')
}

function formatOAResult(or_: AgentOutput): string {
  const p: string[] = ['=== 审查意见答复 ===\n']
  const r = or_?.response
  if (r) p.push(typeof r === 'string' ? r : JSON.stringify(r, null, 2))
  else p.push('未能生成答复')
  const s = or_?.strategy
  if (s) p.push(`\n答复策略: ${s}`)
  return p.join('\n')
}
