import type { QualityRule } from './QualityTypes.js'
import { extractKeywords, calculateKeywordOverlap } from './QualityScorer.js'

/**
 * 创建全部质量检查规则
 */
export function createQualityRules(): QualityRule[] {
  return [
    // 权利要求规则
    {
      id: 'CLAIM_001',
      name: '独立权利要求前置',
      category: '权利要求',
      severity: 'critical',
      check: (input) => {
        const firstClaim = input.claims[0]
        if (firstClaim && firstClaim.type !== 'independent') {
          return {
            category: '权利要求',
            subCategory: '结构',
            severity: 'critical',
            description: '第一项权利要求必须是独立权利要求',
            location: `权利要求${firstClaim.number}`,
            ruleReference: 'A26.4',
            suggestion: '将第一项权利要求改为独立权利要求，或调整权利要求顺序',
          }
        }
        return null
      },
    },
    {
      id: 'CLAIM_002',
      name: '从属权利要求引用',
      category: '权利要求',
      severity: 'high',
      check: (input) => {
        for (const claim of input.claims) {
          if (claim.type === 'dependent') {
            if (!claim.dependsOn || claim.dependsOn >= claim.number) {
              return {
                category: '权利要求',
                subCategory: '引用',
                severity: 'high',
                description: `权利要求${claim.number}的引用关系无效`,
                location: `权利要求${claim.number}`,
                ruleReference: 'A26.4',
                suggestion: `检查权利要求${claim.number}的引用关系，确保引用在先的权利要求`,
              }
            }
          }
        }
        return null
      },
    },
    {
      id: 'CLAIM_003',
      name: '权利要求长度',
      category: '权利要求',
      severity: 'medium',
      check: (input) => {
        for (const claim of input.claims) {
          if (claim.content.length > 500) {
            return {
              category: '权利要求',
              subCategory: '表达',
              severity: 'medium',
              description: `权利要求${claim.number}过长（${claim.content.length}字）`,
              location: `权利要求${claim.number}`,
              suggestion: '建议将部分技术特征拆分到从属权利要求中',
              autoFix: {
                original: claim.content,
                fixed: claim.content.substring(0, 300) + '...',
                confidence: 0.5,
              },
            }
          }
        }
        return null
      },
    },
    {
      id: 'CLAIM_004',
      name: '技术术语一致性',
      category: '权利要求',
      severity: 'medium',
      check: (input) => {
        const terms = new Set<string>()
        input.claims.forEach((claim) => {
          const matches = claim.content.match(
            /(?:其特征在于|其中)[^，。]{0,50}?(?:装置|方法|系统|设备)/g
          )
          if (matches) {
            matches.forEach((m) => terms.add(m))
          }
        })

        if (terms.size > 3) {
          return {
            category: '权利要求',
            subCategory: '术语',
            severity: 'medium',
            description: '技术术语使用不一致',
            suggestion: '统一技术术语的使用，确保同一概念使用相同表述',
          }
        }

        return null
      },
    },
    // 说明书规则
    {
      id: 'SPEC_001',
      name: '技术领域完整性',
      category: '说明书',
      severity: 'high',
      check: (input) => {
        const { technicalField } = input.specification
        if (!technicalField || technicalField.length < 20) {
          return {
            category: '说明书',
            subCategory: '技术领域',
            severity: 'high',
            description: '技术领域描述不充分',
            location: '技术领域',
            ruleReference: 'A26.3',
            suggestion: '技术领域应明确说明发明所属或直接应用的具体技术领域',
          }
        }
        return null
      },
    },
    {
      id: 'SPEC_002',
      name: '背景技术完整性',
      category: '说明书',
      severity: 'high',
      check: (input) => {
        const { backgroundArt } = input.specification
        if (!backgroundArt || backgroundArt.length < 50) {
          return {
            category: '说明书',
            subCategory: '背景技术',
            severity: 'high',
            description: '背景技术描述不充分',
            location: '背景技术',
            ruleReference: 'A26.3',
            suggestion: '背景技术应介绍现有技术及其存在的问题',
          }
        }
        return null
      },
    },
    {
      id: 'SPEC_003',
      name: '发明内容完整性',
      category: '说明书',
      severity: 'high',
      check: (input) => {
        const { inventionContent } = input.specification
        if (!inventionContent || inventionContent.length < 100) {
          return {
            category: '说明书',
            subCategory: '发明内容',
            severity: 'high',
            description: '发明内容描述不充分',
            location: '发明内容',
            ruleReference: 'A26.3',
            suggestion: '发明内容应清楚、完整地描述要解决的技术问题、技术方案和有益效果',
          }
        }
        return null
      },
    },
    {
      id: 'SPEC_004',
      name: '具体实施方式充分性',
      category: '说明书',
      severity: 'high',
      check: (input) => {
        const { embodiment } = input.specification
        if (!embodiment || embodiment.length < 200) {
          return {
            category: '说明书',
            subCategory: '具体实施方式',
            severity: 'high',
            description: '具体实施方式不充分',
            location: '具体实施方式',
            ruleReference: 'A26.3',
            suggestion: '具体实施方式应详细描述至少一个实施例，使所属领域技术人员能够实现',
          }
        }
        return null
      },
    },
    {
      id: 'SPEC_005',
      name: '权利要求支持性',
      category: '说明书',
      severity: 'high',
      check: (input) => {
        const { embodiment } = input.specification
        if (!embodiment) return null

        const claimFeatures = new Set<string>()
        input.claims.forEach((claim) => {
          const features = claim.content.match(/(?:包括|包含|设有|配置)[^，。]{1,30}?/g)
          if (features) features.forEach((f) => claimFeatures.add(f))
        })

        let supportedCount = 0
        claimFeatures.forEach((feature) => {
          if (embodiment.includes(feature.substring(0, 10))) {
            supportedCount++
          }
        })

        if (claimFeatures.size > 0 && supportedCount / claimFeatures.size < 0.8) {
          return {
            category: '说明书',
            subCategory: '支持性',
            severity: 'high',
            description: '说明书对权利要求的支持不足',
            location: '具体实施方式',
            ruleReference: 'A26.4',
            suggestion: '在具体实施方式中补充描述权利要求中的技术特征',
          }
        }

        return null
      },
    },
    // 语言规则
    {
      id: 'LANG_001',
      name: '标点符号规范',
      category: '语言表达',
      severity: 'low',
      check: (input) => {
        for (const claim of input.claims) {
          if (
            claim.content.includes('。。') ||
            claim.content.includes('，，') ||
            claim.content.includes('、。') ||
            claim.content.includes('、，')
          ) {
            return {
              category: '语言表达',
              subCategory: '标点符号',
              severity: 'low',
              description: '存在标点符号使用错误',
              location: `权利要求${claim.number}`,
              suggestion: '检查并修正标点符号的使用',
            }
          }
        }
        return null
      },
    },
    {
      id: 'LANG_002',
      name: '表达完整性',
      category: '语言表达',
      severity: 'medium',
      check: (input) => {
        for (const claim of input.claims) {
          if (claim.content.endsWith('，') || claim.content.endsWith('、')) {
            return {
              category: '语言表达',
              subCategory: '表达',
              severity: 'medium',
              description: `权利要求${claim.number}结尾不完整`,
              location: `权利要求${claim.number}`,
              suggestion: '确保权利要求以句号结尾，表达完整',
            }
          }
        }
        return null
      },
    },
    {
      id: 'LANG_003',
      name: '模糊表达检查',
      category: '语言表达',
      severity: 'medium',
      check: (input) => {
        const vagueTerms = ['大约', '左右', '可能', '也许', '大概', '约', '等']
        for (const claim of input.claims) {
          for (const term of vagueTerms) {
            if (claim.content.includes(term)) {
              return {
                category: '语言表达',
                subCategory: '精确性',
                severity: 'medium',
                description: `存在模糊表达"${term}"`,
                location: `权利要求${claim.number}`,
                suggestion: '使用精确的技术表述，避免模糊词汇',
              }
            }
          }
        }
        return null
      },
    },
    // 法律规则
    {
      id: 'LEGAL_001',
      name: '单一性检查',
      category: '法律要求',
      severity: 'high',
      check: (input) => {
        const independentClaims = input.claims.filter((c) => c.type === 'independent')
        if (independentClaims.length > 1) {
          const firstKeywords = extractKeywords(independentClaims[0].content)
          let hasSingleInventiveConcept = true

          for (let i = 1; i < independentClaims.length; i++) {
            const keywords = extractKeywords(independentClaims[i].content)
            const overlap = calculateKeywordOverlap(firstKeywords, keywords)
            if (overlap < 0.3) {
              hasSingleInventiveConcept = false
              break
            }
          }

          if (!hasSingleInventiveConcept) {
            return {
              category: '法律要求',
              subCategory: '单一性',
              severity: 'high',
              description: '可能存在单一性问题',
              ruleReference: 'A31.1',
              suggestion: '检查各独立权利要求是否属于一个总的发明构思',
            }
          }
        }
        return null
      },
    },
  ]
}

/**
 * 根据检查级别选择规则
 */
export function selectRulesByLevel(rules: QualityRule[], level: number): QualityRule[] {
  if (level === 1) {
    return rules.filter((r) => r.severity === 'critical' || r.severity === 'high')
  } else if (level === 2) {
    return rules.filter((r) => r.severity !== 'low')
  }
  return rules
}
