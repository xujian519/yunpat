/**
 * Router - 路由决策器
 *
 * 职责：
 * 1. 根据意图识别结果决定路由策略
 * 2. 简单任务直达 Agent
 * 3. 复杂任务进入 TaskPlanning
 * 4. CODING 意图在 Gateway 层拦截（不应到达此处）
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
  /** 默认问候语 */
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
    // CLARIFY - 追问
    if (intent.intent === 'CLARIFY') {
      return {
        type: 'clarify',
        clarifyQuestion: intent.clarifyQuestion || '请问您能详细说明一下需求吗？',
      }
    }

    // SIMPLE - 直接路由（含 CODING 等系统意图）
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

    return this.config.defaultAgent ?? 'specification-drafter'
  }

  /**
   * 从注册表中按意图关键词和能力匹配 Agent
   */
  private matchAgentFromRegistry(intent: string): string | null {
    if (!this.agentRegistry) return null
    const entries = this.agentRegistry.getManifestEntries()
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
   * 判断是否需要 TaskPlanning
   */
  needsTaskPlanning(intent: IntentRecognitionResult): boolean {
    return intent.complexity === 'complex' && intent.intent !== 'CLARIFY'
  }

  /**
   * 判断是否可以直接路由
   */
  canRouteDirectly(intent: IntentRecognitionResult): boolean {
    return intent.complexity === 'simple' && intent.intent !== 'CLARIFY'
  }

  /**
   * 判断是否需要追问
   */
  needsClarification(intent: IntentRecognitionResult): boolean {
    return intent.intent === 'CLARIFY' || intent.confidence < 0.7
  }
}
