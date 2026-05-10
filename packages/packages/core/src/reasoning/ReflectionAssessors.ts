/**
 * EnhancedReflection 纯评估函数
 *
 * @module reasoning/ReflectionAssessors
 */

import type { ExecutionContext } from '../lifecycle/Lifecycle.js'
import {
  ReflectionDimension,
  QualityLevel,
  ImprovementPriority,
} from './ReflectionTypes.js'
import type {
  DimensionAssessment,
  Improvement,
} from './ReflectionTypes.js'

export function scoreToLevel(score: number): QualityLevel {
  if (score >= 0.9) return QualityLevel.EXCELLENT
  if (score >= 0.75) return QualityLevel.GOOD
  if (score >= 0.5) return QualityLevel.FAIR
  if (score >= 0.25) return QualityLevel.POOR
  return QualityLevel.FAILED
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score))
}

export function getDimensionLabel(dimension: ReflectionDimension): string {
  const labels: Record<ReflectionDimension, string> = {
    [ReflectionDimension.QUALITY]: '质量',
    [ReflectionDimension.COMPLETENESS]: '完整性',
    [ReflectionDimension.CONSISTENCY]: '一致性',
    [ReflectionDimension.SAFETY]: '安全性',
    [ReflectionDimension.EFFICIENCY]: '效率',
  }
  return labels[dimension]
}

export function performRuleBasedAssessment(
  dimension: ReflectionDimension,
  result: unknown,
  _context: ExecutionContext
): DimensionAssessment {
  const issues: string[] = []
  let score = 1.0

  switch (dimension) {
    case ReflectionDimension.QUALITY:
      if (!result || result === null || result === undefined) {
        issues.push('结果为空')
        score = 0
      } else if (typeof result === 'string' && result.trim().length === 0) {
        issues.push('结果为空字符串')
        score = 0.2
      }
      if (typeof result === 'string' && result.toLowerCase().includes('error')) {
        issues.push('结果包含错误信息')
        score = Math.min(score, 0.4)
      }
      break

    case ReflectionDimension.COMPLETENESS:
      if (typeof result === 'string' && result.toLowerCase().includes('todo')) {
        issues.push('包含未完成的 TODO 项')
        score = 0.6
      }
      if (typeof result === 'string' && result.endsWith('...')) {
        issues.push('结果可能被截断')
        score = 0.7
      }
      break

    case ReflectionDimension.CONSISTENCY:
      if (typeof result === 'string') {
        const hasBut = result.toLowerCase().split('但是').length > 2
        if (hasBut) {
          issues.push('可能包含矛盾的陈述')
          score = 0.8
        }
      }
      break

    case ReflectionDimension.SAFETY: {
      const sensitivePatterns = ['密码', 'token', 'secret', 'key']
      const resultStr = JSON.stringify(result).toLowerCase()
      for (const pattern of sensitivePatterns) {
        if (resultStr.includes(pattern)) {
          issues.push(`可能包含敏感信息: ${pattern}`)
          score = Math.min(score, 0.5)
        }
      }
      break
    }

    case ReflectionDimension.EFFICIENCY: {
      const resultSize = JSON.stringify(result).length
      if (resultSize > 100000) {
        issues.push('结果过大，可能影响效率')
        score = 0.7
      }
      break
    }
  }

  return {
    dimension,
    level: scoreToLevel(score),
    score,
    reasoning: issues.length > 0 ? `发现 ${issues.length} 个问题` : '无明显问题',
    issues,
  }
}

export function getSystemPromptForDimension(dimension: ReflectionDimension): string {
  const prompts: Record<ReflectionDimension, string> = {
    [ReflectionDimension.QUALITY]: `你是质量评估专家。
评估标准：
- 准确性：结果是否正确、准确
- 相关性：结果是否与目标相关
- 有用性：结果是否有实际价值
评分：0-1，1表示完美。`,

    [ReflectionDimension.COMPLETENESS]: `你是完整性评估专家。
评估标准：
- 覆盖度：是否覆盖了目标的所有方面
- 深度：是否有足够的细节
- 遗漏：是否有明显遗漏的信息
评分：0-1，1表示完整。`,

    [ReflectionDimension.CONSISTENCY]: `你是一致性评估专家。
评估标准：
- 内部一致性：结果内部是否存在矛盾
- 逻辑一致性：推理是否合乎逻辑
- 格式一致性：格式是否统一
评分：0-1，1表示完全一致。`,

    [ReflectionDimension.SAFETY]: `你是安全评估专家。
评估标准：
- 敏感信息：是否泄露敏感信息
- 有害内容：是否包含有害内容
- 隐私风险：是否存在隐私风险
评分：0-1，1表示安全。`,

    [ReflectionDimension.EFFICIENCY]: `你是效率评估专家。
评估标准：
- 资源使用：计算资源使用是否合理
- 结果大小：结果是否冗余
- 时间复杂度：执行时间是否可接受
评分：0-1，1表示高效。`,
  }

  return prompts[dimension]
}

export function buildAssessmentPrompt(
  dimension: ReflectionDimension,
  result: unknown,
  _context: ExecutionContext,
  goal?: string
): string {
  let prompt = `请对以下执行结果进行【${getDimensionLabel(dimension)}】维度评估：\n\n`

  if (goal) {
    prompt += `原始目标：${goal}\n\n`
  }

  prompt += `执行结果：\n${JSON.stringify(result, null, 2)}\n\n`

  prompt += `请返回 JSON 格式：\n{
  "score": 0-1之间的评分,
  "reasoning": "评估理由",
  "issues": ["问题1", "问题2"],
  "evidence": ["证据片段1", "证据片段2"]
}`

  return prompt
}

export function parseAssessmentResponse(
  dimension: ReflectionDimension,
  content: string
): DimensionAssessment {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        dimension,
        score: clampScore(parsed.score || 0.5),
        level: scoreToLevel(parsed.score || 0.5),
        reasoning: parsed.reasoning || '未提供理由',
        issues: parsed.issues || [],
        evidence: parsed.evidence,
      }
    }
  } catch {
    // 解析失败，返回默认评估
  }

  return {
    dimension,
    score: 0.5,
    level: QualityLevel.FAIR,
    reasoning: 'LLM 响应解析失败，使用默认评估',
    issues: ['无法进行详细评估'],
  }
}

export function calculateOverallScore(assessments: DimensionAssessment[]): {
  overallScore: number
  overallLevel: QualityLevel
} {
  if (assessments.length === 0) {
    return { overallScore: 0.5, overallLevel: QualityLevel.FAIR }
  }

  const weights: Record<ReflectionDimension, number> = {
    [ReflectionDimension.QUALITY]: 0.4,
    [ReflectionDimension.COMPLETENESS]: 0.25,
    [ReflectionDimension.CONSISTENCY]: 0.2,
    [ReflectionDimension.SAFETY]: 0.1,
    [ReflectionDimension.EFFICIENCY]: 0.05,
  }

  let weightedSum = 0
  let totalWeight = 0

  for (const assessment of assessments) {
    const weight = weights[assessment.dimension] || 0.2
    weightedSum += assessment.score * weight
    totalWeight += weight
  }

  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5
  const overallLevel = scoreToLevel(overallScore)

  return { overallScore, overallLevel }
}

export function determineIterationNeed(
  overallScore: number,
  improvements: Improvement[],
  iterationThreshold: number
): { needsIteration: boolean; iterationReason?: string } {
  if (overallScore < iterationThreshold) {
    return {
      needsIteration: true,
      iterationReason: `综合评分 ${overallScore.toFixed(2)} 低于阈值 ${iterationThreshold}`,
    }
  }

  const highPriorityImprovements = improvements.filter(
    (imp) => imp.priority === ImprovementPriority.HIGH
  )
  if (highPriorityImprovements.length > 0) {
    return {
      needsIteration: true,
      iterationReason: `存在 ${highPriorityImprovements.length} 个高优先级问题需要修复`,
    }
  }

  return { needsIteration: false }
}

export function calculateConfidence(
  assessments: DimensionAssessment[],
  improvements: Improvement[]
): number {
  const scores = assessments.map((a) => a.score)
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length

  const consistencyConfidence = 1 - Math.min(variance, 1)
  const improvementConfidence = 1 / (1 + improvements.length * 0.1)

  return (consistencyConfidence + improvementConfidence) / 2
}

export function determinePriority(level: QualityLevel): ImprovementPriority {
  switch (level) {
    case QualityLevel.FAILED:
    case QualityLevel.POOR:
      return ImprovementPriority.HIGH
    case QualityLevel.FAIR:
      return ImprovementPriority.MEDIUM
    case QualityLevel.GOOD:
    case QualityLevel.EXCELLENT:
      return ImprovementPriority.LOW
  }
}

export function generateActionSteps(dimension: ReflectionDimension): string[] {
  const stepsMap: Record<ReflectionDimension, string[]> = {
    [ReflectionDimension.QUALITY]: ['重新验证结果准确性', '检查与目标的相关性', '补充缺失的信息'],
    [ReflectionDimension.COMPLETENESS]: ['检查遗漏的方面', '补充必要的细节', '确保覆盖所有要求'],
    [ReflectionDimension.CONSISTENCY]: ['检查内部矛盾', '统一格式和风格', '验证逻辑连贯性'],
    [ReflectionDimension.SAFETY]: ['移除敏感信息', '检查隐私风险', '确保内容安全合规'],
    [ReflectionDimension.EFFICIENCY]: ['优化结果大小', '减少冗余内容', '改进执行效率'],
  }
  return stepsMap[dimension] || ['重新评估并改进']
}

export function getExpectedOutcome(dimension: ReflectionDimension): string {
  const outcomes: Record<ReflectionDimension, string> = {
    [ReflectionDimension.QUALITY]: '提高结果准确性和相关性',
    [ReflectionDimension.COMPLETENESS]: '确保结果完整覆盖目标',
    [ReflectionDimension.CONSISTENCY]: '消除矛盾，保持逻辑一致',
    [ReflectionDimension.SAFETY]: '消除安全风险，保护隐私',
    [ReflectionDimension.EFFICIENCY]: '优化资源使用，提高效率',
  }
  return outcomes[dimension]
}
