/**
 * Router - 路由决策器
 *
 * 职责：
 * 1. 根据意图识别结果决定路由策略
 * 2. 简单任务直达Agent
 * 3. 复杂任务进入TaskPlanning
 * 4. 闲聊直接回复
 * 5. 不明确意图追问
 */

import { RoutingDecision, IntentRecognitionResult, IntentType } from '../types/index.js'

export class Router {
  /**
   * 路由决策
   */
  route(intent: IntentRecognitionResult): RoutingDecision {
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

    // SIMPLE - 直接路由（跳过专业层）
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
   * 获取直接路由的Agent
   */
  private getDirectAgent(intent: IntentType): string {
    const directRoutes: Record<string, string> = {
      DRAFT_CLAIMS: 'patent-writer',
      DRAFT_SPEC: 'patent-writer',
      SEARCH: 'search-agent',
    }

    return directRoutes[intent] || 'patent-writer'
  }

  /**
   * 生成闲聊回复
   */
  private generateChitchatResponse(): string {
    const responses = [
      '您好！我是YunPat专利代理AI助手，很高兴为您服务。',
      '我可以帮您撰写专利申请、答复审查意见、检索现有技术等。',
      '请告诉我您需要什么帮助？',
    ]
    return responses.join('\n')
  }

  /**
   * 判断是否需要TaskPlanning
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
