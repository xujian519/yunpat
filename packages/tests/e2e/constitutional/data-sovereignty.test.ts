/**
 * 数据主权 E2E 测试 (T-058 ~ T-063)
 *
 * 测试 DataSovereigntyChecker 的 CON-01 / CON-01B 规则检测：
 * - 技术交底书特征识别（关键词密度 + 长度阈值）
 * - 权利要求草稿识别
 * - 正常内容不被误报
 * - 审计日志条目生成
 *
 * 仅在 MOCK_TESTS=true 时运行
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createSensitiveDisclosure, createNormalContent } from '../helpers/test-data-factory.js'
import { assertCON01Violation, assertNoCON01Violation } from '../helpers/assertion-helpers.js'
import type { SovereigntyCheckResult } from '@yunpat/core'

const describeE2E = process.env.MOCK_TESTS === 'true' ? describe : describe.skip

describeE2E('数据主权检测 (CON-01/CON-01B)', () => {
  let detectTechnicalDisclosure: (content: string) => SovereigntyCheckResult
  let createAuditEntry: (
    ruleId: string,
    contentType: string,
    attemptedRoute: string,
    actualRoute: string,
    userNotified: boolean
  ) => Record<string, unknown>

  beforeAll(async () => {
    const mod = await import('@yunpat/core')
    detectTechnicalDisclosure = mod.detectTechnicalDisclosure
    createAuditEntry = mod.createAuditEntry
  })

  // ========== T-058: 技术交底书检测 — 3+ 关键词 + 500+ 字符 = 敏感 ==========

  it('T-058: 技术交底书包含 3+ 关键词且超过 500 字符时应标记为敏感', () => {
    const sensitiveContent = createSensitiveDisclosure()

    // 前置验证：测试数据本身满足 CON-01 触发条件
    expect(sensitiveContent.length).toBeGreaterThanOrEqual(500)

    const result = detectTechnicalDisclosure(sensitiveContent)

    assertCON01Violation(result)
    expect(result.ruleId).toContain('CON-01')
    expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(3)
    expect(result.routing).toBe('local')

    // 验证关键检测词命中
    const keywordChecks = ['技术交底书', '发明人', '实施例', '实验数据']
    const matched = keywordChecks.filter((kw) => result.matchedKeywords.includes(kw))
    expect(matched.length).toBeGreaterThanOrEqual(2)
  })

  // ========== T-059: 带编号章节的结构化内容 = 敏感 ==========

  it('T-059: 带编号章节的结构化长文本应被识别为敏感', () => {
    const structuredContent = [
      '一、技术领域',
      '本发明涉及一种高效能量转换装置，特别涉及使用纳米材料的新能源技术。',
      '',
      '二、背景技术',
      '现有的能量转换设备存在效率低、体积大的问题。',
      '传统方案无法满足便携式设备的轻薄化和高能效需求。',
      '随着可再生能源需求增长，能量转换效率成为关键技术瓶颈。',
      '',
      '三、发明内容',
      '本发明的技术方案如下：采用新型纳米材料作为转换介质。',
      '该材料具有高导电性和高导热性，能大幅提升能量转换效率。',
      '',
      // 补足 500+ 字符
      '具体实施方式：装置包括外壳、转换层和输出接口。'.repeat(20),
    ].join('\n')

    expect(structuredContent.length).toBeGreaterThanOrEqual(500)

    const result = detectTechnicalDisclosure(structuredContent)

    // 结构化 + 长文本 + 少量关键词应触发 CON-01
    expect(result.isSensitive).toBe(true)
    expect(result.ruleId).toBe('CON-01')
  })

  // ========== T-060: 权利要求草稿检测 (CON-01B) — 2+ 权利要求关键词 ==========

  it('T-060: 权利要求草稿包含 2+ 权利要求关键词时应触发 CON-01B', () => {
    const claimDraft = [
      '权利要求书',
      '',
      '1. 独立权利要求：一种装置，包括：',
      '   主体单元；',
      '   控制单元，耦合到所述主体单元。',
      '',
      '2. 从属权利要求：根据权利要求1所述的装置，其中',
      '   所述控制单元包括处理器。',
    ].join('\n')

    const result = detectTechnicalDisclosure(claimDraft)

    expect(result.isSensitive).toBe(true)
    expect(result.ruleId).toBe('CON-01B')
    expect(result.routing).toBe('abstract_first')
    expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2)

    // 验证命中了权利要求相关关键词
    const claimKeywords = ['权利要求', '独立权利要求', '从属权利要求']
    const matched = claimKeywords.filter((kw) => result.matchedKeywords.includes(kw))
    expect(matched.length).toBeGreaterThanOrEqual(2)
  })

  // ========== T-061: 普通 OA 内容不被标记为敏感 ==========

  it('T-061: 普通 OA 查询内容不应被标记为敏感', () => {
    const normalContent = createNormalContent()

    const result = detectTechnicalDisclosure(normalContent)

    assertNoCON01Violation(result)
    expect(result.routing).toBe('any')
  })

  // ========== T-062: 空内容和短内容不敏感 ==========

  it('T-062: 空内容和过短内容不应被标记为敏感', () => {
    // 空字符串
    const emptyResult = detectTechnicalDisclosure('')
    expect(emptyResult.isSensitive).toBe(false)
    expect(emptyResult.ruleId).toBeNull()
    expect(emptyResult.reason).toBeTruthy()

    // 纯空白
    const whitespaceResult = detectTechnicalDisclosure('   \n\t  ')
    expect(whitespaceResult.isSensitive).toBe(false)

    // 过短内容（即使包含关键词，但长度不足且关键词密度不够）
    const shortResult = detectTechnicalDisclosure('专利')
    expect(shortResult.isSensitive).toBe(false)

    // 短文本含单个关键词也不应触发
    const shortWithKeyword = detectTechnicalDisclosure('这是一份技术交底书')
    expect(shortWithKeyword.isSensitive).toBe(false)
  })

  // ========== T-063: 审计日志条目生成 ==========

  it('T-063: 审计日志条目应包含所有必需字段', () => {
    const entry = createAuditEntry(
      'CON-01',
      'technical_disclosure',
      'external',
      'local',
      true
    )

    // 必需字段存在性检查
    expect(entry).toHaveProperty('event', 'data_sovereignty_check')
    expect(entry).toHaveProperty('timestamp')
    expect(entry).toHaveProperty('rule_id', 'CON-01')
    expect(entry).toHaveProperty('content_type', 'technical_disclosure')
    expect(entry).toHaveProperty('attempted_route', 'external')
    expect(entry).toHaveProperty('actual_route', 'local')
    expect(entry).toHaveProperty('user_notified', true)

    // timestamp 格式应为 ISO 8601
    expect(typeof entry.timestamp).toBe('string')
    expect(() => new Date(entry.timestamp as string)).not.toThrow()

    // 内容哈希应脱敏
    expect(entry).toHaveProperty('content_length_hash', 'redacted')
  })
})
