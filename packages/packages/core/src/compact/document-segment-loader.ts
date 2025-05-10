/**
 * 专利文档分段加载机制
 *
 * 专利文档的特殊性：
 * - 说明书全文可能 2-3 万字（>50K tokens），不能每次全量送入
 * - 权利要求书需要常驻上下文
 * - 具体实施方式可以按需分段加载
 *
 * 分段策略：
 * - 技术领域/背景技术：始终保留
 * - 发明内容：始终保留（核心）
 * - 具体实施方式：按需加载（引用到某实施例时才加载该段）
 * - 附图说明：压缩为结构描述，需要时再取原始 Base64
 */

import type { DocumentSegment, SegmentLoadStrategy } from './types.js'
import { estimateTextTokens } from '../token/token-estimator.js'

/**
 * 专利说明书标准段落类型
 */
export const PATENT_SECTION_TYPES = {
  TECHNICAL_FIELD: 'technical_field',
  BACKGROUND_ART: 'background_art',
  INVENTION_CONTENT: 'invention_content',
  DETAILED_DESCRIPTION: 'detailed_description',
  DRAWING_DESCRIPTION: 'drawing_description',
  ABSTRACT: 'abstract',
  CLAIMS: 'claims',
} as const

/**
 * 默认段落配置
 */
const DEFAULT_SEGMENT_CONFIG: Record<string, { strategy: SegmentLoadStrategy; priority: number }> =
  {
    [PATENT_SECTION_TYPES.TECHNICAL_FIELD]: { strategy: 'resident', priority: 1 },
    [PATENT_SECTION_TYPES.BACKGROUND_ART]: { strategy: 'resident', priority: 2 },
    [PATENT_SECTION_TYPES.INVENTION_CONTENT]: { strategy: 'resident', priority: 1 },
    [PATENT_SECTION_TYPES.DETAILED_DESCRIPTION]: { strategy: 'on_demand', priority: 3 },
    [PATENT_SECTION_TYPES.DRAWING_DESCRIPTION]: { strategy: 'summary_only', priority: 4 },
    [PATENT_SECTION_TYPES.ABSTRACT]: { strategy: 'resident', priority: 2 },
    [PATENT_SECTION_TYPES.CLAIMS]: { strategy: 'resident', priority: 1 },
  }

/**
 * 文档分段加载器
 */
export class DocumentSegmentLoader {
  private segments = new Map<string, DocumentSegment>()
  private loadedSegments = new Set<string>()
  private segmentConfig: Record<string, { strategy: SegmentLoadStrategy; priority: number }>

  constructor(config?: Record<string, { strategy: SegmentLoadStrategy; priority: number }>) {
    this.segmentConfig = config ?? DEFAULT_SEGMENT_CONFIG
  }

  /**
   * 注册文档段落
   */
  registerSegment(segment: DocumentSegment): void {
    this.segments.set(segment.id, {
      ...segment,
      tokenCount: estimateTextTokens(segment.content),
    })
  }

  /**
   * 批量注册段落
   */
  registerSegments(segments: DocumentSegment[]): void {
    for (const seg of segments) {
      this.registerSegment(seg)
    }
  }

  /**
   * 加载段落（根据策略）
   */
  loadSegment(segmentId: string): DocumentSegment | null {
    const segment = this.segments.get(segmentId)
    if (!segment) {
      return null
    }

    const config = this.segmentConfig[segment.type]
    if (!config) {
      // 未知类型，默认按需加载
      this.loadedSegments.add(segmentId)
      return segment
    }

    switch (config.strategy) {
      case 'resident':
        this.loadedSegments.add(segmentId)
        return segment

      case 'on_demand':
        this.loadedSegments.add(segmentId)
        return segment

      case 'lazy':
        if (!this.loadedSegments.has(segmentId)) {
          this.loadedSegments.add(segmentId)
        }
        return segment

      case 'summary_only':
        return {
          ...segment,
          content: this.generateSummary(segment),
        }

      default:
        return segment
    }
  }

  /**
   * 获取所有已加载的段落
   */
  getLoadedSegments(): DocumentSegment[] {
    return Array.from(this.loadedSegments)
      .map((id) => this.segments.get(id))
      .filter((s): s is DocumentSegment => s !== undefined)
      .sort((a, b) => a.priority - b.priority)
  }

  /**
   * 获取所有常驻段落（自动加载）
   */
  getResidentSegments(): DocumentSegment[] {
    const residentIds = Array.from(this.segments.keys()).filter((id) => {
      const seg = this.segments.get(id)!
      const config = this.segmentConfig[seg.type]
      return config?.strategy === 'resident'
    })

    for (const id of residentIds) {
      this.loadedSegments.add(id)
    }

    return residentIds.map((id) => this.segments.get(id)!).sort((a, b) => a.priority - b.priority)
  }

  /**
   * 获取当前已加载内容的总 token 数
   */
  getLoadedTokenCount(): number {
    return this.getLoadedSegments().reduce((total, seg) => total + seg.tokenCount, 0)
  }

  /**
   * 按需加载具体实施方式中的某一段
   *
   * @param embodimentNumber 实施例编号
   */
  loadEmbodiment(embodimentNumber: number): DocumentSegment | null {
    const segmentId = `embodiment_${embodimentNumber}`
    return this.loadSegment(segmentId)
  }

  /**
   * 按需加载附图说明中的某一张图
   *
   * @param figureNumber 附图编号
   */
  loadFigureDescription(figureNumber: number): DocumentSegment | null {
    const segmentId = `figure_${figureNumber}`
    return this.loadSegment(segmentId)
  }

  /**
   * 卸载段落（释放内存）
   */
  unloadSegment(segmentId: string): void {
    this.loadedSegments.delete(segmentId)
  }

  /**
   * 生成段落摘要（用于 summary_only 策略）
   */
  private generateSummary(segment: DocumentSegment): string {
    const maxSummaryLength = 500
    if (segment.content.length <= maxSummaryLength) {
      return segment.content
    }

    // 提取前几句作为摘要
    const sentences = segment.content.split(/[。\.\n]/)
    let summary = ''
    for (const sentence of sentences.slice(0, 3)) {
      if (summary.length + sentence.length > maxSummaryLength) {
        break
      }
      summary += sentence + '。'
    }

    return summary + `[${segment.title} 共 ${segment.content.length} 字，详细内容按需加载]`
  }

  /**
   * 清除所有加载状态
   */
  clear(): void {
    this.segments.clear()
    this.loadedSegments.clear()
  }
}

/**
 * 从完整说明书文本解析段落
 *
 * 简单的启发式解析：基于常见标题模式分割
 */
export function parseSpecificationIntoSegments(specificationText: string): DocumentSegment[] {
  const segments: DocumentSegment[] = []

  // 定义段落标题模式
  const sectionPatterns = [
    { type: PATENT_SECTION_TYPES.TECHNICAL_FIELD, patterns: ['技术领域', 'Technical Field'] },
    { type: PATENT_SECTION_TYPES.BACKGROUND_ART, patterns: ['背景技术', 'Background Art', '背景'] },
    {
      type: PATENT_SECTION_TYPES.INVENTION_CONTENT,
      patterns: ['发明内容', '发明', 'Summary of Invention'],
    },
    {
      type: PATENT_SECTION_TYPES.DETAILED_DESCRIPTION,
      patterns: ['具体实施方式', '实施方式', 'Detailed Description'],
    },
    {
      type: PATENT_SECTION_TYPES.DRAWING_DESCRIPTION,
      patterns: ['附图说明', 'Brief Description of Drawings'],
    },
  ]

  // 查找各段落边界
  const boundaries: Array<{ type: string; index: number; title: string }> = []

  for (const section of sectionPatterns) {
    for (const pattern of section.patterns) {
      const index = specificationText.indexOf(pattern)
      if (index !== -1) {
        boundaries.push({ type: section.type, index, title: pattern })
        break
      }
    }
  }

  // 按位置排序
  boundaries.sort((a, b) => a.index - b.index)

  // 提取各段落内容
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]
    const end = boundaries[i + 1]
    const content = end
      ? specificationText.substring(start.index, end.index)
      : specificationText.substring(start.index)

    const config = DEFAULT_SEGMENT_CONFIG[start.type]

    segments.push({
      id: start.type,
      type: start.type,
      title: start.title,
      content: content.trim(),
      tokenCount: estimateTextTokens(content),
      isResident: config?.strategy === 'resident',
      priority: config?.priority ?? 5,
    })
  }

  return segments
}

/**
 * 从权利要求书文本解析段落
 */
export function parseClaimsIntoSegments(claimsText: string): DocumentSegment[] {
  // 按权利要求编号分割
  const claimRegex = /(\d+)\.\s*([\s\S]*?)(?=\n\d+\.|$)/g
  const segments: DocumentSegment[] = []
  let match

  while ((match = claimRegex.exec(claimsText)) !== null) {
    const number = parseInt(match[1], 10)
    const content = match[2].trim()

    segments.push({
      id: `claim_${number}`,
      type: PATENT_SECTION_TYPES.CLAIMS,
      title: `权利要求 ${number}`,
      content,
      tokenCount: estimateTextTokens(content),
      isResident: true,
      priority: 1,
    })
  }

  return segments
}
