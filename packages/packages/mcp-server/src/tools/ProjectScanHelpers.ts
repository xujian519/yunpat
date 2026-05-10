/**
 * ProjectScanTool 辅助函数和常量
 *
 * @module tools/ProjectScanHelpers
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── 类型 ────────────────────────────────────────────────────

/** 文件分类桶 */
export type FileBucket = 'text_extractable' | 'image' | 'audio' | 'video' | 'archive' | 'other'

/** 文档分类 */
export type DocCategory =
  | 'official_doc'
  | 'technical_disclosure'
  | 'response_draft'
  | 'comparison_doc'
  | 'evidence'
  | 'correspondence'
  | 'media'
  | 'archive'
  | 'other'

/** 官文类型 */
export type OfficialDocType =
  | 'review_opinion'
  | 'rejection_decision'
  | 'payment_notice'
  | 'grant_decision'
  | 'reexamination_decision'

/** 案件类型 */
export type CaseType = 'invention' | 'utility_model' | 'design' | 'trademark' | 'unknown'

/** 项目阶段 */
export type ProjectPhase =
  | 'filing'
  | 'examination'
  | 'response'
  | 'grant'
  | 'reexamination'
  | 'invalidation'
  | 'unknown'

export interface ScannedDocument {
  filename: string
  filePath: string
  fileSize: number
  category: DocCategory
  officialDocType?: OfficialDocType
  contentPreview?: string
  extractedFields?: {
    applicationNumber?: string
    inventionTitle?: string
  }
}

export interface ProjectProfile {
  caseType: CaseType
  phase: ProjectPhase
  applicationNumbers: string[]
  inventionTitles: string[]
  confidence: number
}

export interface ProjectScanOutput {
  directory: string
  summary: {
    totalFiles: number
    processedFiles: number
    officialDocs: number
    otherDocs: number
    mediaFiles: number
    archiveFiles: number
  }
  documents: ScannedDocument[]
  projectProfile: ProjectProfile
  systemPromptContext: string
}

// ─── 路径安全 ─────────────────────────────────────────────────

const BLOCKED_PATH_PREFIXES = [
  '/etc',
  '/proc',
  '/sys',
  '/dev',
  '/boot',
  '/root',
  '/var/run',
  '/var/log',
  '/System',
  '/Library',
  '/Applications',
]

export function isBlockedPath(resolvedPath: string): boolean {
  const normalized = resolvedPath.toLowerCase()
  return BLOCKED_PATH_PREFIXES.some((p) => normalized.startsWith(p))
}

export const DEFAULT_MAX_DEPTH = 5
export const MAX_ALL_CONTENT_SIZE = 50_000

// ─── 扩展名分类 ───────────────────────────────────────────────

const EXTENSION_MAP: Record<string, FileBucket> = {
  '.pdf': 'text_extractable',
  '.doc': 'text_extractable',
  '.docx': 'text_extractable',
  '.txt': 'text_extractable',
  '.md': 'text_extractable',
  '.rtf': 'text_extractable',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.bmp': 'image',
  '.gif': 'image',
  '.tiff': 'image',
  '.tif': 'image',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.m4a': 'audio',
  '.flac': 'audio',
  '.mp4': 'video',
  '.mov': 'video',
  '.avi': 'video',
  '.mkv': 'video',
  '.zip': 'archive',
  '.rar': 'archive',
  '.7z': 'archive',
  '.tar': 'archive',
  '.gz': 'archive',
  '.bz2': 'archive',
}

export function classifyByExtension(ext: string): FileBucket {
  return EXTENSION_MAP[ext.toLowerCase()] ?? 'other'
}

// ─── CNIPA 官文检测 ───────────────────────────────────────────

const OFFICIAL_DOC_FILENAME_PATTERNS: Array<{ pattern: RegExp; docType: OfficialDocType }> = [
  { pattern: /审查意见|审查通知书/, docType: 'review_opinion' },
  { pattern: /驳回决定/, docType: 'rejection_decision' },
  { pattern: /缴费.*通知书|费用.*通知书/, docType: 'payment_notice' },
  { pattern: /授予|授权.*通知/, docType: 'grant_decision' },
  { pattern: /复审.*决定|无效.*决定/, docType: 'reexamination_decision' },
]

const OFFICIAL_DOC_CONTENT_PATTERNS: Array<{ pattern: RegExp; docType: OfficialDocType }> = [
  { pattern: /审查意见.*通知书/, docType: 'review_opinion' },
  { pattern: /驳回决定/, docType: 'rejection_decision' },
  { pattern: /缴费.*通知书/, docType: 'payment_notice' },
  { pattern: /授予专利权/, docType: 'grant_decision' },
  { pattern: /复审.*决定|无效宣告请求审查决定/, docType: 'reexamination_decision' },
]

const CNIPA_STRUCTURE_MARKERS = ['国家知识产权局', '通知书编号', '申请号：', '申请号:']

const APP_NUMBER_PATTERNS = [
  /申请号[：:]\s*(\d{10,13}[\.X]?\d?)/,
  /申请号[：:]\s*([A-Z]{2}\d{8,12})/,
  /(\d{4}\.\d{5,7})/,
]

const TITLE_PATTERNS = [/发明名称[：:]\s*([^\n\r]+)/, /名称[：:]\s*([^\n\r]+)/]

export function detectOfficialDoc(
  filename: string,
  content?: string
): {
  isOfficial: boolean
  docType?: OfficialDocType
  applicationNumber?: string
  inventionTitle?: string
  confidence: number
} {
  let docType: OfficialDocType | undefined
  let confidence = 0

  for (const { pattern, docType: dt } of OFFICIAL_DOC_FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      docType = dt
      confidence = 0.9
      break
    }
  }

  if (!docType && content) {
    for (const { pattern, docType: dt } of OFFICIAL_DOC_CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        docType = dt
        confidence = 0.75
        break
      }
    }
  }

  if (!docType && content) {
    const markerCount = CNIPA_STRUCTURE_MARKERS.filter((m) => content.includes(m)).length
    if (markerCount >= 2) {
      confidence = 0.5
    }
  }

  if (!docType && confidence === 0) {
    return { isOfficial: false, confidence: 0 }
  }

  let applicationNumber: string | undefined
  if (content) {
    for (const pattern of APP_NUMBER_PATTERNS) {
      const match = content.match(pattern)
      if (match?.[1]) {
        applicationNumber = match[1].trim()
        break
      }
    }
  }

  let inventionTitle: string | undefined
  if (content) {
    for (const pattern of TITLE_PATTERNS) {
      const match = content.match(pattern)
      if (match?.[1]) {
        inventionTitle = match[1].trim()
        break
      }
    }
  }

  return { isOfficial: true, docType, applicationNumber, inventionTitle, confidence }
}

// ─── 非官文分类 ───────────────────────────────────────────────

const TECHNICAL_DISCLOSURE_KEYWORDS = [
  '技术交底书',
  '发明人',
  '技术方案',
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
]
const RESPONSE_DRAFT_KEYWORDS = ['答复', '意见陈述', '申请人认为', '答辩意见']
const COMPARISON_DOC_KEYWORDS = ['对比文件', '对比分析', '特征对比', '区别技术特征']
const EVIDENCE_KEYWORDS = ['证据', '公证书', '附件清单', '证明文件']
const CORRESPONDENCE_KEYWORDS = ['通知书回执', '受理通知书', '缴费回执']

export function classifyNonOfficialDoc(filename: string, content?: string): DocCategory {
  const text = `${filename} ${content ?? ''}`
  const lower = text.toLowerCase()

  if (TECHNICAL_DISCLOSURE_KEYWORDS.filter((kw) => lower.includes(kw)).length >= 3)
    return 'technical_disclosure'
  if (RESPONSE_DRAFT_KEYWORDS.filter((kw) => lower.includes(kw)).length >= 2)
    return 'response_draft'
  if (COMPARISON_DOC_KEYWORDS.some((kw) => lower.includes(kw))) return 'comparison_doc'
  if (EVIDENCE_KEYWORDS.some((kw) => lower.includes(kw))) return 'evidence'
  if (CORRESPONDENCE_KEYWORDS.some((kw) => lower.includes(kw))) return 'correspondence'

  return 'other'
}

// ─── 阶段推断 ─────────────────────────────────────────────────

const OFFICIAL_DOC_PHASE_MAP: Record<OfficialDocType, ProjectPhase> = {
  review_opinion: 'response',
  rejection_decision: 'reexamination',
  payment_notice: 'grant',
  grant_decision: 'grant',
  reexamination_decision: 'invalidation',
}

export function inferCaseType(allContent: string): CaseType {
  if (allContent.includes('实用新型')) return 'utility_model'
  if (allContent.includes('外观设计')) return 'design'
  if (['商标', '注册号', '商品分类', '商标图样'].some((kw) => allContent.includes(kw)))
    return 'trademark'
  return 'invention'
}

export function inferPhase(documents: ScannedDocument[]): {
  phase: ProjectPhase
  confidence: number
} {
  const officialDocs = documents.filter((d) => d.category === 'official_doc' && d.officialDocType)

  if (officialDocs.length > 0) {
    const sorted = [...officialDocs].sort((a, b) => {
      try {
        return fs.statSync(b.filePath).mtimeMs - fs.statSync(a.filePath).mtimeMs
      } catch {
        return 0
      }
    })
    const latestDoc = sorted[0]
    const phase = OFFICIAL_DOC_PHASE_MAP[latestDoc.officialDocType!]
    return { phase, confidence: 0.9 }
  }

  const categories = new Set(documents.map((d) => d.category))
  if (categories.has('technical_disclosure')) return { phase: 'filing', confidence: 0.7 }
  if (categories.has('comparison_doc')) return { phase: 'examination', confidence: 0.6 }
  if (categories.has('response_draft')) return { phase: 'response', confidence: 0.6 }

  return { phase: 'unknown', confidence: 0.2 }
}

// ─── systemPromptContext 生成 ─────────────────────────────────

export function generateSystemPromptContext(
  directory: string,
  profile: ProjectProfile,
  documents: ScannedDocument[]
): string {
  const lines: string[] = []
  lines.push(`[项目上下文]`)
  lines.push(`工作目录: ${directory}`)

  const caseTypeLabels: Record<CaseType, string> = {
    invention: '发明专利',
    utility_model: '实用新型',
    design: '外观设计',
    trademark: '商标',
    unknown: '未确定',
  }
  lines.push(
    `案件类型: ${caseTypeLabels[profile.caseType]} (置信度: ${profile.confidence.toFixed(1)})`
  )

  const phaseLabels: Record<ProjectPhase, string> = {
    filing: '申请准备',
    examination: '审查阶段',
    response: '审查意见答复',
    grant: '授权登记',
    reexamination: '复审',
    invalidation: '无效宣告',
    unknown: '未知阶段',
  }
  lines.push(`当前阶段: ${phaseLabels[profile.phase]}`)

  if (profile.applicationNumbers.length > 0) {
    lines.push(`涉及申请号: ${profile.applicationNumbers.join(', ')}`)
  }
  if (profile.inventionTitles.length > 0) {
    lines.push(`涉及发明: ${profile.inventionTitles.join(', ')}`)
  }

  const officialDocs = documents.filter((d) => d.category === 'official_doc')
  const otherDocs = documents.filter(
    (d) => d.category !== 'official_doc' && d.category !== 'media' && d.category !== 'archive'
  )

  if (officialDocs.length > 0) {
    lines.push(
      `官文: ${officialDocs.map((d) => `${d.filename} (${d.officialDocType ?? '未知类型'})`).join(', ')}`
    )
  }
  if (otherDocs.length > 0) {
    lines.push(`其他文档: ${otherDocs.length} 个`)
  }

  lines.push('')

  const suggestions = generateSuggestions(profile, documents)
  if (suggestions.length > 0) {
    lines.push('可能的工作方向:')
    for (const s of suggestions) {
      lines.push(`  - ${s}`)
    }
  }

  return lines.join('\n')
}

export function generateSuggestions(
  profile: ProjectProfile,
  documents: ScannedDocument[]
): string[] {
  const suggestions: string[] = []

  switch (profile.phase) {
    case 'filing':
      suggestions.push('检索相关先有技术', '分析技术方案的新颖性和创造性', '准备专利申请文件')
      break
    case 'examination':
      suggestions.push('分析对比文件与本申请的区别', '评估授权前景')
      break
    case 'response':
      suggestions.push('分析审查意见要点', '准备答复意见陈述', '考虑是否需要修改权利要求')
      break
    case 'grant':
      suggestions.push('办理登记手续', '缴纳相关费用')
      break
    case 'reexamination':
      suggestions.push('分析驳回理由', '准备复审请求', '检索支持复审的证据')
      break
    case 'invalidation':
      suggestions.push('分析无效宣告理由', '准备无效答辩或无效请求')
      break
  }

  if (documents.some((d) => d.category === 'comparison_doc')) {
    suggestions.push('深入分析对比文件')
  }

  return suggestions
}

// ─── 文本提取 ─────────────────────────────────────────────────

export async function extractText(
  filePath: string,
  ext: string,
  maxPreview: number
): Promise<string | undefined> {
  try {
    if (ext === '.txt' || ext === '.md') {
      const buf = fs.readFileSync(filePath, { encoding: 'utf-8' })
      return buf.slice(0, maxPreview)
    }

    if (ext === '.pdf') {
      try {
        const { PdfExtractTextTool } = await import('@yunpat/document-tools')
        const tool = new PdfExtractTextTool()
        const result = await tool.execute({ filePath, includeMetadata: false }, {} as any)
        return (result as any).text?.slice(0, maxPreview) ?? undefined
      } catch (error) {
        console.warn(
          `[ProjectScanTool] PDF 文本提取失败 (${path.basename(filePath)}):`,
          error instanceof Error ? error.message : String(error)
        )
        return undefined
      }
    }

    if (ext === '.docx') {
      try {
        const { DocxExtractTextTool } = await import('@yunpat/document-tools')
        const tool = new DocxExtractTextTool()
        const result = await tool.execute({ filePath }, {} as any)
        return (result as any).text?.slice(0, maxPreview) ?? undefined
      } catch (error) {
        console.warn(
          `[ProjectScanTool] DOCX 文本提取失败 (${path.basename(filePath)}):`,
          error instanceof Error ? error.message : String(error)
        )
        return undefined
      }
    }

    return undefined
  } catch {
    return undefined
  }
}
