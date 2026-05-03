/**
 * 徐健风格写作智能体 - 个性化版本
 *
 * 基于对徐健写作风格的分析，创建能够模仿其写作风格的智能体
 */

import { WriterAgent, WriterAgentConfig } from '@yunpat/agent-writer'
import { xuJianWritingStyle, createStyledWritingTask } from '../config/writing-style-xujian.js'

/**
 * 创建徐健风格的写作智能体
 */
export function createXuJianStyleWriter(config: WriterAgentConfig) {
  return new WriterAgent({
    ...config,
    name: 'xujian-writer',
    description: '徐健风格技术写作助手 - 专业、结构化、案例丰富',
  })
}

/**
 * 使用徐健风格生成文档
 *
 * @param topic 写作主题
 * @param config WriterAgent 基础配置
 * @returns 生成的文档
 *
 * @example
 * ```typescript
 * const result = await writeInXuJianStyle(
 *   'Docker 容器化技术的优势',
 *   { eventBus, memory, tools, llm }
 * );
 * ```
 */
export async function writeInXuJianStyle(topic: string, config: WriterAgentConfig) {
  // 创建徐健风格智能体
  const writer = createXuJianStyleWriter(config)

  // 使用风格化任务
  const task = createStyledWritingTask(topic)

  // 执行写作
  const result = await writer.execute(task)

  return result
}

/**
 * 批量生成多个主题（使用徐健风格）
 *
 * @param topics 主题数组
 * @param config WriterAgent 基础配置
 */
export async function batchWriteInXuJianStyle(topics: string[], config: WriterAgentConfig) {
  const writer = createXuJianStyleWriter(config)
  const results = []

  for (const topic of topics) {
    console.log(`\n📝 正在生成：${topic}`)
    const task = createStyledWritingTask(topic)
    const result = await writer.execute(task)
    results.push(result)
  }

  return results
}

/**
 * 从现有文档学习写作风格
 *
 * @param sampleDocuments 文档样本路径数组
 * @returns 提取的风格配置
 */
export async function learnWritingStyleFromDocuments(
  sampleDocuments: string[]
): Promise<typeof xuJianWritingStyle> {
  // TODO: 实现自动风格分析
  // 1. 读取文档
  // 2. 分析词汇、句式、结构
  // 3. 提取共同特征
  // 4. 生成风格配置

  console.log('📚 正在学习写作风格...')
  console.log(`分析 ${sampleDocuments.length} 个文档样本`)

  // 暂时返回预设风格
  return xuJianWritingStyle
}

// ========== 使用示例 ==========

/**
 * 示例 1：生成技术文档
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function example1_TechDoc() {
  const result = await writeInXuJianStyle('微服务架构的设计原则', {
    eventBus: null as any,
    memory: null as any,
    tools: null as any,
    llm: null as any,
  })

  console.log(result.document.content)
}

/**
 * 示例 2：生成系统设计文档
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function example2_SystemDesign() {
  const result = await writeInXuJianStyle('WebChat 协作系统架构设计', {
    eventBus: null as any,
    memory: null as any,
    tools: null as any,
    llm: null as any,
  })

  console.log(result.document.content)
}

/**
 * 示例 3：批量生成
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function example3_Batch() {
  const topics = ['Docker 容器化技术', 'AI 模型部署最佳实践', '专利审查指南']

  const results = await batchWriteInXuJianStyle(topics, {
    eventBus: null as any,
    memory: null as any,
    tools: null as any,
    llm: null as any,
  })

  results.forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.document.title}`)
    console.log(`字数：${result.stats.wordCount}`)
  })
}

/**
 * 示例 4：持续优化风格
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function example4_RefineStyle() {
  const mockConfig = {
    eventBus: null as any,
    memory: null as any,
    tools: null as any,
    llm: null as any,
  }

  // 第一次生成
  const v1 = await writeInXuJianStyle('测试主题', mockConfig)
  void v1 // 标记为有意未使用

  // 根据结果调整风格配置
  const refinedStyle = {
    ...xuJianWritingStyle,
    // 调整后的配置...
  }
  void refinedStyle // 标记为有意未使用

  // 第二次生成（使用优化后的风格）
  const v2 = await writeInXuJianStyle('测试主题', mockConfig)
  void v2 // 标记为有意未使用
}

/**
 * 示例 5：风格对比分析
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function example5_StyleComparison() {
  console.log('📊 风格特征对比：')
  console.log('\n【徐健风格】')
  console.log('- 开头：直接切入主题')
  console.log('- 语气：专业但不刻板')
  console.log('- 结构：金字塔原理（结论先行）')
  console.log('- 举例：大量使用实际案例')
  console.log('- 格式：Markdown + 表格 + 列表')

  console.log('\n【标准技术文档风格】')
  console.log('- 开头：通常有背景介绍')
  console.log('- 语气：客观、中立')
  console.log('- 结构：线性论述')
  console.log('- 举例：少量或无举例')
  console.log('- 格式：纯 Markdown，较少使用表格')

  console.log('\n【学术文档风格】')
  console.log('- 开头：摘要 + 引言')
  console.log('- 语气：正式、严谨')
  console.log('- 结构：引言 → 方法 → 结果 → 讨论')
  console.log('- 举例：实验数据和图表')
  console.log('- 格式：严格的学术格式')
}
