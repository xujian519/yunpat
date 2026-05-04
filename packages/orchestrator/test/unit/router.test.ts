/**
 * Router单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Router } from '../../src/router/Router.js'
import type { IntentRecognitionResult } from '../../src/types/index.js'

describe('Router', () => {
  let router: Router

  beforeEach(() => {
    router = new Router()
  })

  describe('路由决策', () => {
    it('应该将CHITCHAT路由到闲聊回复', () => {
      const intent: IntentRecognitionResult = {
        intent: 'CHITCHAT',
        confidence: 0.95,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['你好']
        }
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('chitchat')
      expect(decision.chitchatResponse).toContain('YunPat')
    })

    it('应该将CLARIFY路由到追问', () => {
      const intent: IntentRecognitionResult = {
        intent: 'CLARIFY',
        confidence: 0.5,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: []
        },
        clarifyQuestion: '请问您需要什么帮助？'
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('clarify')
      expect(decision.clarifyQuestion).toBeDefined()
    })

    it('应该将简单意图路由到直达Agent', () => {
      const intent: IntentRecognitionResult = {
        intent: 'DRAFT_CLAIMS',
        confidence: 0.9,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['权利要求']
        }
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('direct')
      expect(decision.targetAgent).toBe('patent-writer')
    })

    it('应该将复杂意图路由到编排模式', () => {
      const intent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          title: '智能控制器',
          field: '控制技术',
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['智能控制器', '撰写']
        }
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('orchestrated')
    })

    it('应该将SEARCH路由到search-agent', () => {
      const intent: IntentRecognitionResult = {
        intent: 'SEARCH',
        confidence: 0.9,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['检索']
        }
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('direct')
      expect(decision.targetAgent).toBe('search-agent')
    })
  })

  describe('辅助方法', () => {
    it('应该正确判断是否需要TaskPlanning', () => {
      const complexIntent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: []
        }
      }

      expect(router.needsTaskPlanning(complexIntent)).toBe(true)

      const chitchatIntent: IntentRecognitionResult = {
        intent: 'CHITCHAT',
        confidence: 0.95,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: []
        }
      }

      expect(router.needsTaskPlanning(chitchatIntent)).toBe(false)
    })

    it('应该正确判断是否可以直接路由', () => {
      const simpleIntent: IntentRecognitionResult = {
        intent: 'DRAFT_CLAIMS',
        confidence: 0.9,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: []
        }
      }

      expect(router.canRouteDirectly(simpleIntent)).toBe(true)

      const complexIntent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: []
        }
      }

      expect(router.canRouteDirectly(complexIntent)).toBe(false)
    })

    it('应该正确判断是否需要追问', () => {
      const clarifyIntent: IntentRecognitionResult = {
        intent: 'CLARIFY',
        confidence: 0.5,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: []
        }
      }

      expect(router.needsClarification(clarifyIntent)).toBe(true)

      const lowConfidenceIntent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.6,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: []
        }
      }

      expect(router.needsClarification(lowConfidenceIntent)).toBe(true)

      const normalIntent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: []
        }
      }

      expect(router.needsClarification(normalIntent)).toBe(false)
    })
  })
})
