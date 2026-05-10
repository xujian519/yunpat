import type {
  OAParseResult,
  RejectionReason,
  ResponseArgument,
  AmendmentSuggestion,
} from '../types/index.js'
import { RejectionType, ResponseStrategy } from '../types/index.js'
import type { StrategyScore } from './StrategyTypes.js'

type ArgumentTemplate = { category: string; template: string; strength?: number }

const ARGUMENT_TEMPLATES: Record<string, ArgumentTemplate[]> = {
  novelty: [
    {
      category: '区别技术特征',
      template:
        '本申请权利要求{claims}与{reference}相比，至少存在以下区别技术特征：{features}。这些区别技术特征在{reference}中并未公开，也不属于本领域技术人员的公知常识。',
      strength: 4,
    },
    {
      category: '技术效果',
      template: '上述区别技术特征带来了{effect}的技术效果，这是{reference}所未曾预期和实现的。',
      strength: 4,
    },
  ],
  inventiveness: [
    {
      category: '非显而易见性',
      template:
        '{reference}虽然公开了相似的技术方案，但并未给出将{features}应用于本申请技术领域以解决{problem}的技术启示。',
      strength: 4,
    },
    {
      category: '预料不到的技术效果',
      template:
        '本申请通过{features}的设置，实现了{effect}的技术效果，这对于本领域技术人员来说是预料不到的。',
      strength: 5,
    },
    {
      category: '技术障碍',
      template:
        '本领域技术人员在面对{problem}时，存在{obstacle}的技术障碍，而本申请通过{features}成功克服了该障碍。',
      strength: 4,
    },
  ],
  support: [
    {
      category: '充分公开',
      template:
        '说明书在{section}部分对{features}进行了详细描述，本领域技术人员根据说明书公开的内容能够实现该技术方案。',
      strength: 3,
    },
  ],
  clarity: [
    {
      category: '保护范围明确',
      template:
        '权利要求{claims}中{features}的表述是清晰的，其保护范围是明确的，本领域技术人员能够理解其含义。',
      strength: 3,
    },
  ],
  scope: [
    {
      category: '必要技术特征',
      template: '权利要求{claims}包含了实现{function}所需的全部必要技术特征，保护范围适当。',
      strength: 3,
    },
  ],
  unity: [
    {
      category: '单一发明构思',
      template:
        '各项权利要求属于同一个总的发明构思，因为它们都基于{concept}这一技术特征，解决了{problem}这一技术问题。',
      strength: 3,
    },
  ],
  formality: [
    {
      category: '形式问题修正',
      template: '已对权利要求{claims}中的形式问题进行修正，修正后的表述符合专利法要求。',
      strength: 2,
    },
  ],
  utility: [
    {
      category: '实用性',
      template: '本申请的技术方案能够制造和使用，并产生了积极效果，具备实用性。',
      strength: 3,
    },
  ],
  amendment_scope: [
    {
      category: '修改依据',
      template: '修改内容来源于说明书{section}的记载，未超出原说明书和权利要求书记载的范围。',
      strength: 3,
    },
  ],
  other: [
    {
      category: '一般性答辩',
      template: '针对审查员指出的问题，申请人认为...',
      strength: 2,
    },
  ],
}

const STRATEGY_NAMES: Record<ResponseStrategy, string> = {
  argue: '争辩策略',
  amend: '修改策略',
  both: '混合策略',
  abandon: '放弃策略',
  appeal: '复审策略',
}

/**
 * 生成关键论点
 */
export function generateKeyArguments(
  parseResult: OAParseResult,
  strategy: ResponseStrategy
): ResponseArgument[] {
  const result: ResponseArgument[] = []

  for (const rejection of parseResult.rejectionReasons) {
    const argsForRejection = generateArgumentsForRejection(rejection, strategy, parseResult)
    result.push(...argsForRejection)
  }

  return result
}

/**
 * 为特定驳回理由生成论点
 */
export function generateArgumentsForRejection(
  rejection: RejectionReason,
  strategy: ResponseStrategy,
  parseResult: OAParseResult
): ResponseArgument[] {
  const templates = ARGUMENT_TEMPLATES[rejection.type] || ARGUMENT_TEMPLATES.other

  return templates.map((template) => ({
    category: template.category,
    argument: customizeArgumentTemplate(template.template, rejection, parseResult),
    evidence: generateEvidence(rejection, parseResult),
    targetRejection: rejection.type,
    strength: template.strength || 3,
    precedents: [] as string[],
  }))
}

/**
 * 自定义论点模板
 */
export function customizeArgumentTemplate(
  template: string,
  rejection: RejectionReason,
  parseResult: OAParseResult
): string {
  let customized = template

  if (rejection.affectedClaims.length > 0) {
    customized = customized.replace('{claims}', rejection.affectedClaims.join(', '))
  } else {
    customized = customized.replace('{claims}', '相关')
  }

  if (rejection.relatedReferences && rejection.relatedReferences.length > 0) {
    customized = customized.replace('{reference}', rejection.relatedReferences[0])
  } else if (parseResult.citedReferences.length > 0) {
    customized = customized.replace('{reference}', parseResult.citedReferences[0].publicationNumber)
  }

  return customized
}

/**
 * 生成证据
 */
export function generateEvidence(rejection: RejectionReason, parseResult: OAParseResult): string[] {
  const evidence: string[] = []

  if (rejection.relatedReferences && rejection.relatedReferences.length > 0) {
    for (const ref of rejection.relatedReferences) {
      const refData = parseResult.citedReferences.find((r) => r.publicationNumber === ref)
      if (refData) {
        evidence.push(`对比文件${ref}: ${refData.title}`)
      }
    }
  }

  return evidence
}

/**
 * 生成修改建议
 */
export function generateAmendmentSuggestions(
  parseResult: OAParseResult,
  strategy: ResponseStrategy
): AmendmentSuggestion[] {
  if (strategy === ResponseStrategy.ARGUE) return []

  const suggestions: AmendmentSuggestion[] = []

  for (const rejection of parseResult.rejectionReasons) {
    const amendment = generateAmendmentForRejection(rejection)
    if (amendment) suggestions.push(amendment)
  }

  return suggestions
}

/**
 * 为特定驳回理由生成修改建议
 */
export function generateAmendmentForRejection(
  rejection: RejectionReason
): AmendmentSuggestion | null {
  switch (rejection.type) {
    case RejectionType.NOVELTY:
    case RejectionType.INVENTIVENESS:
      if (rejection.affectedClaims.length > 0) {
        return {
          claimNumber: rejection.affectedClaims[0],
          currentText: '（原文）',
          proposedText: '（添加区别技术特征）',
          reason: '通过添加区别技术特征来克服新颖性/创造性问题',
          amendmentType: 'modify',
          expectedEffect: '使权利要求与对比文件明确区分',
          addsNewMatter: false,
        }
      }
      break

    case RejectionType.CLARITY:
    case RejectionType.SCOPE:
      if (rejection.affectedClaims.length > 0) {
        return {
          claimNumber: rejection.affectedClaims[0],
          currentText: '（原文）',
          proposedText: '（进一步限定技术特征）',
          reason: '通过进一步限定来明确保护范围',
          amendmentType: 'modify',
          expectedEffect: '使权利要求的保护范围更加清晰明确',
          addsNewMatter: false,
        }
      }
      break

    case RejectionType.FORMALITY:
      return {
        claimNumber: 1,
        currentText: '（原文）',
        proposedText: '（修正后的表述）',
        reason: '修正形式缺陷',
        amendmentType: 'modify',
        expectedEffect: '符合专利法形式要求',
        addsNewMatter: false,
      }

    default:
      return null
  }

  return null
}

/**
 * 识别风险
 */
export function identifyRisks(
  parseResult: OAParseResult,
  strategy: ResponseStrategy,
  responseArguments: ResponseArgument[]
): string[] {
  const risks: string[] = []

  const highSeverityRejections = parseResult.rejectionReasons.filter((r) => r.severity === 'high')
  if (highSeverityRejections.length > 0) {
    risks.push(`存在${highSeverityRejections.length}项高严重程度驳回理由，可能较难克服`)
  }

  if (strategy === ResponseStrategy.ARGUE) {
    const hasFormalityIssues = parseResult.rejectionReasons.some(
      (r) => r.type === RejectionType.FORMALITY
    )
    if (hasFormalityIssues) {
      risks.push('存在形式缺陷，建议一并修改')
    }
  } else if (strategy === ResponseStrategy.AMEND) {
    risks.push('修改可能导致保护范围缩小')
    risks.push('需要注意避免引入新事项')
  }

  if (parseResult.affectedClaims.length > 5) {
    risks.push('涉及权利要求数量较多，答复难度较大')
  }

  if (parseResult.citedReferences.length > 3) {
    risks.push('引用对比文件较多，需要逐一针对性答辩')
  }

  return risks
}

/**
 * 建议补充证据
 */
export function suggestAdditionalEvidence(
  parseResult: OAParseResult,
  _responseArguments: ResponseArgument[]
): string[] {
  const evidence: string[] = []

  for (const rejection of parseResult.rejectionReasons) {
    switch (rejection.type) {
      case RejectionType.INVENTIVENESS:
        evidence.push('补充实验数据证明技术效果')
        evidence.push('提供技术对比表格')
        break
      case RejectionType.NOVELTY:
        evidence.push('准备区别特征对比表')
        break
      case RejectionType.UTILITY:
        evidence.push('提供样品或试用报告')
        evidence.push('附上产业化证明材料')
        break
    }
  }

  return [...new Set(evidence)]
}

/**
 * 生成替代策略
 */
export function generateAlternatives(
  scores: StrategyScore[],
  selectedStrategy: ResponseStrategy
): Array<{ strategy: ResponseStrategy; probability: number; rationale: string }> {
  return scores
    .filter((s) => s.strategy !== selectedStrategy && s.strategy !== ResponseStrategy.ABANDON)
    .slice(0, 2)
    .map((s) => ({
      strategy: s.strategy,
      probability: s.score,
      rationale: generateAlternativeRationale(s),
    }))
}

/**
 * 生成推荐理由
 */
export function generateRationale(strategyScore: StrategyScore, basedOnCases: string[]): string {
  const parts: string[] = []
  parts.push(`推荐采用${STRATEGY_NAMES[strategyScore.strategy]}`)

  if (strategyScore.details.rejectionMatch > 75) {
    parts.push('，该策略与审查意见指出的驳回理由高度匹配')
  }

  if (strategyScore.details.historicalSuccess > 70 && basedOnCases.length > 0) {
    parts.push(`，基于${basedOnCases.length}个相似案例的分析，该策略具有较高的成功率`)
  }

  if (strategyScore.details.riskAdjustment > 70) {
    parts.push('，且风险可控')
  }

  return parts.join('') + '。'
}

function generateAlternativeRationale(score: StrategyScore): string {
  const parts: string[] = []

  if (score.details.rejectionMatch > 70) parts.push('与驳回理由匹配度较高')
  if (score.details.historicalSuccess > 70) parts.push('历史成功率较高')
  if (score.details.riskAdjustment > 70) parts.push('风险较低')

  return parts.length > 0 ? parts.join('；') : '可作为备选方案'
}
