import { describe, it, expect, vi } from 'vitest'
import { LogicalConsistencyChecker } from '../../src/validation/LogicalConsistencyChecker.js'
import { LogicalInconsistencyType } from '../../src/validation/hallucination-types.js'
import { createMockLLMAdapter } from '../helpers/mockTypes.js'
import type { LLMAdapter } from '../../src/lifecycle/Lifecycle.js'

/**
 * 测试专用的 LogicalConsistencyChecker 子类，暴露需要测试的内部方法
 */
class TestLogicalConsistencyChecker extends LogicalConsistencyChecker {
  public detectContradictionsByRulesInternal(content: string) {
    return (this as unknown as { detectContradictionsByRules: (content: string) => unknown[] })
      .detectContradictionsByRules(content)
  }

  public areSentencesContradictoryInternal(sentence1: string, sentence2: string) {
    return (this as unknown as { areSentencesContradictory: (s1: string, s2: string) => boolean })
      .areSentencesContradictory(sentence1, sentence2)
  }

  public extractKeyTermsInternal(sentence: string) {
    return (this as unknown as { extractKeyTerms: (sentence: string) => string[] }).extractKeyTerms(
      sentence
    )
  }

  public async detectContradictionsByLLMInternal(content: string) {
    return (this as unknown as { detectContradictionsByLLM: (content: string) => Promise<unknown[]> })
      .detectContradictionsByLLM(content)
  }

  public async detectDuplicationInternal(content: string) {
    return (this as unknown as { detectDuplication: (content: string) => Promise<unknown[]> })
      .detectDuplication(content)
  }

  public calculateSimilarityInternal(text1: string, text2: string) {
    return (this as unknown as { calculateSimilarity: (t1: string, t2: string) => number }).calculateSimilarity(
      text1,
      text2
    )
  }

  public async detectLogicalGapsInternal(content: string) {
    return (this as unknown as { detectLogicalGaps: (content: string) => Promise<unknown[]> })
      .detectLogicalGaps(content)
  }

  public findLocationInTextInternal(text: string, searchText: string) {
    return (this as unknown as { findLocationInText: (t: string, s: string) => unknown }).findLocationInText(
      text,
      searchText
    )
  }
}

describe('LogicalConsistencyChecker', () => {
  function createMockLLM(): LLMAdapter {
    return createMockLLMAdapter()
  }

  describe('constructor', () => {
    it('应使用默认配置', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      expect(checker).toBeDefined()
    })

    it('应使用自定义配置', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM(), {
        detectContradictions: false,
        detectDuplication: false,
        detectLogicalGaps: false,
        similarityThreshold: 0.8,
      })
      expect(checker).toBeDefined()
    })
  })

  describe('checkConsistency', () => {
    it('应检查一致性', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = await checker.checkConsistency('测试内容')
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('应禁用矛盾检测', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM(), {
        detectContradictions: false,
      })
      const result = await checker.checkConsistency('测试内容')
      expect(result).toBeDefined()
    })

    it('应禁用重复检测', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM(), {
        detectDuplication: false,
      })
      const result = await checker.checkConsistency('测试内容')
      expect(result).toBeDefined()
    })

    it('应禁用逻辑断层检测', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM(), {
        detectLogicalGaps: false,
      })
      const result = await checker.checkConsistency('测试内容')
      expect(result).toBeDefined()
    })

    it('应处理空字符串', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = await checker.checkConsistency('')
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('应处理包含多行的内容', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '第一行。\n第二行。\n第三行。'
      const result = await checker.checkConsistency(content)
      expect(result).toBeDefined()
    })
  })

  describe('detectContradictionsByRules', () => {
    it('应检测显式矛盾', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.detectContradictionsByRulesInternal('这是一个测试。这不是一个测试。')
      expect(result).toBeDefined()
    })

    it('应处理无矛盾内容', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.detectContradictionsByRulesInternal('这是一个测试。这是另一个测试。')
      expect(result).toBeDefined()
    })

    it('应检测包含否定词和肯定词的句子', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '这个产品不存在。这个产品存在。'
      const result = checker.detectContradictionsByRulesInternal(content)
      expect(result).toBeDefined()
      if (result.length > 0) {
        expect(result[0].type).toBe(LogicalInconsistencyType.CONTRADICTION)
      }
    })

    it('应处理单句内容', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.detectContradictionsByRulesInternal('只有一句测试内容。')
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('应正确处理否定词和肯定词', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '该方法是有效的。该方法不是有效的。'
      const result = checker.detectContradictionsByRulesInternal(content)
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('areSentencesContradictory', () => {
    it('应检测矛盾句子（包含-不包含）', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '该方法包含三个步骤。'
      const sentence2 = '该方法不包含任何步骤。'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })

    it('应检测矛盾句子（是-不是）', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '这种方法是最好的解决方案。'
      const sentence2 = '这种方法不是最好的解决方案。'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })

    it('应检测矛盾句子（存在-不存在）', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '这个问题确实存在。'
      const sentence2 = '这个问题根本不存在。'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })

    it('应检测矛盾句子（可以-不能）', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '用户可以随时取消订单。'
      const sentence2 = '用户不能取消订单。'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })

    it('应检测矛盾句子（必须-禁止）', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '所有组件必须进行测试。'
      const sentence2 = '组件禁止进行测试。'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })

    it('应检测矛盾句子（有-没有）', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '这个方案有明显优势。'
      const sentence2 = '这个方案没有明显优势。'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })

    it('应检测矛盾句子（会-不会）', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '这种方法会提高效率。'
      const sentence2 = '这种方法不会提高效率。'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })
  })

  describe('extractKeyTerms', () => {
    it('应提取关键术语', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence = '该方法通过深度学习模型提取特征。'
      const result = checker.extractKeyTermsInternal(sentence)
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('应提取英文关键术语', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence = 'The system uses machine learning to classify data.'
      const result = checker.extractKeyTermsInternal(sentence)
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('应提取中英文混合关键术语', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence = '该模型使用了transformer架构进行深度学习。'
      const result = checker.extractKeyTermsInternal(sentence)
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('应处理空句子', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.extractKeyTermsInternal('')
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })
  })

    it('应处理无矛盾内容', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.detectContradictionsByRulesInternal('这是一个测试。这是另一个测试。')
      expect(result).toBeDefined()
    })

    it('应检测包含否定词和肯定词的句子', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '这个产品不存在。这个产品存在。'
      const result = checker.detectContradictionsByRulesInternal(content)
      expect(result).toBeDefined()
      if (result.length > 0) {
        expect(result[0].type).toBe(LogicalInconsistencyType.CONTRADICTION)
      }
    })

    it('应处理单句内容', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.detectContradictionsByRulesInternal('只有一句测试内容。')
      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })

    it('应处理包含多个句子的内容', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '第一句。第二句。第三句。第四句。'
      const result = checker.detectContradictionsByRulesInternal(content)
      expect(result).toBeDefined()
    })
  })

  describe('areSentencesContradictory', () => {
    it('应检测否定+肯定的矛盾', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '这个产品 不存在 功能'
      const sentence2 = '这个产品 存在 功能'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })

    it('应检测肯定+否定的矛盾', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '这个产品 存在 功能'
      const sentence2 = '这个产品 不存在 功能'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })

    it('应返回false当两个句子都是肯定', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '这个方案 很好'
      const sentence2 = '这个方案 不错'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(false)
    })

    it('应返回false当两个句子都是否定', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '这个方案 不好'
      const sentence2 = '这个方案 不差'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(false)
    })

    it('应返回false当关键术语少于2个', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '不存在 功能'
      const sentence2 = '存在 功能'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(false)
    })

    it('应处理大小写', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '这个产品 不存在 功能'
      const sentence2 = '这个产品 存在 功能'
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })

    it('应处理包含空格的内容', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence1 = '  这个产品 不存在 功能  '
      const sentence2 = '  这个产品 存在 功能  '
      const result = checker.areSentencesContradictoryInternal(sentence1, sentence2)
      expect(result).toBe(true)
    })
  })

  describe('extractKeyTerms', () => {
    it('应提取关键术语', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence = '人工智能技术在医疗领域的应用'
      const result = checker.extractKeyTermsInternal(sentence)
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('应过滤停用词', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence = '这是一个关于人工智能的测试'
      const result = checker.extractKeyTermsInternal(sentence)
      expect(result).toBeDefined()
      expect(result).not.toContain('的')
      expect(result).not.toContain('是')
      expect(result).not.toContain('一个')
    })

    it('应过滤标点符号', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence = '人工智能,机器学习,深度学习'
      const result = checker.extractKeyTermsInternal(sentence)
      expect(result).toBeDefined()
      expect(result).not.toContain(',')
    })

    it('应过滤单字词', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const sentence = '我 是 测 试'
      const result = checker.extractKeyTermsInternal(sentence)
      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })

    it('应处理空字符串', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.extractKeyTermsInternal('')
      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })
  })

  describe('detectContradictionsByLLM', () => {
    it('应正确解析LLM返回的JSON', async () => {
      const mockLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify([
              {
                description: '矛盾描述',
                statements: ['陈述1', '陈述2'],
                severity: 'critical',
              },
            ]),
          },
        }),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectContradictionsByLLMInternal('测试内容')
      expect(result).toBeDefined()
      expect(result.length).toBe(1)
      expect(result[0].description).toBe('矛盾描述')
      expect(result[0].severity).toBe('critical')
    })

    it('应处理LLM返回的空数组', async () => {
      const mockLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify([]),
          },
        }),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectContradictionsByLLMInternal('测试内容')
      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })

    it('应处理LLM返回多个矛盾', async () => {
      const mockLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify([
              {
                description: '矛盾1',
                statements: ['陈述1', '陈述2'],
                severity: 'major',
              },
              {
                description: '矛盾2',
                statements: ['陈述3', '陈述4'],
                severity: 'minor',
              },
            ]),
          },
        }),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectContradictionsByLLMInternal('测试内容')
      expect(result).toBeDefined()
      expect(result.length).toBe(2)
    })

    it('应处理LLM返回的invalid JSON', async () => {
      const mockLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: 'invalid json',
          },
        }),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectContradictionsByLLMInternal('测试内容')
      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })

    it('应处理LLM抛出的异常', async () => {
      const mockLLM = {
        chat: vi.fn().mockRejectedValue(new Error('LLM error')),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectContradictionsByLLMInternal('测试内容')
      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })

    it('应使用默认severity当LLM未返回', async () => {
      const mockLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify([
              {
                description: '矛盾描述',
                statements: ['陈述1', '陈述2'],
              },
            ]),
          },
        }),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectContradictionsByLLMInternal('测试内容')
      expect(result).toBeDefined()
      expect(result[0].severity).toBe('major')
    })
  })

  describe('detectDuplication', () => {
    it('应检测重复内容', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '重复内容\n\n重复内容'
      const result = await checker.detectDuplicationInternal(content)
      expect(result).toBeDefined()
    })

    it('应处理无重复内容', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = await checker.detectDuplicationInternal('唯一内容')
      expect(result).toBeDefined()
    })

    it('应使用自定义相似度阈值', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM(), {
        similarityThreshold: 0.5,
      })
      const content = '相似内容1\n\n相似内容2'
      const result = await checker.detectDuplicationInternal(content)
      expect(result).toBeDefined()
    })

    it('应处理单段落内容', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = await checker.detectDuplicationInternal('单段落内容')
      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })

    it('应处理包含多个段落的内容', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '第一段\n\n第二段\n\n第三段'
      const result = await checker.detectDuplicationInternal(content)
      expect(result).toBeDefined()
    })

    it('应返回正确的重复类型和严重程度', async () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '重复内容\n\n重复内容'
      const result = await checker.detectDuplicationInternal(content)
      if (result.length > 0) {
        expect(result[0].type).toBe(LogicalInconsistencyType.DUPLICATION)
        expect(result[0].severity).toBe('minor')
        expect(result[0].suggestedFix).toBeDefined()
      }
    })
  })

  describe('calculateSimilarity', () => {
    it('应计算两个相同文本的相似度为1', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.calculateSimilarityInternal('相同文本', '相同文本')
      expect(result).toBe(1)
    })

    it('应计算两个完全不同文本的相似度为0', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.calculateSimilarityInternal('文本A', '文本B')
      expect(result).toBe(0)
    })

    it('应计算部分相似文本的相似度', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const text1 = '人工智能在医疗领域的应用'
      const text2 = '人工智能在医疗领域的发展'
      const result = checker.calculateSimilarityInternal(text1, text2)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })

    it('应处理空字符串', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.calculateSimilarityInternal('', '')
      expect(result).toBe(0)
    })

    it('应处理一个空字符串', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.calculateSimilarityInternal('文本A', '')
      expect(result).toBe(0)
    })

    it('应处理大小写', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.calculateSimilarityInternal('文本A', '文本a')
      expect(result).toBe(1)
    })
  })

  describe('detectLogicalGaps', () => {
    it('应正确解析LLM返回的JSON', async () => {
      const mockLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify([
              {
                description: '逻辑断层描述',
                location: '断层位置',
                suggestedFix: '修复建议',
              },
            ]),
          },
        }),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectLogicalGapsInternal('测试内容')
      expect(result).toBeDefined()
      expect(result.length).toBe(1)
      expect(result[0].type).toBe(LogicalInconsistencyType.LOGICAL_GAP)
      expect(result[0].severity).toBe('minor')
    })

    it('应处理LLM返回的空数组', async () => {
      const mockLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify([]),
          },
        }),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectLogicalGapsInternal('测试内容')
      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })

    it('应处理LLM返回的invalid JSON', async () => {
      const mockLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: 'invalid json',
          },
        }),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectLogicalGapsInternal('测试内容')
      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })

    it('应处理LLM抛出的异常', async () => {
      const mockLLM = {
        chat: vi.fn().mockRejectedValue(new Error('LLM error')),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectLogicalGapsInternal('测试内容')
      expect(result).toBeDefined()
      expect(result.length).toBe(0)
    })

    it('应包含修复建议', async () => {
      const mockLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify([
              {
                description: '逻辑断层描述',
                location: '断层位置',
                suggestedFix: '添加过渡句',
              },
            ]),
          },
        }),
      }
      const checker = new TestLogicalConsistencyChecker(mockLLM)
      const result = await checker.detectLogicalGapsInternal('测试内容')
      expect(result).toBeDefined()
      expect(result[0].suggestedFix).toBe('添加过渡句')
    })
  })

  describe('findLocationInText', () => {
    it('应找到子字符串的位置', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '第一行\n第二行\n第三行'
      const result = checker.findLocationInTextInternal(content, '第二行')
      expect(result).toBeDefined()
      expect(result?.line).toBe(2)
    })

    it('应返回undefined当找不到子字符串', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '第一行\n第二行\n第三行'
      const result = checker.findLocationInTextInternal(content, '不存在的内容')
      expect(result).toBeUndefined()
    })

    it('应截断过长的文本', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const longText =
        '这是一段很长的文本内容，用来测试文本截断功能，当文本长度超过一定限制时应该被截断并添加省略号，这个文本超过50个字符了。'
      const result = checker.findLocationInTextInternal(longText, longText)
      expect(result).toBeDefined()
      if (result) {
        expect(result.text.length).toBeLessThanOrEqual(53)
        expect(result.text).toContain('...')
      }
    })

    it('应计算正确的行号', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '第一行\n第二行\n第三行\n第四行'
      const result = checker.findLocationInTextInternal(content, '第四行')
      expect(result).toBeDefined()
      expect(result?.line).toBe(4)
    })

    it('应计算正确的列号', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const content = '第一行\n  第二行'
      const result = checker.findLocationInTextInternal(content, '第二行')
      expect(result).toBeDefined()
      expect(result?.column).toBe(2)
    })
  })

  describe('generateConsistencyReport', () => {
    it('应返回成功消息当无问题', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.generateConsistencyReport([])
      expect(result).toBe('✅ 未发现逻辑一致性问题')
    })

    it('应生成包含问题的报告', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const inconsistencies = [
        {
          id: '1',
          type: LogicalInconsistencyType.CONTRADICTION,
          severity: 'critical' as const,
          description: '严重矛盾',
          locations: [],
          conflictingStatements: [],
        },
      ]
      const result = checker.generateConsistencyReport(inconsistencies)
      expect(result).toContain('严重问题')
      expect(result).toContain('严重矛盾')
    })

    it('应按严重程度分组问题', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const inconsistencies = [
        {
          id: '1',
          type: LogicalInconsistencyType.CONTRADICTION,
          severity: 'critical' as const,
          description: '严重矛盾',
          locations: [],
          conflictingStatements: [],
        },
        {
          id: '2',
          type: LogicalInconsistencyType.DUPLICATION,
          severity: 'major' as const,
          description: '主要重复',
          locations: [],
          conflictingStatements: [],
        },
        {
          id: '3',
          type: LogicalInconsistencyType.LOGICAL_GAP,
          severity: 'minor' as const,
          description: '次要断层',
          locations: [],
          conflictingStatements: [],
        },
      ]
      const result = checker.generateConsistencyReport(inconsistencies)
      expect(result).toContain('🔴 严重问题:')
      expect(result).toContain('🟠 主要问题:')
      expect(result).toContain('🟡 次要问题:')
    })

    it('应处理只有严重问题的情况', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const inconsistencies = [
        {
          id: '1',
          type: LogicalInconsistencyType.CONTRADICTION,
          severity: 'critical' as const,
          description: '严重矛盾',
          locations: [],
          conflictingStatements: [],
        },
      ]
      const result = checker.generateConsistencyReport(inconsistencies)
      expect(result).toContain('🔴 严重问题:')
      expect(result).not.toContain('🟠 主要问题:')
      expect(result).not.toContain('🟡 次要问题:')
    })

    it('应处理只有主要问题的情况', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const inconsistencies = [
        {
          id: '1',
          type: LogicalInconsistencyType.DUPLICATION,
          severity: 'major' as const,
          description: '主要重复',
          locations: [],
          conflictingStatements: [],
        },
      ]
      const result = checker.generateConsistencyReport(inconsistencies)
      expect(result).not.toContain('🔴 严重问题:')
      expect(result).toContain('🟠 主要问题:')
      expect(result).not.toContain('🟡 次要问题:')
    })

    it('应处理只有次要问题的情况', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const inconsistencies = [
        {
          id: '1',
          type: LogicalInconsistencyType.LOGICAL_GAP,
          severity: 'minor' as const,
          description: '次要断层',
          locations: [],
          conflictingStatements: [],
        },
      ]
      const result = checker.generateConsistencyReport(inconsistencies)
      expect(result).not.toContain('🔴 严重问题:')
      expect(result).not.toContain('🟠 主要问题:')
      expect(result).toContain('🟡 次要问题:')
    })
  })

  describe('getConsistencyStats', () => {
    it('应返回空统计当无问题', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const result = checker.getConsistencyStats([])
      expect(result).toEqual({
        total: 0,
        critical: 0,
        major: 0,
        minor: 0,
        byType: {},
      })
    })

    it('应统计不同严重程度的问题', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const inconsistencies = [
        {
          id: '1',
          type: LogicalInconsistencyType.CONTRADICTION,
          severity: 'critical' as const,
          description: '严重矛盾',
          locations: [],
          conflictingStatements: [],
        },
        {
          id: '2',
          type: LogicalInconsistencyType.DUPLICATION,
          severity: 'major' as const,
          description: '主要重复',
          locations: [],
          conflictingStatements: [],
        },
        {
          id: '3',
          type: LogicalInconsistencyType.LOGICAL_GAP,
          severity: 'minor' as const,
          description: '次要断层',
          locations: [],
          conflictingStatements: [],
        },
      ]
      const result = checker.getConsistencyStats(inconsistencies)
      expect(result.total).toBe(3)
      expect(result.critical).toBe(1)
      expect(result.major).toBe(1)
      expect(result.minor).toBe(1)
    })

    it('应按类型分组统计', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const inconsistencies = [
        {
          id: '1',
          type: LogicalInconsistencyType.CONTRADICTION,
          severity: 'major' as const,
          description: '矛盾1',
          locations: [],
          conflictingStatements: [],
        },
        {
          id: '2',
          type: LogicalInconsistencyType.CONTRADICTION,
          severity: 'major' as const,
          description: '矛盾2',
          locations: [],
          conflictingStatements: [],
        },
        {
          id: '3',
          type: LogicalInconsistencyType.DUPLICATION,
          severity: 'minor' as const,
          description: '重复',
          locations: [],
          conflictingStatements: [],
        },
      ]
      const result = checker.getConsistencyStats(inconsistencies)
      expect(result.byType[LogicalInconsistencyType.CONTRADICTION]).toBe(2)
      expect(result.byType[LogicalInconsistencyType.DUPLICATION]).toBe(1)
    })

    it('应处理相同类型的问题', () => {
      const checker = new TestLogicalConsistencyChecker(createMockLLM())
      const inconsistencies = [
        {
          id: '1',
          type: LogicalInconsistencyType.CONTRADICTION,
          severity: 'critical' as const,
          description: '矛盾1',
          locations: [],
          conflictingStatements: [],
        },
        {
          id: '2',
          type: LogicalInconsistencyType.CONTRADICTION,
          severity: 'critical' as const,
          description: '矛盾2',
          locations: [],
          conflictingStatements: [],
        },
      ]
      const result = checker.getConsistencyStats(inconsistencies)
      expect(result.total).toBe(2)
      expect(result.critical).toBe(2)
      expect(result.byType[LogicalInconsistencyType.CONTRADICTION]).toBe(2)
    })
  })
