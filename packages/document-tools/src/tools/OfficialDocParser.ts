/**
 * 官文解析工具
 *
 * 基于 Docling + GLM-OCR 的专利官文解析方案
 * 支持：审查意见通知书、驳回决定、缴费通知书等
 */

import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import { spawn } from 'child_process'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'

/**
 * 官文字段提取结果
 */
export interface OfficialDocFields {
  /** 申请号 */
  applicationNumber?: string
  /** 发明名称 */
  inventionTitle?: string
  /** 审查意见摘要 */
  reviewSummary?: string
  /** 答复期限 */
  responseDeadline?: string
  /** 审查员 */
  examiner?: string
  /** 引用文献 */
  referenceDocuments?: string[]
  /** 驳回理由 */
  rejectionReason?: string
  /** 法律条款 */
  legalArticles?: string[]
  /** 决定日期 */
  decisionDate?: string
  /** 费用类型 */
  feeType?: string
  /** 缴费金额 */
  feeAmount?: number
  /** 缴费截止日期 */
  paymentDeadline?: string
}

/**
 * 官文解析结果
 */
export interface OfficialDocParseResult {
  /** 原始文本（Docling解析） */
  rawText: string
  /** 提取的结构化字段 */
  fields: OfficialDocFields
  /** Markdown格式内容 */
  markdown: string
  /** 元数据 */
  metadata: {
    filename: string
    totalPages?: number
    parseTime: number
    doclingVersion?: string
    ocrModel?: string
  }
}

/**
 * 官文类型
 */
export enum OfficialDocType {
  /** 审查意见通知书 */
  REVIEW_OPINION = 'review_opinion',
  /** 驳回决定 */
  REJECTION_DECISION = 'rejection_decision',
  /** 缴费通知书 */
  PAYMENT_NOTICE = 'payment_notice',
  /** 授予决定 */
  GRANT_DECISION = 'grant_decision',
  /** 复审无效决定 */
  REEXAMINATION_DECISION = 'reexamination_decision',
}

/**
 * 官文解析工具
 *
 * 使用 Docling 进行 PDF/图片解析，GLM-OCR 进行字段提取
 */
export class OfficialDocParserTool extends EnhancedBaseTool<
  {
    filePath: string
    docType?: OfficialDocType
    useOcr?: boolean
    ocrEndpoint?: string
  },
  OfficialDocParseResult
> {
  readonly metadata = {
    name: 'official_doc_parse',
    description: '解析专利官文（审查意见通知书、驳回决定等），提取结构化字段',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('官文文件路径（PDF/图片）'),
      docType: z.nativeEnum(OfficialDocType).optional().describe('官文类型（自动检测）'),
      useOcr: z.boolean().optional().default(true).describe('是否使用OCR提取字段'),
      ocrEndpoint: z
        .string()
        .optional()
        .default('http://localhost:8009')
        .describe('GLM-OCR服务端点'),
    }),
    outputSchema: z.object({
      rawText: z.string().describe('Docling解析的原始文本'),
      fields: z.object({
        applicationNumber: z.string().optional(),
        inventionTitle: z.string().optional(),
        reviewSummary: z.string().optional(),
        responseDeadline: z.string().optional(),
        examiner: z.string().optional(),
        referenceDocuments: z.array(z.string()).optional(),
        rejectionReason: z.string().optional(),
        legalArticles: z.array(z.string()).optional(),
        decisionDate: z.string().optional(),
        feeType: z.string().optional(),
        feeAmount: z.number().optional(),
        paymentDeadline: z.string().optional(),
      }),
      markdown: z.string().describe('Markdown格式内容'),
      metadata: z.object({
        filename: z.string(),
        totalPages: z.number().optional(),
        parseTime: z.number(),
        doclingVersion: z.string().optional(),
        ocrModel: z.string().optional(),
      }),
    }),
    permissions: ['fs:read', 'exec:python'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: {
      filePath: string
      docType?: OfficialDocType
      useOcr?: boolean
      ocrEndpoint?: string
    },
    _context: ToolContext
  ): Promise<OfficialDocParseResult> {
    const startTime = Date.now()

    // 1. 验证文件存在
    if (!fs.existsSync(input.filePath)) {
      throw new Error(`文件不存在: ${input.filePath}`)
    }

    // 2. 调用 Python 脚本进行 Docling 解析
    const doclingResult = await this.runDoclingParse(input.filePath)

    // 3. 如果启用 OCR，调用 GLM-OCR 提取字段
    let fields: OfficialDocFields = {}
    if (input.useOcr) {
      fields = await this.runGlmOcr(
        input.filePath,
        input.docType || this.detectDocType(doclingResult.text),
        input.ocrEndpoint || 'http://localhost:8009'
      )
    }

    // 4. 返回结果
    return {
      rawText: doclingResult.text,
      fields,
      markdown: doclingResult.markdown,
      metadata: {
        filename: path.basename(input.filePath),
        totalPages: doclingResult.totalPages,
        parseTime: Date.now() - startTime,
        doclingVersion: doclingResult.version,
        ocrModel: input.useOcr ? 'GLM-OCR-4bit' : undefined,
      },
    }
  }

  /**
   * 调用 Docling 进行 PDF 解析
   */
  private async runDoclingParse(filePath: string): Promise<{
    text: string
    markdown: string
    totalPages?: number
    version?: string
  }> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '../../../python-tools/official_doc_parser.py')

      const process = spawn('python3', [pythonScript, 'parse', filePath])

      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Docling解析失败: ${stderr}`))
          return
        }

        try {
          const result = JSON.parse(stdout)
          resolve(result)
        } catch (error) {
          reject(new Error(`解析Docling输出失败: ${error}`))
        }
      })

      process.on('error', (error) => {
        reject(new Error(`启动Python进程失败: ${error.message}`))
      })
    })
  }

  /**
   * 调用 GLM-OCR 提取字段
   */
  private async runGlmOcr(
    filePath: string,
    docType: OfficialDocType,
    ocrEndpoint: string
  ): Promise<OfficialDocFields> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '../../../python-tools/official_doc_parser.py')

      const process = spawn('python3', [
        pythonScript,
        'extract',
        filePath,
        '--doc-type',
        docType,
        '--ocr-endpoint',
        ocrEndpoint,
      ])

      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`GLM-OCR提取失败: ${stderr}`))
          return
        }

        try {
          const fields = JSON.parse(stdout)
          resolve(fields)
        } catch (error) {
          reject(new Error(`解析GLM-OCR输出失败: ${error}`))
        }
      })

      process.on('error', (error) => {
        reject(new Error(`启动Python进程失败: ${error.message}`))
      })
    })
  }

  /**
   * 根据文本内容自动检测官文类型
   */
  private detectDocType(text: string): OfficialDocType {
    if (text.includes('审查意见') && text.includes('通知书')) {
      return OfficialDocType.REVIEW_OPINION
    } else if (text.includes('驳回决定')) {
      return OfficialDocType.REJECTION_DECISION
    } else if (text.includes('缴费') && text.includes('通知书')) {
      return OfficialDocType.PAYMENT_NOTICE
    } else if (text.includes('授予专利权')) {
      return OfficialDocType.GRANT_DECISION
    } else if (text.includes('复审') || text.includes('无效')) {
      return OfficialDocType.REEXAMINATION_DECISION
    }
    return OfficialDocType.REVIEW_OPINION // 默认
  }
}

/**
 * 官文字段提取提示词模板
 */
export const OFFICIAL_DOC_PROMPTS = {
  [OfficialDocType.REVIEW_OPINION]: `请从官文中提取以下信息，以JSON格式返回：
{
  "applicationNumber": "申请号",
  "inventionTitle": "发明名称",
  "reviewSummary": "审查意见摘要（100字以内）",
  "responseDeadline": "答复期限（YYYY-MM-DD格式）",
  "examiner": "审查员",
  "referenceDocuments": ["引用文献1", "引用文献2"]
}`,

  [OfficialDocType.REJECTION_DECISION]: `请从驳回决定中提取以下信息，以JSON格式返回：
{
  "applicationNumber": "申请号",
  "inventionTitle": "发明名称",
  "rejectionReason": "驳回理由（200字以内）",
  "legalArticles": ["法条1", "法条2"],
  "decisionDate": "决定日期（YYYY-MM-DD格式）"
}`,

  [OfficialDocType.PAYMENT_NOTICE]: `请从缴费通知书中提取以下信息，以JSON格式返回：
{
  "applicationNumber": "申请号",
  "feeType": "费用类型（如：年费、申请费）",
  "feeAmount": "缴费金额（数字）",
  "paymentDeadline": "缴费截止日期（YYYY-MM-DD格式）"
}`,

  [OfficialDocType.GRANT_DECISION]: `请从授予决定中提取以下信息，以JSON格式返回：
{
  "applicationNumber": "申请号",
  "inventionTitle": "发明名称",
  "decisionDate": "决定日期（YYYY-MM-DD格式）",
  "grantNumber": "授权专利号"
}`,

  [OfficialDocType.REEXAMINATION_DECISION]: `请从复审无效决定中提取以下信息，以JSON格式返回：
{
  "applicationNumber": "申请号或专利号",
  "inventionTitle": "发明名称",
  "decisionType": "决定类型（复审/无效）",
  "decisionResult": "决定结果（维持/撤销/宣告无效）",
  "legalArticles": ["法条1", "法条2"],
  "decisionDate": "决定日期（YYYY-MM-DD格式）"
}`,
}
