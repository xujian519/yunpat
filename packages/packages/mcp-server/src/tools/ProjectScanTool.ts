/**
 * ProjectScanTool — 工作目录扫描工具
 *
 * 扫描用户指定的外部工作目录，识别文档类型（特别是 CNIPA 官文），
 * 推断案件类型和项目阶段，生成可注入 system prompt 的项目上下文。
 *
 * 处理管线：目录枚举 → 扩展名分类 → 文本提取 → 官文检测 → 非官文分类 → 阶段推断 → 上下文生成
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { z } from 'zod'
import { BaseMcpTool, type McpToolMetadata } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'

// ─── 输入 Schema ──────────────────────────────────────────────

const projectScanInputSchema = z.object({
  workingDirectory: z.string().describe('工作目录绝对路径'),
  maxFiles: z.number().min(1).max(200).default(50),
  maxContentPreview: z.number().min(100).max(5000).default(500),
  writeFile: z.boolean().default(true).describe('是否在工作目录生成 yunpat.md'),
})

type ProjectScanInput = z.infer<typeof projectScanInputSchema>

// ─── 输出类型 ─────────────────────────────────────────────────

/** 文档分类 */
type DocCategory =
  | 'official_doc'
  | 'technical_disclosure'
  | 'response_draft'
  | 'comparison_doc'
  | 'evidence'
  | 'correspondence'
  | 'media'
  | 'archive'
  | 'other'

/** 官文类型（复用 OfficialDocParserV2 的分类） */
type OfficialDocType =
  | 'review_opinion'
  | 'rejection_decision'
  | 'payment_notice'
  | 'grant_decision'
  | 'reexamination_decision'

/** 案件类型 */
type CaseType = 'invention' | 'utility_model' | 'design' | 'trademark' | 'unknown'

/** 项目阶段 */
type ProjectPhase =
  | 'filing'
  | 'examination'
  | 'response'
  | 'grant'
  | 'reexamination'
  | 'invalidation'
  | 'unknown'

interface ScannedDocument {
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

interface ProjectProfile {
  caseType: CaseType
  phase: ProjectPhase
  applicationNumbers: string[]
  inventionTitles: string[]
  confidence: number
}

interface ProjectScanOutput {
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
  // Linux
  '/etc',
  '/proc',
  '/sys',
  '/dev',
  '/boot',
  '/root',
  '/var/run',
  '/var/log',
  // macOS
  '/System',
  '/Library',
  '/Applications',
]

function isBlockedPath(resolvedPath: string): boolean {
  const normalized = resolvedPath.toLowerCase()
  return BLOCKED_PATH_PREFIXES.some((p) => normalized.startsWith(p))
}

const DEFAULT_MAX_DEPTH = 5
const MAX_ALL_CONTENT_SIZE = 50_000

// ─── 扩展名分类 ───────────────────────────────────────────────

type FileBucket = 'text_extractable' | 'image' | 'audio' | 'video' | 'archive' | 'other'

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

function classifyByExtension(ext: string): FileBucket {
  return EXTENSION_MAP[ext.toLowerCase()] ?? 'other'
}

// ─── CNIPA 官文检测 ───────────────────────────────────────────

// 文件名模式（高置信度）
const OFFICIAL_DOC_FILENAME_PATTERNS: Array<{
  pattern: RegExp
  docType: OfficialDocType
}> = [
  { pattern: /审查意见|审查通知书/, docType: 'review_opinion' },
  { pattern: /驳回决定/, docType: 'rejection_decision' },
  { pattern: /缴费.*通知书|费用.*通知书/, docType: 'payment_notice' },
  { pattern: /授予|授权.*通知/, docType: 'grant_decision' },
  { pattern: /复审.*决定|无效.*决定/, docType: 'reexamination_decision' },
]

// 内容模式（中置信度）
const OFFICIAL_DOC_CONTENT_PATTERNS: Array<{
  pattern: RegExp
  docType: OfficialDocType
}> = [
  { pattern: /审查意见.*通知书/, docType: 'review_opinion' },
  { pattern: /驳回决定/, docType: 'rejection_decision' },
  { pattern: /缴费.*通知书/, docType: 'payment_notice' },
  { pattern: /授予专利权/, docType: 'grant_decision' },
  { pattern: /复审.*决定|无效宣告请求审查决定/, docType: 'reexamination_decision' },
]

// CNIPA 结构标记（用于验证是否为官文）
const CNIPA_STRUCTURE_MARKERS = ['国家知识产权局', '通知书编号', '申请号：', '申请号:']

// 申请号正则
const APP_NUMBER_PATTERNS = [
  /申请号[：:]\s*(\d{10,13}[\.X]?\d?)/,
  /申请号[：:]\s*([A-Z]{2}\d{8,12})/,
  /(\d{4}\.\d{5,7})/,
]

// 发明名称正则
const TITLE_PATTERNS = [/发明名称[：:]\s*([^\n\r]+)/, /名称[：:]\s*([^\n\r]+)/]

function detectOfficialDoc(
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

  // Step 1: 文件名匹配（高置信度）
  for (const { pattern, docType: dt } of OFFICIAL_DOC_FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      docType = dt
      confidence = 0.9
      break
    }
  }

  // Step 2: 内容匹配（如果文件名未命中且内容可用）
  if (!docType && content) {
    for (const { pattern, docType: dt } of OFFICIAL_DOC_CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        docType = dt
        confidence = 0.75
        break
      }
    }
  }

  // Step 3: CNIPA 结构标记验证
  if (!docType && content) {
    const markerCount = CNIPA_STRUCTURE_MARKERS.filter((m) => content.includes(m)).length
    if (markerCount >= 2) {
      confidence = 0.5
      // 标记为官文但类型未知
    }
  }

  if (!docType && confidence === 0) {
    return { isOfficial: false, confidence: 0 }
  }

  // 提取申请号
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

  // 提取发明名称
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

// 技术交底书关键词（复用 DataSovereigntyChecker 的模式）
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

function classifyNonOfficialDoc(filename: string, content?: string): DocCategory {
  const text = `${filename} ${content ?? ''}`
  const lower = text.toLowerCase()

  // 技术交底书
  const techHits = TECHNICAL_DISCLOSURE_KEYWORDS.filter((kw) => lower.includes(kw)).length
  if (techHits >= 3) return 'technical_disclosure'

  // 答复草稿
  const responseHits = RESPONSE_DRAFT_KEYWORDS.filter((kw) => lower.includes(kw)).length
  if (responseHits >= 2) return 'response_draft'

  // 对比文件
  if (COMPARISON_DOC_KEYWORDS.some((kw) => lower.includes(kw))) return 'comparison_doc'

  // 证据
  if (EVIDENCE_KEYWORDS.some((kw) => lower.includes(kw))) return 'evidence'

  // 通信/回执
  if (CORRESPONDENCE_KEYWORDS.some((kw) => lower.includes(kw))) return 'correspondence'

  return 'other'
}

// ─── 阶段推断 ─────────────────────────────────────────────────

/** 官文类型 → 项目阶段映射 */
const OFFICIAL_DOC_PHASE_MAP: Record<OfficialDocType, ProjectPhase> = {
  review_opinion: 'response',
  rejection_decision: 'reexamination',
  payment_notice: 'grant',
  grant_decision: 'grant',
  reexamination_decision: 'invalidation',
}

function inferCaseType(allContent: string): CaseType {
  if (allContent.includes('实用新型')) return 'utility_model'
  if (allContent.includes('外观设计')) return 'design'
  if (['商标', '注册号', '商品分类', '商标图样'].some((kw) => allContent.includes(kw)))
    return 'trademark'
  return 'invention'
}

function inferPhase(documents: ScannedDocument[]): { phase: ProjectPhase; confidence: number } {
  const officialDocs = documents.filter((d) => d.category === 'official_doc' && d.officialDocType)

  if (officialDocs.length > 0) {
    // 按 mtime 排序，取最新文件的官文类型推断阶段
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

  // 无官文，从非官文文档推断
  const categories = new Set(documents.map((d) => d.category))

  if (categories.has('technical_disclosure')) return { phase: 'filing', confidence: 0.7 }
  if (categories.has('comparison_doc')) return { phase: 'examination', confidence: 0.6 }
  if (categories.has('response_draft')) return { phase: 'response', confidence: 0.6 }

  return { phase: 'unknown', confidence: 0.2 }
}

// ─── systemPromptContext 生成 ─────────────────────────────────

function generateSystemPromptContext(
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

function generateSuggestions(profile: ProjectProfile, documents: ScannedDocument[]): string[] {
  const suggestions: string[] = []

  switch (profile.phase) {
    case 'filing':
      suggestions.push('检索相关先有技术')
      suggestions.push('分析技术方案的新颖性和创造性')
      suggestions.push('准备专利申请文件')
      break
    case 'examination':
      suggestions.push('分析对比文件与本申请的区别')
      suggestions.push('评估授权前景')
      break
    case 'response':
      suggestions.push('分析审查意见要点')
      suggestions.push('准备答复意见陈述')
      suggestions.push('考虑是否需要修改权利要求')
      break
    case 'grant':
      suggestions.push('办理登记手续')
      suggestions.push('缴纳相关费用')
      break
    case 'reexamination':
      suggestions.push('分析驳回理由')
      suggestions.push('准备复审请求')
      suggestions.push('检索支持复审的证据')
      break
    case 'invalidation':
      suggestions.push('分析无效宣告理由')
      suggestions.push('准备无效答辩或无效请求')
      break
  }

  // 根据实际文档补充建议
  if (documents.some((d) => d.category === 'comparison_doc')) {
    suggestions.push('深入分析对比文件')
  }

  return suggestions
}

// ─── 文本提取 ─────────────────────────────────────────────────

async function extractText(
  filePath: string,
  ext: string,
  maxPreview: number
): Promise<string | undefined> {
  try {
    if (ext === '.txt' || ext === '.md') {
      const buf = fs.readFileSync(filePath, { encoding: 'utf-8' })
      return buf.slice(0, maxPreview)
    }

    // PDF 和 DOCX 通过 document-tools 提取
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

// ─── 主工具类 ─────────────────────────────────────────────────

export class ProjectScanTool extends BaseMcpTool<ProjectScanInput, ProjectScanOutput> {
  readonly metadata = {
    name: 'project_scan',
    description:
      '扫描工作目录，识别文档类型（特别是CNIPA官文），推断案件类型和项目阶段，生成项目上下文',
    version: '1.0.0',
    inputSchema: projectScanInputSchema,
  } satisfies McpToolMetadata

  protected async executeInternal(
    input: ProjectScanInput,
    _context: McpToolContext
  ): Promise<ProjectScanOutput> {
    // 展开 ~ 为用户家目录
    let rawPath = input.workingDirectory
    if (rawPath === '~' || rawPath.startsWith('~/')) {
      rawPath = os.homedir() + rawPath.slice(1)
    }
    const directory = path.resolve(path.normalize(rawPath))

    // 路径安全：拒绝敏感系统目录
    if (isBlockedPath(directory)) {
      throw new Error(`访问被拒绝: 不允许扫描系统目录`)
    }

    // 验证目录存在
    if (!fs.existsSync(directory)) {
      throw new Error(`目录不存在: ${directory}`)
    }
    const stat = fs.statSync(directory)
    if (!stat.isDirectory()) {
      throw new Error(`路径不是目录: ${directory}`)
    }

    // Step 1: 目录枚举
    const files = this.enumerateFiles(directory, input.maxFiles, DEFAULT_MAX_DEPTH)

    // Step 2-5: 分类 + 文本提取 + 官文检测 + 非官文分类
    const documents: ScannedDocument[] = []
    let officialCount = 0
    let otherCount = 0
    let mediaCount = 0
    let archiveCount = 0
    const allContent: string[] = []
    let allContentSize = 0

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase()
      const bucket = classifyByExtension(ext)
      const filePath = path.join(file.dir, file.name)
      const fileSize = fs.statSync(filePath).size

      const doc: ScannedDocument = {
        filename: file.name,
        filePath,
        fileSize,
        category: 'other',
      }

      if (bucket === 'text_extractable') {
        // Step 3: 文本提取
        const content = await extractText(filePath, ext, input.maxContentPreview)
        if (content) {
          doc.contentPreview = content
          if (allContentSize + content.length <= MAX_ALL_CONTENT_SIZE) {
            allContent.push(content)
            allContentSize += content.length
          }
        }

        // Step 4: 官文检测
        const officialResult = detectOfficialDoc(file.name, content)
        if (officialResult.isOfficial) {
          doc.category = 'official_doc'
          doc.officialDocType = officialResult.docType
          doc.extractedFields = {
            applicationNumber: officialResult.applicationNumber,
            inventionTitle: officialResult.inventionTitle,
          }
          officialCount++
        } else {
          // Step 5: 非官文分类
          doc.category = classifyNonOfficialDoc(file.name, content)
          otherCount++
        }
      } else if (bucket === 'image' || bucket === 'audio' || bucket === 'video') {
        // 图片也尝试通过文件名检测官文
        const nameOnlyResult = detectOfficialDoc(file.name)
        if (nameOnlyResult.isOfficial) {
          doc.category = 'official_doc'
          doc.officialDocType = nameOnlyResult.docType
          officialCount++
        } else {
          doc.category = 'media'
          mediaCount++
        }
      } else if (bucket === 'archive') {
        doc.category = 'archive'
        archiveCount++
      } else {
        // other 类型也检查文件名是否暗示官文
        const nameOnlyResult = detectOfficialDoc(file.name)
        if (nameOnlyResult.isOfficial) {
          doc.category = 'official_doc'
          doc.officialDocType = nameOnlyResult.docType
          officialCount++
        } else {
          doc.category = classifyNonOfficialDoc(file.name)
          otherCount++
        }
      }

      documents.push(doc)
    }

    // Step 6: 阶段推断
    const { phase, confidence: phaseConfidence } = inferPhase(documents)
    const caseType = inferCaseType(allContent.join(' '))

    // 收集申请号和发明名称（去重）
    const applicationNumbers = [
      ...new Set(
        documents.map((d) => d.extractedFields?.applicationNumber).filter((n): n is string => !!n)
      ),
    ]
    const inventionTitles = [
      ...new Set(
        documents.map((d) => d.extractedFields?.inventionTitle).filter((t): t is string => !!t)
      ),
    ]

    const projectProfile: ProjectProfile = {
      caseType,
      phase,
      applicationNumbers,
      inventionTitles,
      confidence: phaseConfidence,
    }

    // Step 7: 生成 systemPromptContext
    const systemPromptContext = generateSystemPromptContext(directory, projectProfile, documents)

    // Step 8: 写入 yunpat.md
    let yunpatWritten = false
    if (input.writeFile) {
      try {
        const yunpatPath = path.join(directory, 'yunpat.md')
        // 检查文件是否已存在且包含用户编辑标记
        if (fs.existsSync(yunpatPath)) {
          const existing = fs.readFileSync(yunpatPath, 'utf-8')
          if (existing.includes('<!-- user-edited -->')) {
            // 用户手动编辑过，不覆盖
            console.warn('[ProjectScanTool] yunpat.md 已被用户编辑，跳过覆盖')
          } else {
            const header = `# YunPat 项目上下文\n\n> 自动生成于 ${new Date().toISOString()}，用户可手动编辑补充。\n<!-- 在此标记下方添加内容即视为用户编辑，系统将不再覆盖 -->\n\n`
            fs.writeFileSync(yunpatPath, header + systemPromptContext, 'utf-8')
            yunpatWritten = true
          }
        } else {
          const header = `# YunPat 项目上下文\n\n> 自动生成于 ${new Date().toISOString()}，用户可手动编辑补充。\n<!-- 在此标记下方添加内容即视为用户编辑，系统将不再覆盖 -->\n\n`
          fs.writeFileSync(yunpatPath, header + systemPromptContext, 'utf-8')
          yunpatWritten = true
        }
      } catch (error) {
        console.warn(
          '[ProjectScanTool] 写入 yunpat.md 失败:',
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    return {
      directory,
      summary: {
        totalFiles: files.length,
        processedFiles: documents.filter((d) => d.contentPreview).length,
        officialDocs: officialCount,
        otherDocs: otherCount,
        mediaFiles: mediaCount,
        archiveFiles: archiveCount,
      },
      documents,
      projectProfile,
      systemPromptContext,
    }
  }

  /** 递归枚举目录中的文件，跳过隐藏文件、目录和符号链接 */
  private enumerateFiles(
    rootDir: string,
    maxFiles: number,
    maxDepth: number
  ): Array<{ dir: string; name: string }> {
    const result: Array<{ dir: string; name: string }> = []
    const rootDepth = rootDir.split(path.sep).length

    const walk = (dir: string) => {
      const currentDepth = dir.split(path.sep).length - rootDepth
      if (currentDepth > maxDepth) return
      if (result.length >= maxFiles) return
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        if (result.length >= maxFiles) break
        if (entry.name.startsWith('.')) continue
        // 跳过符号链接防止循环遍历
        if (entry.isSymbolicLink()) continue

        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile()) {
          result.push({ dir, name: entry.name })
        }
      }
    }

    walk(rootDir)
    return result
  }
}
