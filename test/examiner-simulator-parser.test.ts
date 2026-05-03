/**
 * ExaminerSimulator parseScoreFromResponse 方法测试
 */

import { describe, it, expect } from 'vitest'

// 将parseScoreFromResponse方法提取出来进行测试
function parseScoreFromResponse(content: string, defaultValue: number = 70): number {
  const patterns = [/评分[：:]\s*(\d+)/, /score[：:]\s*(\d+)/i, /(\d{2,3})\s*分/, /^(\d{2,3})$/m]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      const score = parseInt(match[1])
      if (score >= 0 && score <= 100) {
        return score
      }
    }
  }

  return defaultValue
}

describe('ExaminerSimulator - parseScoreFromResponse', () => {
  describe('中文格式解析', () => {
    it('应该解析"评分：85"格式', () => {
      const result = parseScoreFromResponse('评分：85分，这是一个很好的答复')
      expect(result).toBe(85)
    })

    it('应该解析"评分:90"格式（英文冒号）', () => {
      const result = parseScoreFromResponse('评分:90')
      expect(result).toBe(90)
    })

    it('应该解析"85分"格式', () => {
      const result = parseScoreFromResponse('这个答复的质量是85分')
      expect(result).toBe(85)
    })

    it('应该解析多行中的评分', () => {
      const result = parseScoreFromResponse('答复策略分析如下\n评分：75\n理由充分')
      expect(result).toBe(75)
    })
  })

  describe('英文格式解析', () => {
    it('应该解析"Score: 80"格式', () => {
      const result = parseScoreFromResponse('Score: 80')
      expect(result).toBe(80)
    })

    it('应该解析"score:95"格式（小写）', () => {
      const result = parseScoreFromResponse('score:95')
      expect(result).toBe(95)
    })

    it('应该解析"SCORE:100"格式（大写）', () => {
      const result = parseScoreFromResponse('SCORE:100')
      expect(result).toBe(100)
    })
  })

  describe('纯数字格式解析', () => {
    it('应该解析独立的两位数', () => {
      const result = parseScoreFromResponse('65')
      expect(result).toBe(65)
    })

    it('应该解析独立的三位数', () => {
      const result = parseScoreFromResponse('100')
      expect(result).toBe(100)
    })

    it('应该忽略句子中的单个数字（非评分）', () => {
      const result = parseScoreFromResponse('这是一个有5个要点的答复')
      expect(result).toBe(70) // 返回默认值
    })

    it('应该解析多行中的独立数字', () => {
      const result = parseScoreFromResponse('分析如下\n78\n详细说明')
      expect(result).toBe(78)
    })
  })

  describe('边界情况', () => {
    it('应该拒绝超出范围的分数（>100）', () => {
      const result = parseScoreFromResponse('评分：150')
      expect(result).toBe(70) // 返回默认值
    })

    it('应该拒绝负数', () => {
      const result = parseScoreFromResponse('评分：-10')
      expect(result).toBe(70) // 返回默认值
    })

    it('应该接受0分', () => {
      const result = parseScoreFromResponse('评分：0')
      expect(result).toBe(0)
    })

    it('应该接受100分', () => {
      const result = parseScoreFromResponse('评分：100')
      expect(result).toBe(100)
    })

    it('应该处理空字符串', () => {
      const result = parseScoreFromResponse('')
      expect(result).toBe(70) // 返回默认值
    })

    it('应该处理没有评分的文本', () => {
      const result = parseScoreFromResponse('这是一个很好的答复，但没有给出具体评分')
      expect(result).toBe(70) // 返回默认值
    })
  })

  describe('默认值', () => {
    it('应该使用自定义默认值', () => {
      const result = parseScoreFromResponse('没有评分的文本', 50)
      expect(result).toBe(50)
    })

    it('应该使用默认值70', () => {
      const result = parseScoreFromResponse('没有评分的文本')
      expect(result).toBe(70)
    })
  })

  describe('复杂场景', () => {
    it('应该选择第一个匹配的评分模式', () => {
      const result = parseScoreFromResponse('评分：85，这个答复很好，score:90也合理')
      expect(result).toBe(85) // 第一个匹配
    })

    it('应该处理混合中英文的回复', () => {
      const result = parseScoreFromResponse('The 评分：85 points')
      expect(result).toBe(85)
    })

    it('应该处理包含多个数字的文本', () => {
      const result = parseScoreFromResponse('有3个主要优点，评分：85分，建议改进2个方面')
      expect(result).toBe(85) // 应该匹配"85分"而不是"3"或"2"
    })

    it('应该处理换行符和特殊字符', () => {
      const result = parseScoreFromResponse('评分：\n85\n（优秀）')
      expect(result).toBe(85)
    })
  })
})
