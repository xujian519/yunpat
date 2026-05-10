/**
 * ProjectScanTool — 工作目录扫描工具
 *
 * 扫描用户指定的外部工作目录，识别文档类型（特别是 CNIPA 官文），
 * 推断案件类型和项目阶段，生成可注入 system prompt 的项目上下文。
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { z } from 'zod'
import { BaseMcpTool, type McpToolMetadata } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'
import {
  isBlockedPath,
  classifyByExtension,
  detectOfficialDoc,
  classifyNonOfficialDoc,
  inferCaseType,
  inferPhase,
  extractText,
  generateSystemPromptContext,
  DEFAULT_MAX_DEPTH,
  MAX_ALL_CONTENT_SIZE,
} from './ProjectScanHelpers.js'
import type {
  DocCategory,
  ScannedDocument,
  ProjectProfile,
  ProjectScanOutput,
} from './ProjectScanHelpers.js'

// ─── 输入 Schema ──────────────────────────────────────────────

const projectScanInputSchema = z.object({
  workingDirectory: z.string().describe('工作目录绝对路径'),
  maxFiles: z.number().min(1).max(200).default(50),
  maxContentPreview: z.number().min(100).max(5000).default(500),
  writeFile: z.boolean().default(true).describe('是否在工作目录生成 yunpat.md'),
})

type ProjectScanInput = z.infer<typeof projectScanInputSchema>

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
    let rawPath = input.workingDirectory
    if (rawPath === '~' || rawPath.startsWith('~/')) {
      rawPath = os.homedir() + rawPath.slice(1)
    }
    const directory = path.resolve(path.normalize(rawPath))

    if (isBlockedPath(directory)) {
      throw new Error(`访问被拒绝: 不允许扫描系统目录`)
    }

    if (!fs.existsSync(directory)) {
      throw new Error(`目录不存在: ${directory}`)
    }
    const stat = fs.statSync(directory)
    if (!stat.isDirectory()) {
      throw new Error(`路径不是目录: ${directory}`)
    }

    const files = this.enumerateFiles(directory, input.maxFiles, DEFAULT_MAX_DEPTH)

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
        const content = await extractText(filePath, ext, input.maxContentPreview)
        if (content) {
          doc.contentPreview = content
          if (allContentSize + content.length <= MAX_ALL_CONTENT_SIZE) {
            allContent.push(content)
            allContentSize += content.length
          }
        }

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
          doc.category = classifyNonOfficialDoc(file.name, content)
          otherCount++
        }
      } else if (bucket === 'image' || bucket === 'audio' || bucket === 'video') {
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

    const { phase, confidence: phaseConfidence } = inferPhase(documents)
    const caseType = inferCaseType(allContent.join(' '))

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

    const systemPromptContext = generateSystemPromptContext(directory, projectProfile, documents)

    if (input.writeFile) {
      try {
        const yunpatPath = path.join(directory, 'yunpat.md')
        if (fs.existsSync(yunpatPath)) {
          const existing = fs.readFileSync(yunpatPath, 'utf-8')
          if (existing.includes('<!-- user-edited -->')) {
            console.warn('[ProjectScanTool] yunpat.md 已被用户编辑，跳过覆盖')
          } else {
            const header = `# YunPat 项目上下文\n\n> 自动生成于 ${new Date().toISOString()}，用户可手动编辑补充。\n<!-- 在此标记下方添加内容即视为用户编辑，系统将不再覆盖 -->\n\n`
            fs.writeFileSync(yunpatPath, header + systemPromptContext, 'utf-8')
          }
        } else {
          const header = `# YunPat 项目上下文\n\n> 自动生成于 ${new Date().toISOString()}，用户可手动编辑补充。\n<!-- 在此标记下方添加内容即视为用户编辑，系统将不再覆盖 -->\n\n`
          fs.writeFileSync(yunpatPath, header + systemPromptContext, 'utf-8')
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
