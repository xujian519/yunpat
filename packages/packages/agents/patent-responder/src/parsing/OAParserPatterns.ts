/**
 * OA 解析器正则表达式模式集合
 *
 * 集中管理所有正则表达式和关键词模式配置。
 *
 * @module parsing/OAParserPatterns
 */

/**
 * 正则表达式模式集合
 */
export const PATTERNS = {
  // 申请号模式
  applicationNumber: {
    cn: /CN\s*\d{9,13}[\.0-9A-Z]+/i,
    pct: /PCT\/[A-Z]{2}\d{4}\/\d{6,8}/i,
    us: /\d{2}\/\d{3},?\d{3}/,
    ep: /EP\s*\d{6,9}/i,
  },

  // 权利要求引用模式
  claimReference: /权利要求\s*(\d+[-\d]*)|claim\s*(\d+[-\d]*)/gi,

  // 对比文件引用模式 (CN)
  referenceCN: /([A-Z]{2}\d+[A-Z]?|CN\d+[A-Z])/gi,

  // 对比文件引用模式 (US)
  referenceUS: /US\s*\d+,?\d{3}/gi,

  // 驳回理由关键词
  rejectionKeywords: {
    novelty: [
      '不具备新颖性',
      '不具有新颖性',
      '缺乏新颖性',
      '新颖性缺陷',
      'not novel',
      'lack of novelty',
      'anticipated by',
      '被...公开',
      '已在...中披露',
      '现有技术已公开',
    ],
    inventiveness: [
      '不具备创造性',
      '不具有创造性',
      '缺乏创造性',
      '创造性缺陷',
      'not inventive',
      'lack of inventiveness',
      'obvious',
      '显而易见',
      '对于本领域技术人员来说是显而易见的',
      '结合得到',
      '给出技术启示',
    ],
    support: [
      '不支持',
      '得不到说明书支持',
      '支持缺陷',
      'not supported',
      'lack of support',
      '说明书未充分公开',
      '公开不充分',
    ],
    clarity: [
      '不清晰',
      '不清楚',
      '模糊',
      '歧义',
      'not clear',
      'unclear',
      'ambiguous',
      '保护范围不明确',
    ],
    scope: ['保护范围过宽', '缺乏必要技术特征', 'broad scope', 'too broad', '缺乏限定'],
    unity: ['单一性', 'lack of unity', 'not a single general inventive concept'],
    formality: ['形式缺陷', '格式错误', 'formalities', 'formal defect'],
  },

  // 严重程度关键词
  severityKeywords: {
    high: ['致命缺陷', '实质性缺陷', '无法克服', 'fatal', 'substantial defect'],
    medium: ['需要修改', '应当克服', 'should be amended', 'needs to be overcome'],
    low: ['建议修改', '可以优化', 'suggested', 'minor issue'],
  },
}
