/**
 * 官文解析工具 V2（基于项目现有工具）
 *
 * 不依赖外部 GLM-OCR 服务，使用项目现有的 PDF 解析和 OCR 工具
 */

import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'
import { PdfExtractTextTool } from './PdfTools.js'
import { ImageOcrTool } from './OcrTools.js'

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
  /** 原始文本 */
  rawText: string
  /** 提取的结构化字段 */
  fields: OfficialDocFields
  /** 官文类型（自动检测） */
  docType: string
  /** 元数据 */
  metadata: {
    filename: string
    totalPages?: number
    parseTime: number
    extractionMethod: string
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
 * 官文解析工具 V2
 *
 * 使用项目现有的 PDF 解析和 OCR 工具
 */
export class OfficialDocParserToolV2 extends EnhancedBaseTool<
  {
    filePath: string
    docType?: OfficialDocType
    useOcr?: boolean
  },
  OfficialDocParseResult
> {
  readonly metadata = {
    name: 'official_doc_parse_v2',
    description: '解析专利官文（审查意见通知书、驳回决定等），提取结构化字段（不依赖外部OCR服务）',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('官文文件路径（PDF/图片）'),
      docType: z.nativeEnum(OfficialDocType).optional().describe('官文类型（自动检测）'),
      useOcr: z.boolean().optional().default(false).describe('是否使用OCR（扫描版PDF需要启用）'),
    }),
    outputSchema: z.object({
      rawText: z.string().describe('解析的原始文本'),
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
      docType: z.string().describe('官文类型'),
      metadata: z.object({
        filename: z.string(),
        totalPages: z.number().optional(),
        parseTime: z.number(),
        extractionMethod: z.string(),
      }),
    }),
    permissions: ['fs:read'],
    version: '2.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: {
      filePath: string
      docType?: OfficialDocType
      useOcr?: boolean
    },
    context: ToolContext
  ): Promise<OfficialDocParseResult> {
    const startTime = Date.now()

    // 1. 验证文件存在
    if (!fs.existsSync(input.filePath)) {
      throw new Error(`文件不存在: ${input.filePath}`)
    }

    // 2. 提取文本内容
    let text = ''
    let totalPages = 0

    if (input.filePath.toLowerCase().endsWith('.pdf')) {
      // 使用 PDF 解析工具
      const pdfTool = new PdfExtractTextTool()
      const pdfResult = await pdfTool.execute(
        { filePath: input.filePath, includeMetadata: true },
        context
      )
      text = pdfResult.text
      totalPages = pdfResult.metadata?.pages || 0
    } else if (input.filePath.match(/\.(png|jpg|jpeg|bmp|tiff)$/i)) {
      // 使用 OCR 工具
      if (input.useOcr) {
        const ocrTool = new ImageOcrTool()
        const ocrResult = await ocrTool.execute(
          { imagePath: input.filePath, languages: ['chi_sim', 'eng'] },
          context
        )
        text = ocrResult.text
      } else {
        throw new Error('图片文件需要启用OCR')
      }
    } else {
      throw new Error('不支持的文件格式')
    }

    // 3. 检测官文类型
    const detectedDocType = input.docType || this.detectDocType(text, input.filePath)

    // 4. 提取结构化字段
    const fields = this.extractFields(text, detectedDocType)

    // 5. 返回结果
    return {
      rawText: text,
      fields,
      docType: detectedDocType,
      metadata: {
        filename: path.basename(input.filePath),
        totalPages,
        parseTime: Date.now() - startTime,
        extractionMethod: input.useOcr ? 'OCR' : 'PDF解析',
      },
    }
  }

  /**
   * 检测官文类型
   */
  private detectDocType(text: string, filePath: string): string {
    // 基于文件名检测
    const filename = path.basename(filePath).toLowerCase()
    if (filename.includes('审查意见') || filename.includes('审查通知书')) {
      return OfficialDocType.REVIEW_OPINION
    } else if (filename.includes('驳回决定')) {
      return OfficialDocType.REJECTION_DECISION
    } else if (filename.includes('缴费') && filename.includes('通知书')) {
      return OfficialDocType.PAYMENT_NOTICE
    } else if (filename.includes('授予') || filename.includes('授权')) {
      return OfficialDocType.GRANT_DECISION
    } else if (filename.includes('复审') || filename.includes('无效')) {
      return OfficialDocType.REEXAMINATION_DECISION
    }

    // 基于文本内容检测
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

  /**
   * 提取结构化字段（基于正则表达式）
   */
  private extractFields(text: string, docType: string): OfficialDocFields {
    const fields: OfficialDocFields = {}

    // 提取申请号（通用）
    const appNumberPatterns = [
      /申请号[：:]\s*([0-9]{10,13}[\.X]?[0-9]?)/i,
      /申请号[：:]\s*([A-Z]{2}[0-9]{8,12})/i,
      /([0-9]{4}\.[0-9]{5,7})/i,
    ]
    for (const pattern of appNumberPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        fields.applicationNumber = match[1].trim()
        break
      }
    }

    // 提取发明名称（通用）
    const titlePatterns = [/发明名称[：:]\s*([^\n\r]+)/i, /名称[：:]\s*([^\n\r]+)/i]
    for (const pattern of titlePatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        fields.inventionTitle = match[1].trim()
        break
      }
    }

    // 根据文档类型提取特定字段
    switch (docType) {
      case OfficialDocType.REVIEW_OPINION:
        this.extractReviewOpinionFields(text, fields)
        break
      case OfficialDocType.REJECTION_DECISION:
        this.extractRejectionFields(text, fields)
        break
      case OfficialDocType.PAYMENT_NOTICE:
        this.extractPaymentFields(text, fields)
        break
      case OfficialDocType.GRANT_DECISION:
        this.extractGrantFields(text, fields)
        break
      case OfficialDocType.REEXAMINATION_DECISION:
        this.extractReexaminationFields(text, fields)
        break
    }

    return fields
  }

  /**
   * 提取审查意见通知书字段
   */
  private extractReviewOpinionFields(text: string, fields: OfficialDocFields): void {
    // 提取审查意见摘要
    const summaryMatch = text.match(/审查意见[：:]\s*([^\n\r]+(?:\n[^\n\r]+){0,5})/i)
    if (summaryMatch && summaryMatch[1]) {
      fields.reviewSummary = summaryMatch[1].trim().substring(0, 200)
    }

    // 提取答复期限
    const deadlineMatch = text.match(/答复期限[：:]\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/i)
    if (deadlineMatch && deadlineMatch[1]) {
      fields.responseDeadline = deadlineMatch[1]
        .replace('年', '-')
        .replace('月', '-')
        .replace('日', '')
    }

    // 提取审查员
    const examinerMatch = text.match(/审查员[：:]\s*([^\n\r]+)/i)
    if (examinerMatch && examinerMatch[1]) {
      fields.examiner = examinerMatch[1].trim()
    }

    // 提取引用文献
    const refPatterns = [/引用文献[：:]\s*([^\n\r]+)/i, /对比文件[：:]\s*([^\n\r]+)/i]
    for (const pattern of refPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const refs = match[1]
          .split(/[,;，；]/)
          .map((s) => s.trim())
          .filter((s) => s)
        fields.referenceDocuments = refs
        break
      }
    }
  }

  /**
   * 提取驳回决定字段
   */
  private extractRejectionFields(text: string, fields: OfficialDocFields): void {
    // 提取驳回理由
    const reasonMatch = text.match(/驳回理由[：:]\s*([^\n\r]+(?:\n[^\n\r]+){0,10})/i)
    if (reasonMatch && reasonMatch[1]) {
      fields.rejectionReason = reasonMatch[1].trim().substring(0, 500)
    }

    // 提取法律条款
    const articleMatch = text.match(/根据.*?[专利法|实施细则].*?第([0-9]+条)/i)
    if (articleMatch && articleMatch[1]) {
      fields.legalArticles = [`专利法第${articleMatch[1]}条`]
    }

    // 提取决定日期
    const dateMatch = text.match(/决定日[期][：:]\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/i)
    if (dateMatch && dateMatch[1]) {
      fields.decisionDate = dateMatch[1].replace('年', '-').replace('月', '-').replace('日', '')
    }
  }

  /**
   * 提取缴费通知书字段
   */
  private extractPaymentFields(text: string, fields: OfficialDocFields): void {
    // 提取费用类型
    const feeTypeMatch = text.match(/费用[类型][：:]\s*([^\n\r]+)/i)
    if (feeTypeMatch && feeTypeMatch[1]) {
      fields.feeType = feeTypeMatch[1].trim()
    }

    // 提取缴费金额
    const amountMatch = text.match(/金额[：:]\s*([0-9,]+(?:\.[0-9]{2})?)/i)
    if (amountMatch && amountMatch[1]) {
      fields.feeAmount = parseFloat(amountMatch[1].replace(/,/g, ''))
    }

    // 提取缴费截止日期
    const deadlineMatch = text.match(/截止日期[：:]\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/i)
    if (deadlineMatch && deadlineMatch[1]) {
      fields.paymentDeadline = deadlineMatch[1]
        .replace('年', '-')
        .replace('月', '-')
        .replace('日', '')
    }
  }

  /**
   * 提取授予决定字段
   */
  private extractGrantFields(text: string, fields: OfficialDocFields): void {
    // 提取决定日期
    const dateMatch = text.match(/决定日[期][：:]\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/i)
    if (dateMatch && dateMatch[1]) {
      fields.decisionDate = dateMatch[1].replace('年', '-').replace('月', '-').replace('日', '')
    }
  }

  /**
   * 提取复审无效决定字段
   */
  private extractReexaminationFields(text: string, fields: OfficialDocFields): void {
    // 提取决定类型
    if (text.includes('复审')) {
      fields.decisionDate = text.includes('维持') ? '维持驳回决定' : '撤销驳回决定'
    } else if (text.includes('无效')) {
      fields.decisionDate = text.includes('宣告无效') ? '宣告专利权无效' : '维持专利权有效'
    }

    // 提取决定日期
    const dateMatch = text.match(/决定日[期][：:]\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/i)
    if (dateMatch && dateMatch[1]) {
      fields.decisionDate = dateMatch[1].replace('年', '-').replace('月', '-').replace('日', '')
    }
  }
}
