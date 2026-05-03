/**
 * 使用提示词模板生成权利要求的示例
 */

import { PromptTemplateManager } from '../ai/prompts/PromptTemplateManager.js'
import type { LLMAdapter } from '../packages/core/src/lifecycle/Lifecycle.js'

interface InventionInput {
  invention_title: string
  invention_type: 'device' | 'method' | 'system' | 'composition'
  technical_field: string
  background_art: string
  technical_problem: string
  technical_solution: string
  technical_effects: string[]
  essential_features: Array<{
    name: string
    description: string
    is_essential: boolean
    is_distinguishing: boolean
  }>
  optional_features?: Array<{
    name: string
    description: string
    is_alternative: boolean
    is_preferred: boolean
  }>
  prior_art_analysis?: {
    closest_prior_art: string
    differences: string[]
    technical_problem_solved: string
  }
}

/**
 * 权利要求生成器
 */
export class ClaimsGenerator {
  private promptManager: PromptTemplateManager
  private llm: LLMAdapter

  constructor(llm: LLMAdapter) {
    this.llm = llm
    this.promptManager = new PromptTemplateManager()
  }

  /**
   * 生成权利要求
   */
  async generateClaims(input: InventionInput) {
    // 1. 加载提示词模板
    const template = await this.promptManager.loadTemplate('01-claims-generation')

    // 2. 准备变量
    const variables = {
      invention_title: input.invention_title,
      invention_type: input.invention_type,
      technical_field: input.technical_field,
      technical_problem: input.technical_problem,
      technical_solution: input.technical_solution,
      technical_effects: input.technical_effects.join('\n- '),
      essential_features: JSON.stringify(input.essential_features, null, 2),
      optional_features: JSON.stringify(input.optional_features || [], null, 2),
      prior_art: input.prior_art_analysis ? JSON.stringify(input.prior_art_analysis, null, 2) : '',
    }

    // 3. 渲染提示词
    const prompt = this.promptManager.render('01-claims-generation', variables)

    // 4. 调用LLM生成
    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一位资深的专利代理师，精通中国专利法和审查指南。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    })

    // 5. 解析响应
    return this.parseClaimsResponse(response.message.content)
  }

  /**
   * 解析LLM响应
   */
  private parseClaimsResponse(content: string) {
    // 这里应该解析LLM返回的JSON格式的权利要求
    // 简化示例，实际需要更复杂的解析逻辑
    try {
      return JSON.parse(content)
    } catch (error) {
      console.error('解析权利要求失败:', error)
      throw new Error('LLM返回的权利要求格式不正确')
    }
  }
}
