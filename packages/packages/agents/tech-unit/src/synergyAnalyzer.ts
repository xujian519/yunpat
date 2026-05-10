/**
 * 协同不可分测试纯函数
 *
 * 实现"协同不可分"测试的纯函数，
 * 检测技术单元是否应合并为一个最小技术单元。
 */

import type { MinimumTechUnit, SynergyTestResult } from './types.js'

/** 对所有单元对运行协同不可分测试 */
export function runSynergyTests(
  units: MinimumTechUnit[],
  technicalProblem?: string
): SynergyTestResult[] {
  const results: SynergyTestResult[] = []

  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i]
      const b = units[j]

      const sameProblem = checkSameProblem(a, b, technicalProblem)
      const synergistic = checkSynergisticEffect(a, b)
      const dependent = checkMutualDependence(a, b)

      const shouldMerge = sameProblem && synergistic && dependent

      results.push({
        shouldMerge,
        conditions: {
          sameTechnicalProblem: sameProblem,
          synergisticEffect: synergistic,
          mutuallyDependent: dependent,
        },
        conclusion: shouldMerge ? 'merge' : 'keep_separate',
        reasoning: shouldMerge
          ? `"${a.name}"与"${b.name}"共同解决同一技术问题，产生协同效果，缺一不可，应合并为一个最小技术单元`
          : `"${a.name}"与"${b.name}"不满足全部合并条件（共同问题:${sameProblem} 协同效果:${synergistic} 相互依存:${dependent}），保持独立`,
      })
    }
  }

  return results
}

/** 检查两个单元是否解决同一技术问题 */
export function checkSameProblem(
  a: MinimumTechUnit,
  b: MinimumTechUnit,
  _problem?: string
): boolean {
  const sharedKeywords = extractKeywords(a.sourceText).filter((kw) =>
    extractKeywords(b.sourceText).includes(kw)
  )
  return sharedKeywords.length >= 1
}

/** 检查两个单元是否产生协同技术效果 */
export function checkSynergisticEffect(a: MinimumTechUnit, b: MinimumTechUnit): boolean {
  if (a.technicalEffect && b.technicalEffect) {
    const effectsA = extractKeywords(a.technicalEffect)
    const effectsB = extractKeywords(b.technicalEffect)
    return effectsA.some((e) => effectsB.includes(e))
  }
  return false
}

/** 检查两个单元是否相互依存 */
export function checkMutualDependence(a: MinimumTechUnit, b: MinimumTechUnit): boolean {
  const referencePatterns = ['所述', '该', '其', '上述']
  return referencePatterns.some(
    (p) => b.sourceText.includes(p) && b.sourceText.includes(a.name.slice(0, 4))
  )
}

/** 从文本中提取关键词（去除停用词） */
export function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    '的',
    '了',
    '在',
    '是',
    '和',
    '与',
    '或',
    '中',
    '为',
    '对',
    '等',
    '及',
    '以',
    '到',
    '可',
    '能',
    '将',
    '由',
    '被',
    '从',
    '上',
    '下',
    '一种',
    '包括',
    '具有',
    '所述',
    '其中',
    '特征在于',
  ])
  return text
    .split(/[\s,，。；：:、/\\（）()\[\]【】「」""''""]+/)
    .filter((w) => w.length >= 2 && !stopwords.has(w))
}

/** 根据协同测试结果合并单元 */
export function applySynergyResults(
  units: MinimumTechUnit[],
  tests: SynergyTestResult[]
): MinimumTechUnit[] {
  const mergeGroups = new Map<number, number[]>()

  for (let t = 0, i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++, t++) {
      if (t < tests.length && tests[t].conclusion === 'merge') {
        if (!mergeGroups.has(i)) mergeGroups.set(i, [i])
        mergeGroups.get(i)!.push(j)
      }
    }
  }

  const merged = new Set<number>()
  const result: MinimumTechUnit[] = []
  let counter = 0

  for (let i = 0; i < units.length; i++) {
    if (merged.has(i)) continue

    const group = mergeGroups.get(i)
    if (group && group.length > 1) {
      const groupUnits = group.map((idx) => units[idx])
      group.slice(1).forEach((idx) => merged.add(idx))

      counter++
      result.push({
        id: `TU-${String(counter).padStart(3, '0')}`,
        name: groupUnits.map((u) => u.name).join(' + '),
        description: groupUnits.map((u) => u.description).join('；'),
        sourceText: groupUnits.map((u) => u.sourceText).join('，'),
        technicalFunction: groupUnits.map((u) => u.technicalFunction).join('；'),
        technicalEffect: groupUnits.map((u) => u.technicalEffect).join('；'),
        criteria: {
          hasIndependentFunction: true,
          hasIndependentEffect: true,
          isIndivisible: true,
          reasoning: `通过"协同不可分"测试合并：${groupUnits.map((u) => u.name).join('、')}共同解决同一技术问题`,
        },
        subFeatures: groupUnits.map((u) => u.id),
        confidence: Math.max(...groupUnits.map((u) => u.confidence)) * 0.9,
      })
    } else {
      counter++
      result.push({ ...units[i], id: `TU-${String(counter).padStart(3, '0')}` })
    }
  }

  return result
}
