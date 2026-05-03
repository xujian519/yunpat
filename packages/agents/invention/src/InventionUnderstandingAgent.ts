import { Agent, type ExecutionContext } from '@yunpat/core'

export interface InventionUnderstandingInput {
  title: string
  field: string
  technicalDisclosure: string
  drawings?: string[]
  applicant?: string
  inventors?: string[]
}

export interface InventionUnderstandingOutput {
  technicalField: string
  backgroundArt: string
  technicalProblem: string
  technicalSolution: string
  beneficialEffects: string
  keyFeatures: string[]
  drawingDescriptions: string[]
  confidence: number
}

interface InventionPlan {
  input: InventionUnderstandingInput
}

export class InventionUnderstandingAgent extends Agent {
  protected async plan(
    input: InventionUnderstandingInput,
    _context: ExecutionContext
  ): Promise<InventionPlan> {
    if (!input.title?.trim()) {
      throw new Error('发明名称不能为空')
    }
    if (!input.field?.trim()) {
      throw new Error('技术领域不能为空')
    }
    if (!input.technicalDisclosure?.trim()) {
      throw new Error('技术交底书不能为空')
    }

    console.log('\n🔍 [发明理解] 步骤1: 规划阶段')
    console.log(`   发明名称: ${input.title}`)
    console.log(`   技术领域: ${input.field}`)

    return { input }
  }

  protected async act(
    plan: InventionPlan,
    context: ExecutionContext
  ): Promise<InventionUnderstandingOutput> {
    console.log('\n🧠 [发明理解] 步骤2: 分析阶段')

    const { input } = plan

    const systemPrompt = `你是一位资深的专利代理人，专精于发明理解和专利申请文件撰写。

你的任务是深入理解技术交底书，提取以下结构化信息：
1. 技术领域 - 明确发明所属的技术领域
2. 背景技术 - 现有技术存在的问题
3. 技术问题 - 本发明要解决的具体技术问题
4. 技术方案 - 解决技术问题的具体方案
5. 有益效果 - 与现有技术相比的优势
6. 关键特征 - 发明的核心技术特征清单
7. 附图说明 - 各附图的内容描述

请用中文回答，保持专业术语的准确性。输出必须是严格的 JSON 格式。`

    const userPrompt = `发明名称：${input.title}

技术领域：${input.field}

技术交底书：
${input.technicalDisclosure}

${input.drawings && input.drawings.length > 0 ? `附图说明：\n${input.drawings.join('\n')}` : ''}

请分析以上技术方案，输出以下 JSON 格式：
{
  "technicalField": "技术领域描述",
  "backgroundArt": "背景技术描述",
  "technicalProblem": "要解决的技术问题",
  "technicalSolution": "技术方案详细描述",
  "beneficialEffects": "有益效果描述",
  "keyFeatures": ["特征1", "特征2", "特征3"],
  "drawingDescriptions": ["图1描述", "图2描述"],
  "confidence": 0.95
}`

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行发明理解')
    }

    const result = await this.callLLMWithFallback(context.llm, systemPrompt, userPrompt, input)

    console.log(`\n✅ [发明理解] 分析完成 (置信度: ${result.confidence.toFixed(2)})`)
    console.log(`   技术领域: ${result.technicalField}`)
    console.log(`   关键特征: ${result.keyFeatures.length} 个`)

    return result
  }

  private async callLLMWithFallback(
    llm: NonNullable<ExecutionContext['llm']>,
    systemPrompt: string,
    userPrompt: string,
    input: InventionUnderstandingInput
  ): Promise<InventionUnderstandingOutput> {
    const maxRetries = 2
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await llm.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        })

        const content = response.message.content
        const parsed = this.safeParseJSON(content)

        if (parsed) {
          return this.normalizeOutput(parsed, input)
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        console.warn(
          `[InventionUnderstandingAgent] LLM 调用失败 (尝试 ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`
        )
      }
    }

    console.error('[InventionUnderstandingAgent] 分析失败，使用回退输出:', lastError)
    return this.createFallbackOutput(input)
  }

  private normalizeOutput(
    parsed: Record<string, unknown>,
    input: InventionUnderstandingInput
  ): InventionUnderstandingOutput {
    const getString = (key: string): string => {
      const value = parsed[key]
      return typeof value === 'string' ? value.trim() : ''
    }

    const getStringArray = (key: string): string[] => {
      const value = parsed[key]
      return Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string').map((s) => s.trim())
        : []
    }

    const getNumber = (key: string, fallback: number): number => {
      const value = parsed[key]
      return typeof value === 'number' && !isNaN(value) ? value : fallback
    }

    return {
      technicalField: getString('technicalField') || input.field,
      backgroundArt: getString('backgroundArt'),
      technicalProblem: getString('technicalProblem'),
      technicalSolution: getString('technicalSolution'),
      beneficialEffects: getString('beneficialEffects'),
      keyFeatures: getStringArray('keyFeatures'),
      drawingDescriptions: getStringArray('drawingDescriptions'),
      confidence: getNumber('confidence', 0.8),
    }
  }

  private createFallbackOutput(input: InventionUnderstandingInput): InventionUnderstandingOutput {
    return {
      technicalField: input.field,
      backgroundArt: '',
      technicalProblem: '',
      technicalSolution: input.technicalDisclosure.substring(0, 500),
      beneficialEffects: '',
      keyFeatures: [],
      drawingDescriptions: input.drawings ?? [],
      confidence: 0.5,
    }
  }
}
