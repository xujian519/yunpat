/**
 * Skill 渲染器
 *
 * 负责渲染 Skill 提示词
 *
 * @package @yunpat/skills
 */

import type { Skill, SkillPrompt } from '../types/Skill.js'
import type { SkillContext } from '../types/SkillContext.js'
import { replaceVariables } from './VariableReplacer.js'

/**
 * 渲染 Skill 提示词
 *
 * @param skill - Skill 对象
 * @param args - 技能参数
 * @param context - 技能上下文
 * @returns 渲染后的提示词
 */
export async function renderSkillPrompt(
  skill: Skill,
  args: Record<string, any>,
  context: SkillContext
): Promise<SkillPrompt> {
  // 1. 准备变量
  const vars = prepareVariables(skill, args, context)

  // 2. 替换变量
  const userPrompt = replaceVariables(skill.content, vars)

  // 3. 构建 system prompt（基于 frontmatter）
  const systemPrompt = buildSystemPrompt(skill)

  // 4. 计算 token 数量（简化版本）
  const tokenCount = estimateTokenCount(systemPrompt + userPrompt)

  // 5. 检测元数据
  const hasKnowledge = skill.frontmatter.knowledge !== undefined
  const hasVariables = getTemplateVariables(skill.content).length > 0
  const hasShellCommands = skill.content.includes('!`') || skill.content.includes('!`')

  return {
    system: systemPrompt,
    user: userPrompt,
    metadata: {
      tokenCount,
      hasKnowledge,
      hasVariables,
      hasShellCommands,
    },
  }
}

/**
 * 准备变量
 *
 * @param skill - Skill 对象
 * @param args - 技能参数
 * @param context - 技能上下文
 * @returns 变量对象
 */
function prepareVariables(
  skill: Skill,
  args: Record<string, any>,
  context: SkillContext
): Record<string, any> {
  return {
    // 技能参数
    ...args,

    // 环境变量
    cwd: context.env.cwd,
    home: context.env.home,
    sessionId: context.env.sessionId,

    // Agent 上下文
    agentName: context.agentName,
    agentDescription: context.agentDescription,

    // 用户上下文
    user: context.user,

    // 知识库上下文
    knowledge: context.knowledge,

    // 调用上下文
    call: context.call,
  }
}

/**
 * 构建 System Prompt
 *
 * @param skill - Skill 对象
 * @returns System Prompt 字符串
 */
function buildSystemPrompt(skill: Skill): string {
  const parts: string[] = []

  // 1. 角色定义（基于描述）
  parts.push(`# 角色定义\n\n你是一位${skill.description}。`)

  // 2. 工作原则
  parts.push(`
## 工作原则

1. 准确性：确保输出的内容准确无误
2. 完整性：提供完整的信息和解释
3. 专业性：使用专业的术语和表达
4. 清晰性：条理清晰，易于理解
`)

  // 3. 知识库增强（如果有）
  if (skill.frontmatter.knowledge) {
    parts.push(`
## 知识库增强

你可以访问以下知识库资源：
- 相关概念
- Wiki 页面
- 知识卡片

请充分利用这些资源来提高输出质量。
`)
  }

  return parts.join('\n')
}

/**
 * 估算 Token 数量
 *
 * 简化版本：假设 1 个字符 ≈ 0.5 个 token
 *
 * @param text - 文本内容
 * @returns Token 数量
 */
function estimateTokenCount(text: string): number {
  // 简化估算：中文 1 字 ≈ 0.5 token，英文 1 词 ≈ 1 token
  const chineseChars = (text.match(/[一-龥]/g) || []).length
  const englishChars = text.length - chineseChars

  return Math.ceil(chineseChars * 0.5 + englishChars * 0.3)
}

/**
 * 获取模板中使用的变量列表
 *
 * @param template - 模板字符串
 * @returns 变量名数组
 */
function getTemplateVariables(template: string): string[] {
  const variables = new Set<string>()

  // 匹配 {{variable}}
  const matches = template.match(/\{\{(\w+)\}\}/g)
  if (matches) {
    matches.forEach((match) => {
      const varName = match.replace(/\{|\}/g, '')
      if (!['if', 'unless', 'each', 'this', '@index'].includes(varName)) {
        variables.add(varName)
      }
    })
  }

  return Array.from(variables)
}
