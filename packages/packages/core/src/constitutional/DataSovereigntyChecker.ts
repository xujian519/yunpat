/**
 * 数据主权检测器
 *
 * 实现 CON-01 规则：检测技术交底书内容，防止泄露到外部 API。
 * 规则定义见 constitutional/data-sovereignty.yaml
 */

/** 检测结果 */
export interface SovereigntyCheckResult {
  /** 是否包含敏感内容 */
  isSensitive: boolean
  /** 命中的规则 ID */
  ruleId: string | null
  /** 命中的关键词 */
  matchedKeywords: string[]
  /** 检测原因 */
  reason: string
  /** 建议的路由目标 */
  routing: 'local' | 'abstract_first' | 'any'
}

/** CON-01 技术交底书关键词 */
const TECHNICAL_DISCLOSURE_KEYWORDS = [
  '技术交底书',
  '发明人',
  '技术方案如下',
  '技术问题',
  '技术效果',
  '实施例',
  '实验数据',
  '测试结果',
  '发明内容',
  '具体实施方式',
  '技术领域',
  '背景技术',
  '有益效果',
  '创新点',
  '核心技术',
] as const

/** CON-01B 权利要求关键词 */
const CLAIM_DRAFT_KEYWORDS = [
  '权利要求',
  '独立权利要求',
  '从属权利要求',
  '前序部分',
  '特征部分',
] as const

/** 最小长度阈值（字符数） */
const MIN_SENSITIVE_LENGTH = 500

/** CON-01 关键词命中阈值 */
const CON01_THRESHOLD = 3

/** CON-01B 关键词命中阈值 */
const CON01B_THRESHOLD = 2

/**
 * 检测内容是否包含技术交底书特征（CON-01）
 */
export function detectTechnicalDisclosure(content: string): SovereigntyCheckResult {
  if (!content || content.trim().length === 0) {
    return {
      isSensitive: false,
      ruleId: null,
      matchedKeywords: [],
      reason: '内容为空',
      routing: 'any',
    }
  }

  // CON-01: 技术交底书关键词密度检测
  const matchedKeywords = TECHNICAL_DISCLOSURE_KEYWORDS.filter((kw) => content.includes(kw))
  const isLongEnough = content.length >= MIN_SENSITIVE_LENGTH
  const hasStructure =
    /[\n\r]/.test(content) &&
    /[一二三四五六七八九十1234567890]、|第[一二三四五六七八九十\d]+[章节步骤]/.test(content)

  if (matchedKeywords.length >= CON01_THRESHOLD && isLongEnough) {
    return {
      isSensitive: true,
      ruleId: 'CON-01',
      matchedKeywords,
      reason: `检测到技术交底书特征（${matchedKeywords.length}/${TECHNICAL_DISCLOSURE_KEYWORDS.length} 个关键词命中，${content.length} 字符）`,
      routing: 'local',
    }
  }

  // 长文本 + 结构化描述 → 也视为敏感
  if (isLongEnough && hasStructure && matchedKeywords.length >= 2) {
    return {
      isSensitive: true,
      ruleId: 'CON-01',
      matchedKeywords,
      reason: `长文本包含结构化技术描述（${matchedKeywords.length} 个关键词命中）`,
      routing: 'local',
    }
  }

  // CON-01B: 权利要求草稿检测
  const claimKeywords = CLAIM_DRAFT_KEYWORDS.filter((kw) => content.includes(kw))
  if (claimKeywords.length >= CON01B_THRESHOLD) {
    return {
      isSensitive: true,
      ruleId: 'CON-01B',
      matchedKeywords: claimKeywords,
      reason: `检测到权利要求草稿特征（${claimKeywords.length} 个关键词命中）`,
      routing: 'abstract_first',
    }
  }

  return {
    isSensitive: false,
    ruleId: null,
    matchedKeywords: [...matchedKeywords, ...claimKeywords],
    reason: '未检测到敏感内容',
    routing: 'any',
  }
}

/**
 * 生成审计日志条目
 */
export function createAuditEntry(
  ruleId: string,
  contentType: string,
  attemptedRoute: string,
  actualRoute: string,
  userNotified: boolean
): Record<string, unknown> {
  return {
    event: 'data_sovereignty_check',
    timestamp: new Date().toISOString(),
    rule_id: ruleId,
    content_type: contentType,
    content_length_hash: 'redacted',
    attempted_route: attemptedRoute,
    actual_route: actualRoute,
    user_notified: userNotified,
  }
}
