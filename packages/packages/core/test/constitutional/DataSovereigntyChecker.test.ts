/**
 * 数据主权检测 (CON-01) 单元测试
 */

import { describe, it, expect } from 'vitest'
import {
  detectTechnicalDisclosure,
  createAuditEntry,
} from '../../src/constitutional/DataSovereigntyChecker.js'

describe('DataSovereigntyChecker', () => {
  describe('CON-01: 技术交底书检测', () => {
    it('应检测完整技术交底书并触发 CON-01', () => {
      const disclosure = [
        '技术交底书',
        '发明人: 张三',
        '技术方案如下: 本发明涉及一种新型数据处理方法。',
        '技术问题: 现有技术处理效率低。',
        '技术效果: 处理效率提升200%。',
        '实施例1: 测试结果表明处理速度达到10万条/秒。',
        '实验数据: 对比组A为5000条/秒，实验组B为10000条/秒。',
      ].join('\n')

      // 补足长度到 500 字符以上
      const content = disclosure + '\n\n' + '详细描述'.repeat(100)

      const result = detectTechnicalDisclosure(content)

      expect(result.isSensitive).toBe(true)
      expect(result.ruleId).toBe('CON-01')
      expect(result.routing).toBe('local')
      expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(3)
    })

    it('应检测长文本+结构化描述+少量关键词组合', () => {
      const content = [
        '技术问题: 效率低',
        '一、背景',
        '本发明涉及数据处理领域。',
        '技术效果: 显著提升。',
        'A'.repeat(600),
      ].join('\n')

      const result = detectTechnicalDisclosure(content)

      expect(result.isSensitive).toBe(true)
      expect(result.ruleId).toBe('CON-01')
    })

    it('短文本不应触发 CON-01 即使有关键词', () => {
      const result = detectTechnicalDisclosure('这是一个关于技术交底书的简短提及')

      expect(result.isSensitive).toBe(false)
    })
  })

  describe('CON-01B: 权利要求草稿检测', () => {
    it('应检测权利要求草稿并触发 CON-01B', () => {
      const content = '请完善以下独立权利要求和从属权利要求的前序部分和特征部分'

      const result = detectTechnicalDisclosure(content)

      expect(result.isSensitive).toBe(true)
      expect(result.ruleId).toBe('CON-01B')
      expect(result.routing).toBe('abstract_first')
    })

    it('仅一个权利要求关键词不应触发 CON-01B', () => {
      const result = detectTechnicalDisclosure('请检查这份权利要求书')

      expect(result.isSensitive).toBe(false)
    })
  })

  describe('非敏感内容', () => {
    it('普通检索请求不应触发', () => {
      const result = detectTechnicalDisclosure('帮我检索关于Transformer语音识别的专利')

      expect(result.isSensitive).toBe(false)
      expect(result.routing).toBe('any')
    })

    it('通用编程问题不应触发', () => {
      const result = detectTechnicalDisclosure('帮我写一个Python排序函数')

      expect(result.isSensitive).toBe(false)
      expect(result.routing).toBe('any')
    })

    it('空内容不应触发', () => {
      const result = detectTechnicalDisclosure('')

      expect(result.isSensitive).toBe(false)
    })
  })

  describe('createAuditEntry', () => {
    it('应生成正确的审计日志条目', () => {
      const entry = createAuditEntry('CON-01', 'technical_disclosure', 'external', 'local', true)

      expect(entry.event).toBe('data_sovereignty_check')
      expect(entry.rule_id).toBe('CON-01')
      expect(entry.actual_route).toBe('local')
      expect(entry.user_notified).toBe(true)
      expect(entry.timestamp).toBeDefined()
    })
  })
})
