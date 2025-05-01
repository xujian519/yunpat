/**
 * Router - 路由决策器
 *
 * 职责：
 * 1. 根据意图识别结果决定路由策略
 * 2. 简单任务直达 Agent
 * 3. 复杂任务进入 TaskPlanning
 * 4. 闲聊直接回复
 * 5. 不明确意图追问
 */

import {
  RoutingDecision,
  IntentRecognitionResult,
  IntentType,
  IntentDomainConfig,
} from '../types/index.js'
import type { AgentRegistry } from '../registry/AgentRegistry.js'

/**
 * Router 配置
 */
export interface RouterConfig {
  /** 问候语文本（CHITCHAT 时使用） */
  greetingMessage?: string
  /** 默认兜底 Agent ID */
  defaultAgent?: string
  /** 领域配置（提供 directRoutes） */
  domainConfig?: IntentDomainConfig
}

export class Router {
  private agentRegistry?: AgentRegistry
  private config: RouterConfig

  constructor(agentRegistry?: AgentRegistry, config?: RouterConfig) {
    this.agentRegistry = agentRegistry
    this.config = {
      greetingMessage: config?.greetingMessage,
      defaultAgent: config?.defaultAgent ?? this.inferDefaultAgent(agentRegistry),
      domainConfig: config?.domainConfig,
    }
  }

  /**
   * 从注册表推断默认兜底 Agent（第一个 domain 层 Agent）
   */
  private inferDefaultAgent(registry?: AgentRegistry): string {
    if (registry) {
      const domainEntry = registry.getManifestEntries().find((e) => e.layer === 'domain')
      if (domainEntry) return domainEntry.agentId
    }
    return 'specification-drafter'
  }

  /**
   * 路由决策
   */
  route(intent: IntentRecognitionResult): RoutingDecision {
    // CODING - 直接回复（YunPat 不做编程）
    if (intent.intent === 'CODING') {
      return {
        type: 'chitchat',
        chitchatResponse:
          'YunPat 是专利智能助手，专注于专利撰写、审查答复和检索分析，暂不支持直接执行编程任务。\n\n' +
          '如果您需要的是：\n' +
          '  • 专利相关功能开发 → 请详细描述需求，我们可以讨论技术方案\n' +
          '  • 自动化流程集成 → 请使用 YunPat CLI 或 SDK\n' +
          '  • 其他编程帮助 → 建议使用通用编程 AI 工具\n\n' +
          '您也可以尝试以下专利相关命令：\n' +
          '/draft 撰写专利  /oa 答复审查意见  /search 专利检索  /analyze 专利分析',
      }
    }

    // CHITCHAT - 直接回复
    if (intent.intent === 'CHITCHAT') {
      return {
        type: 'chitchat',
        chitchatResponse: this.generateChitchatResponse(),
      }
    }

    // CLARIFY - 追问
    if (intent.intent === 'CLARIFY') {
      return {
        type: 'clarify',
        clarifyQuestion: intent.clarifyQuestion || '请问您能详细说明一下需求吗？',
      }
    }

    // SIMPLE - 直接路由
    if (intent.complexity === 'simple') {
      return {
        type: 'direct',
        targetAgent: this.getDirectAgent(intent.intent),
      }
    }

    // COMPLEX - 编排执行
    return {
      type: 'orchestrated',
    }
  }

  /**
   * 获取直接路由的 Agent
   * 优先从注册表能力匹配，兜底使用默认映射
   */
  private getDirectAgent(intent: IntentType): string {
    // 优先从 domainConfig.directRoutes 获取
    const directRoutes = this.config.domainConfig?.directRoutes
    if (directRoutes && directRoutes[intent]) {
      return directRoutes[intent]
    }

    // 尝试从注册表按能力匹配
    if (this.agentRegistry) {
      const matched = this.matchAgentFromRegistry(intent)
      if (matched) return matched
    }

    return this.config.defaultAgent!
  }

  /**
   * 从注册表中按意图关键词和能力匹配 Agent
   */
  private matchAgentFromRegistry(intent: string): string | null {
    const entries = this.agentRegistry!.getManifestEntries()
    const intentLower = intent.toLowerCase()

    // 按清单中的 triggerKeywords 匹配
    for (const entry of entries) {
      if (entry.triggerKeywords?.some((kw) => intentLower.includes(kw.toLowerCase()))) {
        return entry.agentId
      }
    }

    // 从 intent 名称提取关键词，匹配 capabilities
    const intentKeywords = intentLower.split('_')
    for (const keyword of intentKeywords) {
      const matched = entries.find((e) => e.capabilities?.includes(keyword))
      if (matched) return matched.agentId
    }

    return null
  }

  /**
   * 生成闲聊回复（使用可配置问候语）
   */
  private generateChitchatResponse(): string {
    if (this.config.greetingMessage) {
      return this.config.greetingMessage
    }

    return '您好！我是您的任务助手，很高兴为您服务。请告诉我您需要什么帮助？'
  }

  /**
   * 判断是否需要 TaskPlanning
   */
  needsTaskPlanning(intent: IntentRecognitionResult): boolean {
    return (
      intent.complexity === 'complex' && intent.intent !== 'CHITCHAT' && intent.intent !== 'CLARIFY'
    )
  }

  /**
   * 判断是否可以直接路由
   */
  canRouteDirectly(intent: IntentRecognitionResult): boolean {
    return (
      intent.complexity === 'simple' && intent.intent !== 'CHITCHAT' && intent.intent !== 'CLARIFY'
    )
  }

  /**
   * 判断是否需要追问
   */
  needsClarification(intent: IntentRecognitionResult): boolean {
    return intent.intent === 'CLARIFY' || intent.confidence < 0.7
  }
}
