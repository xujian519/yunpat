/**
 * E2E 专利领域断言工具
 *
 * 提供专利特定结构的断言函数，减少测试代码重复
 */

import { expect } from 'vitest'

// ========== 发明理解断言 ==========

export function assertValidInventionConcepts(result: any) {
  expect(result).toBeDefined()
  expect(result.technicalField).toBeTruthy()
  expect(typeof result.technicalField).toBe('string')

  if (result.inventionConcepts) {
    expect(result.inventionConcepts).toBeInstanceOf(Array)
    for (const concept of result.inventionConcepts) {
      expect(concept.technicalProblem).toBeTruthy()
      expect(concept.keyFeatures).toBeInstanceOf(Array)
      expect(concept.technicalEffects).toBeInstanceOf(Array)
      if (concept.confidence !== undefined) {
        expect(concept.confidence).toBeGreaterThanOrEqual(0)
        expect(concept.confidence).toBeLessThanOrEqual(1)
      }
    }
  }

  if (result.keyFeatures) {
    expect(result.keyFeatures).toBeInstanceOf(Array)
    expect(result.keyFeatures.length).toBeGreaterThan(0)
  }
}

// ========== 权利要求断言 ==========

export function assertValidClaimsSet(claimsSet: any) {
  expect(claimsSet).toBeDefined()

  // 工具输出可能使用 snake_case 或 camelCase
  const indClaims = claimsSet.independent_claims || claimsSet.independentClaims
  const depClaims = claimsSet.dependent_claims || claimsSet.dependentClaims

  expect(indClaims).toBeDefined()

  if (indClaims?.length > 0) {
    for (const claim of indClaims) {
      const num = claim.claim_number ?? claim.claimNumber
      const text = claim.full_text ?? claim.fullText
      expect(num).toBeDefined()
      expect(text).toBeTruthy()
    }
  }

  if (depClaims?.length > 0) {
    for (const claim of depClaims) {
      const num = claim.claim_number ?? claim.claimNumber
      const parent = claim.parent_claim ?? claim.parentClaim ?? claim.dependsOn
      expect(num).toBeDefined()
    }
  }
}

// ========== 质量报告断言 ==========

export function assertValidQualityReport(report: any) {
  expect(report).toBeDefined()
  expect(report).toHaveProperty('overallScore')
  expect(typeof report.overallScore).toBe('number')
  expect(report.overallScore).toBeGreaterThanOrEqual(0)
  expect(report.overallScore).toBeLessThanOrEqual(100)

  if (report.claimsCheck) {
    expect(typeof report.claimsCheck.score).toBe('number')
  }
  if (report.specificationCheck) {
    expect(typeof report.specificationCheck.score).toBe('number')
  }
}

// ========== 说明书断言 ==========

export function assertValidSpecification(spec: any) {
  expect(spec).toBeDefined()

  const requiredChapters = ['technical_field', 'background_art', 'invention_content']
  for (const chapter of requiredChapters) {
    if (spec[chapter]) {
      expect(spec[chapter]).toHaveProperty('content')
      expect(spec[chapter].content).toBeTruthy()
    }
  }
}

// ========== CON-01 断言 ==========

export function assertCON01Violation(result: any) {
  expect(result.isSensitive).toBe(true)
  expect(result.ruleId).toBeTruthy()
  expect(result.matchedKeywords.length).toBeGreaterThan(0)
  expect(result.reason).toBeTruthy()
}

export function assertNoCON01Violation(result: any) {
  expect(result.isSensitive).toBe(false)
}

// ========== 事件序列断言 ==========

export function assertEventSequence(
  events: Array<{ type: string; data?: unknown }>,
  expectedTypes: string[]
) {
  const eventTypes = events.map((e) => e.type)
  for (const expectedType of expectedTypes) {
    expect(eventTypes).toContain(expectedType)
  }
}

// ========== 编排器输出断言 ==========

export function assertValidOrchestratorOutput(output: any) {
  expect(output).toBeDefined()
  expect(output).toHaveProperty('response')
  expect(typeof output.response).toBe('string')
  expect(output.response.length).toBeGreaterThan(0)

  if (output.metadata) {
    expect(output.metadata).toHaveProperty('intent')
    expect(output.metadata).toHaveProperty('confidence')
    expect(output.metadata.confidence).toBeGreaterThanOrEqual(0)
    expect(output.metadata.confidence).toBeLessThanOrEqual(1)
  }
}

// ========== MCP 工具结果断言 ==========

export function assertToolSuccess(result: any) {
  expect(result).toBeDefined()
  expect(result.success).toBe(true)
  expect(result.data).toBeDefined()
}

export function assertToolError(result: any) {
  expect(result).toBeDefined()
  expect(result.success).toBe(false)
  expect(result.error).toBeDefined()
}

// ========== OA 答复断言 ==========

export function assertValidOAResponse(response: any) {
  expect(response).toBeDefined()
  if (response.responseLetter) {
    expect(typeof response.responseLetter).toBe('string')
    expect(response.responseLetter.length).toBeGreaterThan(0)
  }
  if (response.amendedClaims) {
    expect(typeof response.amendedClaims).toBe('string')
  }
  if (response.metrics) {
    expect(typeof response.metrics.wordCount).toBe('number')
  }
}

// ========== 搜索结果断言 ==========

export function assertValidSearchResults(results: any) {
  expect(results).toBeDefined()
  if (results.results) {
    expect(results.results).toBeInstanceOf(Array)
    for (const item of results.results) {
      // 搜索结果使用 patentId 作为标识字段
      expect(item).toHaveProperty('patentId')
      expect(item).toHaveProperty('title')
    }
  }
}

// ========== 比较报告断言 ==========

export function assertValidComparisonReport(report: any) {
  expect(report).toBeDefined()
  if (report.closestPriorArt) {
    expect(report.closestPriorArt).toHaveProperty('title')
    expect(report.closestPriorArt).toHaveProperty('similarity')
  }
  if (report.distinctFeatures) {
    expect(report.distinctFeatures).toBeInstanceOf(Array)
  }
  if (report.inventiveness?.score !== undefined) {
    expect(report.inventiveness.score).toBeGreaterThanOrEqual(0)
    expect(report.inventiveness.score).toBeLessThanOrEqual(1)
  }
}
