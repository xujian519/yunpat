/**
 * 一致性检测纯函数
 *
 * 包含逻辑一致性检测的纯函数，不依赖类实例状态。
 */

import type { Inconsistency } from './ResultValidatorTypes.js'

/**
 * 逻辑一致性验证
 */
export async function detectInconsistencies(content: string): Promise<Inconsistency[]> {
  const inconsistencies: Inconsistency[] = []

  // 1. 检测矛盾陈述
  const contradictions = detectContradictions(content)
  inconsistencies.push(...contradictions)

  // 2. 检测重复内容
  const repetitions = detectRepetitions(content)
  inconsistencies.push(...repetitions)

  // 3. 检测逻辑断层
  const gaps = detectGaps(content)
  inconsistencies.push(...gaps)

  return inconsistencies
}

/**
 * 检测矛盾陈述
 */
function detectContradictions(content: string): Inconsistency[] {
  const contradictions: Inconsistency[] = []

  // 简单矛盾模式：A是对的... A是错的
  const patterns = [
    { pattern: /(.{5,30})是正确的[。，,]?\s*.{0,100}\1是错误的/gs, desc: '相互矛盾的陈述' },
    { pattern: /(.{5,30})是[对真][。，,]?\s*.{0,100}\1是[错假]/gs, desc: '真值矛盾' },
    { pattern: /应该做(.{5,20})[。，,]?\s*.{0,100}不应该做\1/gs, desc: '行动矛盾' },
  ]

  for (const { pattern, desc } of patterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      contradictions.push({
        type: 'contradiction',
        description: desc,
        location: {
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
        },
      })
    }
  }

  return contradictions
}

/**
 * 检测重复内容
 */
function detectRepetitions(content: string): Inconsistency[] {
  const repetitions: Inconsistency[] = []

  // 按句子分割
  const sentences = content.split(/[。！？.!?]/).filter((s) => s.trim().length > 10)

  // 检查相似句子（简单编辑距离）
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const similarity = calculateSimilarity(sentences[i], sentences[j])
      if (similarity > 0.85) {
        repetitions.push({
          type: 'repetition',
          description: `重复内容: "${sentences[i].trim().substring(0, 30)}..."`,
        })
      }
    }
  }

  return repetitions
}

/**
 * 检测逻辑断层
 */
function detectGaps(content: string): Inconsistency[] {
  const gaps: Inconsistency[] = []

  // 检测缺少过渡词的句子序列
  const transitionWords = [
    '因此',
    '所以',
    '然而',
    '但是',
    '此外',
    '另外',
    '首先',
    '其次',
    '最后',
    'then',
    'however',
    'therefore',
  ]

  const sentences = content.split(/[。！？.!?]/).filter((s) => s.trim().length > 5)
  for (let i = 1; i < sentences.length; i++) {
    const prevSentence = sentences[i - 1].trim()
    const currSentence = sentences[i].trim()

    // 如果前一句以结论词结尾，当前句没有过渡词，可能存在断层
    const prevEndsWithConclusion = /因此|所以|综上|可见|得出结论|therefore|thus/.test(prevSentence)
    const currStartsWithTransition = transitionWords.some((word) => currSentence.startsWith(word))

    if (prevEndsWithConclusion && !currStartsWithTransition && currSentence.length > 20) {
      gaps.push({
        type: 'gap',
        description: '可能缺少过渡词或逻辑连接',
      })
    }
  }

  return gaps
}

/**
 * 计算两个字符串的相似度（简化版）
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase()
  const s2 = str2.trim().toLowerCase()

  if (s1 === s2) return 1

  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1

  if (longer.length === 0) return 1

  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

/**
 * Levenshtein 距离
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}
