/**
 * 专利格式转换智能体
 *
 * 专门用于专利文档格式转换，包括：
 * 1. Markdown → 结构化内容转换
 * 2. 结构化内容 → DOCX转换
 * 3. 专利局格式规范验证
 *
 * 特性：
 * - 复用PatentDocxGenerator工具
 * - 支持多种专利局格式（CNIPA、USPTO、EPO）
 * - 自动格式检查
 * - TDD方式（测试驱动开发）
 */

import {
  Agent,
  type EventBus,
  type MemoryStore,
  type ToolRegistry,
  type LLMAdapter,
  type ExecutionContext,
} from '@yunpat/core'
import {
  PatentApplicationGeneratorTool,
  PatentClaimsGeneratorTool,
  type PatentApplicationData,
} from '@yunpat/document-tools'

/**
 * 格式转换输入
 */
export interface FormatConverterInput {
  /** 输入格式 */
  inputFormat: 'markdown' | 'structured'

  /** 输出格式 */
  outputFormat: 'docx'

  /** 专利局格式 */
  patentOfficeFormat: 'CNIPA' | 'USPTO' | 'EPO'

  /** 内容（Markdown或结构化） */
  content: {
    /** Markdown文本（inputFormat='markdown'时使用） */
    markdown?: string

    /** 结构化内容（inputFormat='structured'时使用） */
    structured?: {
      /** 发明名称 */
      inventionTitle: string

      /** 技术领域 */
      technicalField: string

      /** 背景技术 */
      backgroundArt: string

      /** 发明内容 */
      inventionContent: string

      /** 附图说明 */
      drawingsDescription?: string

      /** 具体实施方式 */
      embodiment?: string

      /** 权利要求书 */
      claims: Array<{
        type: 'independent' | 'dependent'
        number: number
        content: string
        dependsOn?: number
      }>

      /** 摘要 */
      abstract: string
    }
  }

  /** 输出路径 */
  outputPath: string

  /** 元数据 */
  metadata?: {
    applicationNumber?: string
    applicant?: string
    inventor?: string
  }

  /** 是否自动格式检查 */
  autoFormatCheck?: boolean
}

/**
 * 格式转换输出
 */
export interface FormatConverterOutput {
  /** 转换是否成功 */
  success: boolean

  /** 输出文件路径 */
  outputPath: string

  /** 文件格式 */
  outputFormat: string

  /** 文件大小（字节） */
  fileSize: number

  /** 页数估算 */
  pages: number

  /** 格式检查报告 */
  formatCheckReport?: {
    passed: boolean
    errors: string[]
    warnings: string[]
  }

  /** 转换耗时（毫秒） */
  conversionTimeMs: number
}

/**
 * 格式转换计划
 */
interface FormatConverterPlan {
  input: FormatConverterInput
  parsedContent?: PatentApplicationData
  markdownSections?: Record<string, string>
}

/**
 * 专利格式转换智能体
 */
export class PatentFormatConverterAgent extends Agent<FormatConverterInput, FormatConverterOutput> {
  private applicationGeneratorTool: PatentApplicationGeneratorTool
  private claimsGeneratorTool: PatentClaimsGeneratorTool

  constructor(config: {
    name: string
    description: string
    eventBus: EventBus
    memory: MemoryStore
    tools: ToolRegistry
    llm: LLMAdapter
  }) {
    super(config)
    this.applicationGeneratorTool = new PatentApplicationGeneratorTool()
    this.claimsGeneratorTool = new PatentClaimsGeneratorTool()
  }

  /**
   * 规划阶段：解析输入内容
   */
  protected async plan(
    input: FormatConverterInput,
    _context: ExecutionContext
  ): Promise<FormatConverterPlan> {
    console.log('\n📝 [格式转换] 步骤1: 规划阶段')
    console.log(`   输入格式: ${input.inputFormat}`)
    console.log(`   输出格式: ${input.outputFormat}`)
    console.log(`   专利局格式: ${input.patentOfficeFormat}`)

    const plan: FormatConverterPlan = { input }

    if (input.inputFormat === 'markdown' && input.content.markdown) {
      // 解析Markdown为结构化内容
      plan.markdownSections = this.parseMarkdown(input.content.markdown)
      console.log(`   解析到 ${Object.keys(plan.markdownSections).length} 个章节`)
    } else if (input.inputFormat === 'structured' && input.content.structured) {
      // 使用结构化内容
      plan.parsedContent = this.convertToPatentApplicationData(input)
      console.log(`   使用结构化内容`)
    }

    return plan
  }

  /**
   * 执行阶段：生成DOCX文件
   */
  protected async act(
    plan: FormatConverterPlan,
    _context: ExecutionContext
  ): Promise<FormatConverterOutput> {
    console.log('\n🔄 [格式转换] 步骤2: 执行阶段')

    const startTime = Date.now()
    const input = plan.input

    try {
      // 如果是Markdown输入，先转换为结构化内容
      let patentData: PatentApplicationData

      if (plan.parsedContent) {
        patentData = plan.parsedContent
      } else if (plan.markdownSections) {
        patentData = this.convertMarkdownToStructured(plan.markdownSections, input)
      } else {
        throw new Error('无效的输入内容')
      }

      // 生成说明书DOCX
      console.log('\n📄 [格式转换] 正在生成说明书DOCX...')
      const specResult = await this.applicationGeneratorTool.execute(
        {
          data: patentData,
          outputPath: input.outputPath.replace('.docx', '_specification.docx'),
          template: this.mapPatentOfficeToTemplate(input.patentOfficeFormat),
        },
        {} as any
      )

      // 生成权利要求书DOCX
      console.log('\n📋 [格式转换] 正在生成权利要求书DOCX...')
      const claimsResult = await this.claimsGeneratorTool.execute(
        {
          claims: patentData.claims,
          outputPath: input.outputPath.replace('.docx', '_claims.docx'),
        },
        {} as any
      )

      const conversionTimeMs = Date.now() - startTime

      // 格式检查（如果启用）
      let formatCheckReport
      if (input.autoFormatCheck) {
        formatCheckReport = this.performFormatCheck(patentData, input.patentOfficeFormat)
      }

      console.log(`\n✅ [格式转换] 完成 (耗时: ${conversionTimeMs}ms)`)

      // 获取文件大小
      const fs = await import('fs')
      const fileSize = fs.existsSync(specResult.outputPath)
        ? fs.statSync(specResult.outputPath).size
        : 0

      return {
        success: true,
        outputPath: specResult.outputPath,
        outputFormat: input.outputFormat,
        fileSize,
        pages: specResult.pages + claimsResult.claimsCount,
        formatCheckReport,
        conversionTimeMs,
      }
    } catch (error) {
      console.error(
        `\n❌ [格式转换] 失败: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * 解析Markdown为章节
   */
  private parseMarkdown(markdown: string): Record<string, string> {
    const sections: Record<string, string> = {}
    const lines = markdown.split('\n')
    let currentSection = ''
    let currentContent: string[] = []

    for (const line of lines) {
      // 检测标题（# ## ###）
      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
      if (headingMatch) {
        // 保存上一个章节
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim()
        }

        // 开始新章节
        currentSection = headingMatch[2].trim()
        currentContent = []
      } else if (currentSection) {
        currentContent.push(line)
      }
    }

    // 保存最后一个章节
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim()
    }

    return sections
  }

  /**
   * 转换Markdown章节为结构化内容
   */
  private convertMarkdownToStructured(
    sections: Record<string, string>,
    input: FormatConverterInput
  ): PatentApplicationData {
    return {
      inventionTitle: sections['发明名称'] || input.metadata?.applicationNumber || '未知',
      technicalField: sections['技术领域'] || '',
      backgroundArt: sections['背景技术'] || '',
      inventionContent: sections['发明内容'] || '',
      drawingsDescription: sections['附图说明'],
      embodiment: sections['具体实施方式'],
      claims: this.parseClaims(sections['权利要求书'] || ''),
      abstract: sections['摘要'] || '',
      applicant: input.metadata?.applicant
        ? {
            name: input.metadata.applicant,
            address: '未知地址',
          }
        : undefined,
    }
  }

  /**
   * 解析权利要求书
   */
  private parseClaims(claimsText: string): Array<{
    type: 'independent' | 'dependent'
    number: number
    content: string
    dependsOn?: number
  }> {
    const claims: Array<{
      type: 'independent' | 'dependent'
      number: number
      content: string
      dependsOn?: number
    }> = []

    const lines = claimsText.split('\n')
    let claimNumber = 0

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // 匹配权利要求编号（如 "1." 或 "1、"）
      const match = trimmedLine.match(/^(\d+)[.,]\s*(.+)$/)
      if (match) {
        claimNumber++
        const content = match[2]
        const type = content.includes('根据权利要求') ? 'dependent' : 'independent'

        const claim: any = {
          type,
          number: claimNumber,
          content,
        }

        // 如果是从属权利要求，提取依赖关系
        if (type === 'dependent') {
          const dependsMatch = content.match(/根据权利要求(\d+)/)
          if (dependsMatch) {
            claim.dependsOn = parseInt(dependsMatch[1], 10)
          }
        }

        claims.push(claim)
      }
    }

    return claims
  }

  /**
   * 转换输入为PatentApplicationData
   */
  private convertToPatentApplicationData(input: FormatConverterInput): PatentApplicationData {
    if (!input.content.structured) {
      throw new Error('缺少结构化内容')
    }

    const structured = input.content.structured

    return {
      inventionTitle: structured.inventionTitle,
      technicalField: structured.technicalField,
      backgroundArt: structured.backgroundArt,
      inventionContent: structured.inventionContent,
      drawingsDescription: structured.drawingsDescription,
      embodiment: structured.embodiment,
      claims: structured.claims,
      abstract: structured.abstract,
      applicant: input.metadata?.applicant
        ? {
            name: input.metadata.applicant,
            address: '未知地址',
          }
        : undefined,
    }
  }

  /**
   * 映射专利局格式到模板
   */
  private mapPatentOfficeToTemplate(
    patentOffice: 'CNIPA' | 'USPTO' | 'EPO'
  ): 'standard' | 'pct' | 'utility' {
    const templateMap: Record<string, 'standard' | 'pct' | 'utility'> = {
      CNIPA: 'standard',
      USPTO: 'standard',
      EPO: 'pct',
    }

    return templateMap[patentOffice] || 'standard'
  }

  /**
   * 执行格式检查
   */
  private performFormatCheck(
    data: PatentApplicationData,
    patentOffice: 'CNIPA' | 'USPTO' | 'EPO'
  ): {
    passed: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // 检查必填字段
    if (!data.inventionTitle || data.inventionTitle.trim().length === 0) {
      errors.push('发明名称不能为空')
    }

    if (!data.technicalField || data.technicalField.trim().length === 0) {
      errors.push('技术领域不能为空')
    }

    if (!data.abstract || data.abstract.trim().length === 0) {
      errors.push('摘要不能为空')
    }

    if (!data.claims || data.claims.length === 0) {
      errors.push('权利要求书不能为空')
    }

    // CNIPA特定检查
    if (patentOffice === 'CNIPA') {
      // 检查摘要长度（不超过300字）
      if (data.abstract && data.abstract.length > 300) {
        warnings.push(`摘要长度为${data.abstract.length}字，超过建议的300字`)
      }

      // 检查发明名称长度（不超过40字）
      if (data.inventionTitle && data.inventionTitle.length > 40) {
        warnings.push(`发明名称长度为${data.inventionTitle.length}字，超过建议的40字`)
      }

      // 检查权利要求数量（不超过10项）
      if (data.claims && data.claims.length > 10) {
        warnings.push(`权利要求数量为${data.claims.length}项，超过建议的10项`)
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    }
  }
}
