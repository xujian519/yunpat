/**
 * Prompt 构建器
 *
 * 负责将知识库检索结果组织成 LLM 可理解的 Prompt
 *
 * @example
 * const builder = new PromptBuilder()
 * const systemPrompt = builder.buildSystemPrompt(knowledge)
 * const userPrompt = builder.buildUserPrompt(input, knowledge)
 */

import type { InventionUnderstandingInput, KnowledgeRetrievalResult } from './types.js'

/**
 * Prompt 构建器配置
 */
interface PromptBuilderConfig {
  /** 是否启用知识增强 */
  enableKnowledgeEnhancement: boolean
  /** 最大 Prompt 长度（字符数） */
  maxPromptLength: number
  /** 是否包含示例 */
  includeExamples: boolean
  /** 详细程度（简化/标准/完整） */
  detailLevel: 'simplified' | 'standard' | 'full'
}

/**
 * Prompt 构建器
 */
export class PromptBuilder {
  private config: PromptBuilderConfig

  constructor(config?: Partial<PromptBuilderConfig>) {
    this.config = {
      enableKnowledgeEnhancement: true,
      maxPromptLength: 8000,
      includeExamples: true,
      detailLevel: 'standard',
      ...config,
    }
  }

  /**
   * 构建完整的 System Prompt
   */
  buildSystemPrompt(knowledge?: KnowledgeRetrievalResult): string {
    const sections: string[] = []

    // 1. 角色定义
    sections.push(this.buildRoleSection())

    // 2. 任务描述
    sections.push(this.buildTaskSection())

    // 3. 核心原则
    sections.push(this.buildPrinciplesSection())

    // 4. 输出要求
    sections.push(this.buildOutputSection())

    // 5. 知识增强（如果启用）
    if (this.config.enableKnowledgeEnhancement && knowledge) {
      const knowledgeSection = this.buildKnowledgeSection(knowledge)
      if (knowledgeSection) {
        sections.push(knowledgeSection)
      }
    }

    return sections.join('\n\n')
  }

  /**
   * 构建用户 Prompt
   */
  buildUserPrompt(
    input: InventionUnderstandingInput,
    knowledge?: KnowledgeRetrievalResult
  ): string {
    const sections: string[] = []

    // 1. 发明基本信息
    sections.push(this.buildBasicInfoSection(input))

    // 2. 现有技术
    if (input.priorArt && input.priorArt.length > 0) {
      sections.push(this.buildPriorArtSection(input.priorArt))
    }

    // 3. 技术交底书
    sections.push(this.buildDisclosureSection(input.technicalDisclosure))

    // 4. 附图说明
    if (input.drawings && input.drawings.length > 0) {
      sections.push(this.buildDrawingsSection(input.drawings))
    }

    // 5. 领域特定知识（如果有）
    if (knowledge?.domainKnowledge) {
      const domainSection = this.buildDomainKnowledgeSection(knowledge.domainKnowledge)
      if (domainSection) {
        sections.push(domainSection)
      }
    }

    // 6. 输出要求和示例
    sections.push(this.buildOutputRequirementSection())

    return sections.join('\n\n')
  }

  /**
   * 构建角色定义部分
   */
  private buildRoleSection(): string {
    return `## 角色定义

你是一位资深的专利代理人，具有以下专长：
- 深入理解技术交底书，提取发明要点
- 熟悉专利法、审查指南和撰写规范
- 掌握三步法等创造性判断方法
- 能够准确识别技术问题和创新点

你的核心任务是：从技术交底书中提取**多组**问题-特征-效果三元组。`
  }

  /**
   * 构建任务描述部分
   */
  private buildTaskSection(): string {
    return `## 核心任务

请深入理解技术交底书，提取以下结构化信息：

1. **多组三元组**: 每组包含技术问题、技术特征、技术效果
2. **技术领域**: 标准化技术领域描述
3. **背景技术**: 基于现有技术整理的背景
4. **实施方式**: 提炼实施方式要点
5. **附图说明**: 各附图的内容描述

**重要**:
- 提取**多组**三元组，覆盖所有创新点
- 确保问题-特征-效果**逻辑一致**
- 技术效果必须**可量化**或**可验证**
- 技术特征必须**具体**（不是抽象描述）`
  }

  /**
   * 构建核心原则部分
   */
  private buildPrinciplesSection(): string {
    return `## 核心原则

### 三元组逻辑

**问题 → 特征 → 效果**

- 技术问题：要解决的具体技术问题（针对现有技术缺陷）
- 技术特征：解决技术问题的核心创新点（具体技术要素）
- 技术效果：与现有技术相比的优势（量化对比）

**一致性要求**：
- 每个技术特征必须对应至少一个技术效果
- 技术问题不能包含解决手段（避免"通过..."、"采用..."）
- 技术效果必须与现有技术有明确对比
- 技术特征必须具体（不是"改进设计"）

### 多组三元组策略

- 优先识别主要创新点
- 次要创新点单独成组
- 相关创新点可以合并
- 每组三元组内部逻辑自洽`
  }

  /**
   * 构建输出要求部分
   */
  private buildOutputSection(): string {
    return `## 输出要求

### 格式要求

输出必须是**严格的 JSON 格式**，包含以下字段：

\`\`\`json
{
  "inventionConcepts": [
    {
      "technicalProblem": "要解决的具体技术问题",
      "keyFeatures": ["特征1", "特征2", "特征3"],
      "technicalEffects": ["效果1", "效果2"],
      "confidence": 0.9
    }
  ],
  "technicalField": "标准化的技术领域描述",
  "embodimentSummary": "实施方式提炼",
  "drawingDescriptions": ["图1描述", "图2描述"]
}
\`\`\`

### 质量要求

1. **多组三元组**: 至少提取 2 组三元组
2. **逻辑一致性**: 每个特征都有对应效果
3. **量化效果**: 包含具体数据（如"提高50%"、"延长3倍"）
4. **具体特征**: 避免抽象描述（如"改进设计"）
5. **问题纯度**: 问题不包含解决手段
6. **置信度**: 根据信息完整度评估（0-1）`
  }

  /**
   * 构建知识增强部分
   */
  private buildKnowledgeSection(knowledge: KnowledgeRetrievalResult): string {
    const parts: string[] = []

    // 1. 方法论指导（简化版）
    if (knowledge.methodology) {
      parts.push(this.formatMethodology(knowledge.methodology))
    }

    // 2. 术语标准（常用映射）
    if (knowledge.terminology && knowledge.terminology.size > 0) {
      parts.push(this.formatTerminology(knowledge.terminology))
    }

    // 3. 案例参考（最多 2 个）
    if (
      knowledge.domainKnowledge.similarCases &&
      knowledge.domainKnowledge.similarCases.length > 0
    ) {
      parts.push(this.formatCases(knowledge.domainKnowledge.similarCases.slice(0, 2)))
    }

    return `## 参考知识（来自专利知识库）

${parts.join('\n\n---\n\n')}`
  }

  /**
   * 格式化方法论
   */
  private formatMethodology(methodology: KnowledgeRetrievalResult['methodology']): string {
    const parts: string[] = []

    if (methodology.triplet && methodology.triplet.length > 0) {
      parts.push('### 三步法框架')
      parts.push(methodology.triplet.join('\n\n'))
    }

    if (methodology.problem && methodology.problem.length > 0) {
      parts.push('### 技术问题提取')
      parts.push(this.summarizeList(methodology.problem, 3))
    }

    if (methodology.feature && methodology.feature.length > 0) {
      parts.push('### 技术特征提取')
      parts.push(this.summarizeList(methodology.feature, 3))
    }

    if (methodology.effect && methodology.effect.length > 0) {
      parts.push('### 技术效果提取')
      parts.push(this.summarizeList(methodology.effect, 3))
    }

    return parts.join('\n\n')
  }

  /**
   * 格式化术语标准
   */
  private formatTerminology(terminology: Map<string, string>): string {
    const commonMappings = Array.from(terminology.entries()).slice(0, 10) // 只显示前10个

    return `### 术语标准化规则

以下非标准术语应自动转换为标准专利术语：

${commonMappings.map(([informal, standard]) => `- "${informal}" → "${standard}"`).join('\n')}`
  }

  /**
   * 格式化案例参考
   */
  private formatCases(cases: string[]): string {
    if (cases.length === 0) return ''

    return `### 参考案例

${cases
  .map((case_, index) => `**案例 ${index + 1}**:\n${this.truncate(case_, 200)}...`)
  .join('\n\n')}`
  }

  /**
   * 构建发明基本信息部分
   */
  private buildBasicInfoSection(input: InventionUnderstandingInput): string {
    const lines: string[] = []

    lines.push('## 发明基本信息')
    lines.push('')
    lines.push(`**发明名称**: ${input.title}`)
    lines.push(`**技术领域**: ${input.field}`)

    if (input.applicant) {
      lines.push(`**申请人**: ${input.applicant}`)
    }

    if (input.inventors && input.inventors.length > 0) {
      lines.push(`**发明人**: ${input.inventors.join(', ')}`)
    }

    return lines.join('\n')
  }

  /**
   * 构建现有技术部分
   */
  private buildPriorArtSection(priorArt: string[]): string {
    const lines: string[] = []

    lines.push('## 现有技术（背景）')
    lines.push('')

    priorArt.forEach((art, index) => {
      const truncated = art.length > 300 ? art.substring(0, 300) + '...' : art
      lines.push(`**现有技术 ${index + 1}**:`)
      lines.push(truncated)
      lines.push('')
    })

    return lines.join('\n')
  }

  /**
   * 构建技术交底书部分
   */
  private buildDisclosureSection(disclosure: string): string {
    const lines: string[] = []

    lines.push('## 技术交底书')
    lines.push('')

    // 如果交底书很长，截取前 2000 字
    const truncated =
      disclosure.length > 2000
        ? disclosure.substring(0, 2000) + '\n\n...(交底书内容过长，已截取)...'
        : disclosure

    lines.push(truncated)

    return lines.join('\n')
  }

  /**
   * 构建附图说明部分
   */
  private buildDrawingsSection(drawings: string[]): string {
    if (drawings.length === 0) return ''

    const lines: string[] = []

    lines.push('## 附图说明')
    lines.push('')

    drawings.forEach((drawing, index) => {
      lines.push(`**图 ${index + 1}**: ${drawing}`)
    })

    return lines.join('\n')
  }

  /**
   * 构建领域特定知识部分
   */
  private buildDomainKnowledgeSection(
    domainKnowledge: KnowledgeRetrievalResult['domainKnowledge']
  ): string {
    const parts: string[] = []

    if (domainKnowledge.writingGuide) {
      parts.push('### 撰写指导')
      parts.push(this.truncate(domainKnowledge.writingGuide, 300))
    }

    if (domainKnowledge.commonErrors && domainKnowledge.commonErrors.length > 0) {
      parts.push('### 常见错误')
      domainKnowledge.commonErrors.forEach((error_, index) => {
        parts.push(`**错误 ${index + 1}**:`)
        parts.push(this.truncate(error_, 150))
      })
    }

    if (parts.length > 0) {
      return `## 领域特定指导

${parts.join('\n\n')}`
    }

    return ''
  }

  /**
   * 构建输出要求和示例部分
   */
  private buildOutputRequirementSection(): string {
    const hasExamples = this.config.includeExamples

    const sections = [
      `## 输出要求

### 格式要求

输出必须是严格的 JSON 格式：

\`\`\`json
{
  "inventionConcepts": [
    {
      "technicalProblem": "要解决的具体技术问题",
      "keyFeatures": ["特征1", "特征2", "特征3"],
      "technicalEffects": ["效果1", "效果2"],
      "confidence": 0.9
    }
  ],
  "technicalField": "标准化的技术领域描述",
  "embodimentSummary": "实施方式提炼",
  "drawingDescriptions": ["图1描述", "图2描述"]
}
\`\`\`

### 核心要求

1. **多组三元组**: 至少提取 2 组三元组
2. **逻辑一致性**: 每个技术特征对应至少一个技术效果
3. **量化效果**: 技术效果必须包含具体数据（"提高50%"、"延长3倍"）
4. **具体特征**: 避免抽象描述（如"改进设计"、"优化"）
5. **问题纯度**: 技术问题不应包含解决手段（避免"通过..."、"采用..."）
6. **置信度评估**: 根据信息完整度评估（0-1之间）`,
    ]

    if (hasExamples) {
      sections.push(this.getExampleSection())
    }

    return sections.join('\n\n')
  }

  /**
   * 获取示例部分
   */
  private getExampleSection(): string {
    return `### 输出示例

**输入**:
- 问题: 阀片密封性差
- 特征: 采用陶瓷材料，表面精度0.01mm
- 效果: 密封性提高50%

**输出**:
\`\`\`json
{
  "inventionConcepts": [
    {
      "technicalProblem": "现有金属阀片在高温高压环境下密封性差",
      "keyFeatures": ["采用氧化锆陶瓷材料", "表面精度达到0.01mm"],
      "technicalEffects": ["密封性提高50%", "使用寿命延长3倍"],
      "confidence": 0.9
    }
  ]
}
\`\`\``
  }

  /**
   * 压缩知识内容
   */
  compressKnowledge(knowledge: KnowledgeRetrievalResult, maxLength: number = 1000): string {
    const parts: string[] = []

    // 1. 核心方法论（优先级最高）
    const methodologyLength = this.extractCoreMethodology(knowledge).length
    if (methodologyLength < maxLength * 0.5) {
      parts.push(this.extractCoreMethodology(knowledge))
    }

    // 2. 常用术语（优先级中）
    const terminologyLength = this.extractEssentialTerminology(knowledge).length
    if (parts.join('').length + terminologyLength < maxLength * 0.8) {
      parts.push(this.extractEssentialTerminology(knowledge))
    }

    // 3. 简化案例（优先级低）
    if (parts.join('').length < maxLength * 0.9) {
      const casesLength = this.extractSimplifiedCases(knowledge).length
      if (parts.join('').length + casesLength < maxLength) {
        parts.push(this.extractSimplifiedCases(knowledge))
      }
    }

    return parts.join('\n\n---\n\n')
  }

  /**
   * 提取核心方法论
   */
  private extractCoreMethodology(knowledge: KnowledgeRetrievalResult): string {
    const keyPoints: string[] = []

    if (knowledge.methodology.triplet && knowledge.methodology.triplet.length > 0) {
      keyPoints.push('### 三步法')
      keyPoints.push('- 确定区别特征')
      keyPoints.push('- 认定技术问题')
      keyPoints.push('- 判断技术启示')
    }

    if (knowledge.methodology.problem && knowledge.methodology.problem.length > 0) {
      keyPoints.push('### 技术问题')
      keyPoints.push('- 针对现有技术缺陷')
      keyPoints.push('- 不包含解决手段')
    }

    if (knowledge.methodology.feature && knowledge.methodology.feature.length > 0) {
      keyPoints.push('### 技术特征')
      keyPoints.push('- 独立特征分开，协同特征整体')
      keyPoints.push('- 实质对比而非文字对比')
    }

    if (knowledge.methodology.effect && knowledge.methodology.effect.length > 0) {
      keyPoints.push('### 技术效果')
      keyPoints.push('- 量化对比')
      keyPoints.push('- 由特征直接带来')
    }

    return keyPoints.join('\n')
  }

  /**
   * 提取基本术语
   */
  private extractEssentialTerminology(knowledge: KnowledgeRetrievalResult): string {
    const commonMappings = [
      ['用', '采用'],
      ['使用', '采用'],
      ['连接', '固定连接'],
      ['设置', '配置'],
      ['装置', '设备'],
      ['方法', '技术方案'],
    ]

    return `### 术语标准化

${commonMappings.map(([informal, standard]) => `- "${informal}" → "${standard}"`).join('\n')}`
  }

  /**
   * 提取简化案例
   */
  private extractSimplifiedCases(knowledge: KnowledgeRetrievalResult): string {
    const cases = knowledge.domainKnowledge.similarCases || []
    return cases
      .slice(0, 1)
      .map((case_, index) => `**案例 ${index + 1}**: ${this.truncate(case_, 150)}...`)
      .join('\n\n')
  }

  /**
   * 辅助方法：截断文本
   */
  private truncate(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  /**
   * 辅助方法：总结列表
   */
  private summarizeList(items: string[], maxItems: number = 5): string {
    if (items.length <= maxItems) {
      return items.map((item, i) => `${i + 1}. ${item}`).join('\n')
    }

    const summarized = items.slice(0, maxItems).map((item, i) => `${i + 1}. ${item}`)
    summarized.push(`... (还有 ${items.length - maxItems} 项)`)
    return summarized.join('\n')
  }

  /**
   * 构建简化版 Prompt（用于低 Token 场景）
   */
  buildSimplifiedPrompt(input: InventionUnderstandingInput): string {
    return `你是一位专利代理人。请分析以下技术交底书，提取问题-特征-效果三元组。

## 技术交底书
${input.title}
${input.field}

${input.technicalDisclosure}

## 输出 JSON 格式
{
  "inventionConcepts": [{
    "technicalProblem": "问题",
    "keyFeatures": ["特征1", "特征2"],
    "technicalEffects": ["效果1", "效果2"],
    "confidence": 0.8
  }],
  "technicalField": "技术领域"
}`
  }

  /**
   * 构建教学版 Prompt（用于少样本场景）
   */
  buildTutorialPrompt(input: InventionUnderstandingInput): string {
    return `你是一位资深专利代理人，正在指导新手理解发明。

## 分步指导

**第1步：识别技术问题**
- 从现有技术的不足入手
- 用简洁语言描述
- 避免包含解决手段

**第2步：提取技术特征**
- 识别核心创新点
- 分为必要特征和附加特征
- 使用具体的技术术语

**第3步：描述技术效果**
- 与现有技术对比
- 量化效果（数据、百分比）
- 说明由哪个特征带来

## 实践任务
请按照以上步骤，分析以下技术交底书：

${input.title}
${input.field}

${input.technicalDisclosure}`
  }
}

/**
 * 导出配置
 */
export interface PromptBuilderExport {
  buildSystemPrompt: (knowledge?: KnowledgeRetrievalResult) => string
  buildUserPrompt: (
    input: InventionUnderstandingInput,
    knowledge?: KnowledgeRetrievalResult
  ) => string
  buildSimplifiedPrompt: (input: InventionUnderstandingInput) => string
  buildTutorialPrompt: (input: InventionUnderstandingInput) => string
  compressKnowledge: (knowledge: KnowledgeRetrievalResult, maxLength?: number) => string
}

/**
 * 导出实例
 */
export const promptBuilder = new PromptBuilder({
  enableKnowledgeEnhancement: true,
  maxPromptLength: 8000,
  includeExamples: true,
  detailLevel: 'standard',
})
