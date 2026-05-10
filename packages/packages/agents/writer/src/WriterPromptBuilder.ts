import type { CachedResponse } from '@yunpat/core'
import type { WritingTask, WritingPlan } from './WriterTypes.js'
import { OutlineSchema, CACHE_CONFIG, GENERATION_CONFIG } from './WriterTypes.js'

/**
 * 构建大纲生成提示
 */
export function buildOutlinePrompt(task: WritingTask): string {
  let prompt = `请为以下主题创建一个结构化的技术文档大纲：

主题：${task.topic}
任务类型：${task.type}

要求：
- 返回 JSON 数组格式
- 每个元素都是字符串类型的章节标题
- 包含 5-8 个主要章节
- 章节按逻辑顺序排列

示例格式：
["引言", "架构设计", "核心组件", "应用场景", "总结"]

请直接返回 JSON 数组，不要包含其他说明文字。`

  if (task.requirements && task.requirements.length > 0) {
    prompt += `\n\n特殊要求：\n${task.requirements.map((r) => `- ${r}`).join('\n')}`
  }

  if (task.references && task.references.length > 0) {
    prompt += `\n\n参考资料：\n${task.references.map((r) => `- ${r}`).join('\n')}`
  }

  return prompt
}

/**
 * 解析大纲
 */
export function parseOutline(content: string): string[] {
  let jsonMatch: RegExpMatchArray | null = null

  jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)

  if (!jsonMatch) {
    jsonMatch = content.match(/\[[\s\S]*\]/)
  }

  if (!jsonMatch) {
    throw new Error('无法从 LLM 响应中提取大纲 JSON')
  }

  try {
    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
    return OutlineSchema.parse(parsed)
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`大纲解析失败: ${error.message}`)
    }
    throw new Error('大纲解析失败: 未知错误')
  }
}

/**
 * 构建章节生成提示
 */
export function buildSectionPrompt(heading: string, plan: WritingPlan): string {
  const targetLength = Math.round(plan.targetLength / plan.structure.sections.length)

  return `请为文档"${plan.structure.title}"撰写以下章节：

章节标题：${heading}
语气：${plan.tone}
目标长度：约${targetLength}词

要求：
- 内容详细、准确
- 符合技术文档规范
- 使用 Markdown 格式

请直接输出章节内容，不要包含章节标题。`
}

/**
 * 格式化内容
 */
export function formatContent(content: string, plan: WritingPlan): string {
  return `# ${plan.structure.title}\n\n${content}`
}

/**
 * 确定语气
 */
export function determineTone(task: WritingTask): WritingPlan['tone'] {
  if (task.requirements?.includes('学术')) return 'academic'
  if (task.requirements?.includes('正式')) return 'formal'
  if (task.requirements?.includes('轻松')) return 'casual'
  return 'technical'
}

/**
 * 估算长度
 */
export function estimateLength(task: WritingTask): number {
  switch (task.type) {
    case 'generate':
      return GENERATION_CONFIG.DEFAULT_DOCUMENT_LENGTH
    case 'optimize':
      return GENERATION_CONFIG.OPTIMIZE_DOCUMENT_LENGTH
    case 'convert':
    case 'format':
      return 0
    default:
      return GENERATION_CONFIG.OPTIMIZE_DOCUMENT_LENGTH
  }
}

/**
 * 从内容中提取大纲
 */
export function extractOutlineFromContent(content: string): string[] {
  const headingRegex = /^##\s+(.+)$/gm
  const matches = content.match(headingRegex)

  if (matches) {
    return matches.map((match) => match.replace(/^##\s+/, ''))
  }

  return ['引言', '主要内容', '总结']
}

/**
 * 从内容中提取章节结构
 */
export function extractSectionsFromContent(
  content: string
): Array<{ heading: string; content: string; order: number }> {
  const headingRegex = /^##\s+(.+)$/gm
  const matches = content.match(headingRegex)

  if (matches) {
    return matches.map((match, index) => ({
      heading: match.replace(/^##\s+/, ''),
      content: '',
      order: index,
    }))
  }

  return [
    { heading: '引言', content: '', order: 0 },
    { heading: '主要内容', content: '', order: 1 },
    { heading: '总结', content: '', order: 2 },
  ]
}

/**
 * 提取相似度分数
 */
export function extractSimilarity<Req, Res>(cachedData: CachedResponse<Req, Res>): number {
  if (cachedData.signature && 'similarity' in cachedData.signature) {
    return (cachedData.signature as Record<string, unknown>).similarity as number
  }

  if (cachedData.signature.embedding && cachedData.signature.embedding[0]) {
    const value = cachedData.signature.embedding[0]
    return Math.max(0, Math.min(1, Math.abs(value)))
  }

  return CACHE_CONFIG.SIMILARITY_THRESHOLD
}

/**
 * 验证并转换语气类型
 */
export function validateAndCastTone(tone: string): WritingPlan['tone'] {
  const validTones: WritingPlan['tone'][] = ['formal', 'casual', 'technical', 'academic']

  if (validTones.includes(tone as WritingPlan['tone'])) {
    return tone as WritingPlan['tone']
  }

  console.warn(`Invalid tone in cache: ${tone}, using default 'technical'`)
  return 'technical'
}
