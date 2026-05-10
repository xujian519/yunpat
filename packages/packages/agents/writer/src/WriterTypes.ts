import { type AgentConfig, type EnhancedTool, createSimpleSignatureGenerator } from '@yunpat/core'
import { z } from 'zod'

/** Zod schema for outline validation */
export const OutlineSchema = z.array(z.string())

/** 语义缓存配置常量 */
export const CACHE_CONFIG = {
  SIMILARITY_THRESHOLD: 0.85,
  MAX_CACHE_SIZE: 1000,
  CACHE_EXPIRATION_MS: 7 * 24 * 60 * 60 * 1000,
} as const

/** 生成配置常量 */
export const GENERATION_CONFIG = {
  DEFAULT_TEMPERATURE: 0.7,
  MAX_OUTLINE_RETRIES: 2,
  DEFAULT_DOCUMENT_LENGTH: 1000,
  OPTIMIZE_DOCUMENT_LENGTH: 500,
} as const

/**
 * 写作任务
 */
export interface WritingTask {
  type: 'generate' | 'optimize' | 'convert' | 'format'
  topic: string
  format?: 'markdown' | 'html' | 'pdf'
  requirements?: string[]
  references?: string[]
}

/**
 * 写作计划
 */
export interface WritingPlan {
  outline: string[]
  structure: {
    title: string
    sections: Array<{
      heading: string
      content: string
      order: number
    }>
  }
  tone: 'formal' | 'casual' | 'technical' | 'academic'
  targetLength: number
  incremental?: boolean
  previousContent?: string
  selectedTool?: string
}

/**
 * 写作结果
 */
export interface WritingResult {
  document: {
    title: string
    content: string
    format: string
  }
  stats: {
    wordCount: number
    paragraphCount: number
    sectionCount: number
  }
  metadata: {
    generatedAt: Date
    tone: string
    revision: number
  }
  toolUsageStats?: {
    totalSelections: number
    successfulExecutions: number
    failedExecutions: number
  }
}

/**
 * WriterAgent 配置
 */
export interface WriterAgentConfig {
  eventBus: AgentConfig['eventBus']
  memory: AgentConfig['memory']
  tools: AgentConfig['tools']
  llm: AgentConfig['llm']
  maxIterations?: number
  timeout?: number
  enableTools?: boolean
  enhancedTools?: EnhancedTool[]
}

/** 写作任务签名生成器 */
export const createWritingTaskSignature = createSimpleSignatureGenerator<WritingTask>((task) => {
  const features: string[] = [
    task.type,
    task.topic,
    task.format || 'markdown',
    ...(task.requirements || []),
  ]
  return features
})
