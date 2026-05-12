/**
 * Router单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Router } from '../../src/router/Router.js'
import type { IntentRecognitionResult } from '../../src/types/index.js'
import { PatentIntentConfig } from '../../src/intent/PatentIntentConfig.js'

describe('Router', () => {
  let router: Router

  beforeEach(() => {
    router = new Router(undefined, { domainConfig: PatentIntentConfig })
  })

  describe('路由决策', () => {
    it('应该将CLARIFY路由到追问', () => {
      const intent: IntentRecognitionResult = {
        intent: 'CLARIFY',
        confidence: 0.5,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: [],
        },
        clarifyQuestion: '请问您需要什么帮助？',
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
          keywords: ['权利要求'],
        },
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('direct')
      expect(decision.targetAgent).toBe('claim-generator')
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
          keywords: ['智能控制器', '撰写'],
        },
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('orchestrated')
    })

    it('应该将SEARCH路由到search', () => {
      const intent: IntentRecognitionResult = {
        intent: 'SEARCH',
        confidence: 0.9,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['检索'],
        },
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('direct')
      expect(decision.targetAgent).toBe('search')
    })

    it('应该将RESPOND_OA路由到编排模式', () => {
      const intent: IntentRecognitionResult = {
        intent: 'RESPOND_OA',
        confidence: 0.88,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['审查意见', '答复'],
        },
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('orchestrated')
    })

    it('应该将ANALYZE_PORTFOLIO路由到编排模式', () => {
      const intent: IntentRecognitionResult = {
        intent: 'ANALYZE_PORTFOLIO',
        confidence: 0.85,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['专利组合', '分析'],
        },
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('orchestrated')
    })

    it('应该将MULTI_INTENT路由到编排模式', () => {
      const intent: IntentRecognitionResult = {
        intent: 'MULTI_INTENT',
        confidence: 0.91,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['检索', '撰写'],
        },
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('orchestrated')
    })

    it('应该将DRAFT_SPEC路由到specification-drafter', () => {
      const intent: IntentRecognitionResult = {
        intent: 'DRAFT_SPEC',
        confidence: 0.9,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['说明书'],
        },
      }

      const decision = router.route(intent)

      expect(decision.type).toBe('direct')
      expect(decision.targetAgent).toBe('specification-drafter')
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
          keywords: [],
        },
      }

      expect(router.needsTaskPlanning(complexIntent)).toBe(true)
    })

    it('应该正确判断是否可以直接路由', () => {
      const simpleIntent: IntentRecognitionResult = {
        intent: 'DRAFT_CLAIMS',
        confidence: 0.9,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: [],
        },
      }

      expect(router.canRouteDirectly(simpleIntent)).toBe(true)

      const complexIntent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: [],
        },
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
          keywords: [],
        },
      }

      expect(router.needsClarification(clarifyIntent)).toBe(true)

      const lowConfidenceIntent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.6,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: [],
        },
      }

      expect(router.needsClarification(lowConfidenceIntent)).toBe(true)

      const normalIntent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: [],
        },
      }

      expect(router.needsClarification(normalIntent)).toBe(false)
    })
  })
})
