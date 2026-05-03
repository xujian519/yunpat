/**
 * 工具描述增强器
 *
 * 自动为工具生成优化的描述、示例和使用场景
 */

import { EnhancedTool, ToolCategory } from './types.js'

/**
 * 增强的工具元数据
 */
export interface EnhancedToolMetadata {
  // 基础信息
  name: string
  description: string
  category?: ToolCategory

  // 🆕 增强字段
  detailedDescription?: string // 详细描述
  examples?: ToolExample[] // 使用示例
  commonUseCases?: string[] // 常见用例
  capabilities?: string[] // 能力列表
  dataTypes?: string[] // 支持的数据类型
  limitations?: string[] // 限制说明
  prerequisites?: string[] // 前置条件
  relatedTools?: string[] // 相关工具
}

/**
 * 工具示例
 */
export interface ToolExample {
  description: string // 示例描述
  scenario: string // 使用场景
  input: Record<string, unknown> // 输入示例
  output: Record<string, unknown> // 输出示例
  notes?: string // 注意事项
}

/**
 * 工具描述增强器
 */
export class ToolDescriptionEnhancer {
  /**
   * 增强工具元数据
   */
  enhanceMetadata(tool: EnhancedTool): EnhancedToolMetadata {
    const baseMetadata = tool.metadata
    // const toolName = baseMetadata.name; // 保留用于未来扩展

    return {
      ...baseMetadata,
      detailedDescription: this.generateDetailedDescription(tool),
      examples: this.generateExamples(tool),
      commonUseCases: this.generateUseCases(tool),
      capabilities: this.generateCapabilities(tool),
      dataTypes: this.generateDataTypes(tool),
      limitations: this.generateLimitations(tool),
      prerequisites: this.generatePrerequisites(tool),
      relatedTools: this.generateRelatedTools(tool),
    }
  }

  /**
   * 生成详细描述
   */
  private generateDetailedDescription(tool: EnhancedTool): string {
    const metadata = tool.metadata

    return `
${metadata.description}

## 功能说明
此工具用于${metadata.category}相关操作。

## 主要特点
- ${this.extractFeatures(metadata.description)}
- 类型安全的输入输出验证
- 完整的错误处理
    `.trim()
  }

  /**
   * 生成使用示例
   */
  private generateExamples(tool: EnhancedTool): ToolExample[] {
    const metadata = tool.metadata
    const nameLower = metadata.name.toLowerCase()

    // 根据工具类型生成示例
    if (nameLower.includes('pdf')) {
      return this.generatePdfExamples(metadata)
    } else if (nameLower.includes('docx')) {
      return this.generateDocxExamples(metadata)
    } else if (nameLower.includes('excel')) {
      return this.generateExcelExamples(metadata)
    } else if (nameLower.includes('web')) {
      return this.generateWebExamples(metadata)
    }

    return this.getDefaultExample(metadata)
  }

  /**
   * 生成常见用例
   */
  private generateUseCases(tool: EnhancedTool): string[] {
    const metadata = tool.metadata
    const name = metadata.name

    const useCasesMap: Record<string, string[]> = {
      pdf_parse: ['从PDF提取文本内容', 'PDF文档结构化分析', 'PDF格式转换'],
      pdf_to_markdown: ['PDF转Markdown格式', '文档编辑准备', '内容管理系统导入'],
      docx_to_markdown: ['Word文档转Markdown', '文档格式转换', '内容发布准备'],
      excel_to_json: ['Excel数据导出', '数据处理流水线', 'API数据准备'],
      web_navigate: ['打开网页进行操作', '自动化测试', '数据抓取'],
      web_click: ['模拟用户点击', '页面交互', 'UI自动化'],
      image_ocr: ['图片文字识别', '扫描文档处理', '验证码识别'],
      audio_transcribe: ['语音转文字', '会议记录生成', '视频字幕制作'],
    }

    return useCasesMap[name] || this.extractUseCasesFromDescription(metadata.description)
  }

  /**
   * 生成能力列表
   */
  private generateCapabilities(tool: EnhancedTool): string[] {
    const metadata = tool.metadata
    const name = metadata.name.toLowerCase()

    const capabilitiesMap: Record<string, string[]> = {
      pdf: ['文本提取', '结构解析', '格式转换', 'OCR识别'],
      docx: ['文本提取', 'HTML转换', 'Markdown转换'],
      excel: ['数据读取', '格式转换', '批量处理'],
      web: ['页面导航', '元素交互', '数据提取', '截图'],
      ocr: ['文字识别', '多语言支持', '坐标定位'],
      audio: ['语音转写', '多语言支持', '时间戳生成'],
    }

    for (const [key, capabilities] of Object.entries(capabilitiesMap)) {
      if (name.includes(key)) {
        return capabilities
      }
    }

    return ['数据处理', '格式转换']
  }

  /**
   * 生成支持的数据类型
   */
  private generateDataTypes(tool: EnhancedTool): string[] {
    const metadata = tool.metadata
    const name = metadata.name.toLowerCase()

    const dataTypesMap: Record<string, string[]> = {
      pdf: ['application/pdf'],
      docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      excel: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      image: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp'],
      audio: ['audio/mpeg', 'audio/wav', 'audio/m4a'],
      web: ['text/html', 'application/xhtml+xml'],
    }

    for (const [key, types] of Object.entries(dataTypesMap)) {
      if (name.includes(key)) {
        return types
      }
    }

    return ['text/plain']
  }

  /**
   * 生成限制说明
   */
  private generateLimitations(tool: EnhancedTool): string[] {
    const name = tool.metadata.name.toLowerCase()

    if (name.includes('ocr') || name.includes('whisper')) {
      return ['需要足够的系统资源', '识别准确度取决于图片/音频质量']
    }

    if (name.includes('web')) {
      return ['需要WebBridge服务运行', '网络延迟影响性能', '某些网站可能有反爬限制']
    }

    if (name.includes('pdf') || name.includes('docx')) {
      return ['复杂格式可能无法完全保留', '大文件处理可能较慢']
    }

    return ['标准输入输出限制']
  }

  /**
   * 生成前置条件
   */
  private generatePrerequisites(tool: EnhancedTool): string[] {
    const name = tool.metadata.name.toLowerCase()

    if (name.includes('web')) {
      return ['WebBridge服务已启动', '浏览器扩展已安装']
    }

    if (name.includes('ocr')) {
      return ['Tesseract.js已安装', '语言包已下载']
    }

    if (name.includes('whisper')) {
      return ['Whisper模型已下载', '足够的内存和CPU']
    }

    return []
  }

  /**
   * 生成相关工具
   */
  private generateRelatedTools(tool: EnhancedTool): string[] {
    const name = tool.metadata.name.toLowerCase()

    const relatedMap: Record<string, string[]> = {
      pdf_parse: ['pdf_to_markdown', 'pdf_extract_text', 'pdf_ocr'],
      pdf_to_markdown: ['pdf_parse', 'docx_to_markdown'],
      docx_to_markdown: ['pdf_to_markdown', 'docx_to_html'],
      excel_to_json: ['excel_read', 'excel_to_markdown'],
      web_navigate: ['web_snapshot', 'web_click', 'web_fill'],
      web_click: ['web_snapshot', 'web_evaluate'],
      image_ocr: ['pdf_ocr', 'image_to_markdown'],
      audio_transcribe: ['audio_to_srt', 'audio_to_vtt'],
    }

    return relatedMap[name] || []
  }

  // ==================== 辅助方法 ====================

  private extractFeatures(description: string): string {
    // 简单地从描述中提取特性
    return description.split('。')[0] || description
  }

  private extractUseCasesFromDescription(description: string): string[] {
    const useCases: string[] = []

    if (description.includes('解析') || description.includes('提取')) {
      useCases.push('数据提取')
    }
    if (description.includes('转换') || description.includes('转')) {
      useCases.push('格式转换')
    }
    if (description.includes('分析')) {
      useCases.push('数据分析')
    }
    if (description.includes('自动')) {
      useCases.push('自动化处理')
    }

    return useCases.length > 0 ? useCases : ['通用数据处理']
  }

  // ==================== 示例生成器 ====================

  private generatePdfExamples(_metadata: unknown): ToolExample[] {
    return [
      {
        description: '解析PDF文件并提取文本',
        scenario: '从PDF文档中提取纯文本内容',
        input: { filePath: '/path/to/document.pdf' },
        output: { text: '提取的文本内容...', elements: [] },
        notes: '适用于文本型PDF，扫描版PDF需要使用OCR',
      },
      {
        description: '将PDF转换为Markdown',
        scenario: '将PDF文档转换为便于编辑的Markdown格式',
        input: { filePath: '/path/to/document.pdf' },
        output: { markdown: '# 文档标题\n\n内容...' },
        notes: '保留基本的文档结构',
      },
    ]
  }

  private generateDocxExamples(_metadata: unknown): ToolExample[] {
    return [
      {
        description: '将Word文档转换为Markdown',
        scenario: '将DOCX文件转换为Markdown格式用于内容发布',
        input: { filePath: '/path/to/document.docx' },
        output: { markdown: '转换后的Markdown内容...' },
        notes: '保留标题、段落、列表等基本结构',
      },
    ]
  }

  private generateExcelExamples(_metadata: unknown): ToolExample[] {
    return [
      {
        description: '将Excel数据转换为JSON',
        scenario: '从Excel文件提取数据并转换为JSON格式',
        input: { filePath: '/path/to/data.xlsx' },
        output: { json: '{"Sheet1": [{"A": 1, "B": 2}]}' },
        notes: '每个工作表转换为独立的数组',
      },
    ]
  }

  private generateWebExamples(_metadata: unknown): ToolExample[] {
    return [
      {
        description: '导航到指定URL',
        scenario: '打开网页进行后续操作',
        input: { url: 'https://example.com', newTab: true },
        output: { success: true, url: 'https://example.com' },
        notes: '使用newTab=true在新标签页打开',
      },
      {
        description: '点击页面元素',
        scenario: '与网页交互，点击按钮或链接',
        input: { selector: '#submit-button' },
        output: { success: true },
        notes: '支持CSS选择器和@e引用',
      },
    ]
  }

  private getDefaultExample(metadata: { name: string }): ToolExample[] {
    return [
      {
        description: `使用${metadata.name}处理数据`,
        scenario: '基本使用场景',
        input: {},
        output: {},
        notes: '请参考工具文档',
      },
    ]
  }

  /**
   * 批量增强工具
   */
  enhanceTools(tools: EnhancedTool[]): Map<string, EnhancedToolMetadata> {
    const enhanced = new Map<string, EnhancedToolMetadata>()

    for (const tool of tools) {
      const metadata = this.enhanceMetadata(tool)
      enhanced.set(tool.metadata.name, metadata)
    }

    return enhanced
  }

  /**
   * 生成工具描述文档
   */
  generateDocumentation(enhancedMetadata: Map<string, EnhancedToolMetadata>): string {
    const lines: string[] = []

    lines.push('# 工具描述文档\n')
    lines.push('本文档包含所有工具的详细描述和使用说明。\n')

    for (const [_name, metadata] of enhancedMetadata) {
      lines.push(`## ${metadata.name}\n`)
      lines.push(`**分类**: ${metadata.category}\n`)
      lines.push(`**描述**: ${metadata.description}\n`)

      if (metadata.detailedDescription) {
        lines.push(`### 详细说明\n`)
        lines.push(`${metadata.detailedDescription}\n`)
      }

      if (metadata.commonUseCases && metadata.commonUseCases.length > 0) {
        lines.push(`### 常见用例\n`)
        metadata.commonUseCases.forEach((useCase) => {
          lines.push(`- ${useCase}`)
        })
        lines.push('')
      }

      if (metadata.capabilities && metadata.capabilities.length > 0) {
        lines.push(`### 能力\n`)
        metadata.capabilities.forEach((cap) => {
          lines.push(`- ${cap}`)
        })
        lines.push('')
      }

      if (metadata.examples && metadata.examples.length > 0) {
        lines.push(`### 使用示例\n`)
        metadata.examples.forEach((example, index) => {
          lines.push(`#### 示例 ${index + 1}: ${example.description}\n`)
          lines.push(`**场景**: ${example.scenario}\n`)
          lines.push(`**输入**:\n`)
          lines.push('```')
          lines.push('javascript')
          lines.push(JSON.stringify(example.input, null, 2))
          lines.push('```')
          lines.push('\n')
          lines.push(`**输出**:\n`)
          lines.push('```')
          lines.push('javascript')
          lines.push(JSON.stringify(example.output, null, 2))
          lines.push('```')
          lines.push('\n')
          if (example.notes) {
            lines.push(`**注意**: ${example.notes}\n`)
          }
        })
      }

      if (metadata.limitations && metadata.limitations.length > 0) {
        lines.push(`### 限制\n`)
        metadata.limitations.forEach((limit) => {
          lines.push(`- ${limit}`)
        })
        lines.push('')
      }

      if (metadata.prerequisites && metadata.prerequisites.length > 0) {
        lines.push(`### 前置条件\n`)
        metadata.prerequisites.forEach((prereq) => {
          lines.push(`- ${prereq}`)
        })
        lines.push('')
      }

      if (metadata.relatedTools && metadata.relatedTools.length > 0) {
        lines.push(`### 相关工具\n`)
        metadata.relatedTools.forEach((related) => {
          lines.push(`- ${related}`)
        })
        lines.push('')
      }

      lines.push('---\n')
    }

    return lines.join('\n')
  }
}
