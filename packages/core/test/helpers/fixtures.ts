/**
 * 测试固定数据
 *
 * 提供可复用的测试数据，避免在每个测试文件中重复定义
 */

import type { ChatMessage } from '../../src/lifecycle/Lifecycle.js'

export const SAMPLE_MESSAGES: ChatMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello, write a patent claim.' },
]

export const SAMPLE_CHAT_RESPONSE = {
  message: {
    role: 'assistant' as const,
    content: 'A patent claim comprising: ...',
  },
  usage: {
    promptTokens: 20,
    completionTokens: 15,
    totalTokens: 35,
  },
}

export const SAMPLE_TOOLS = [
  { name: 'search-patent', description: 'Search patent database' },
  { name: 'analyze-claim', description: 'Analyze patent claims' },
  { name: 'generate-text', description: 'Generate text content' },
]

export const SAMPLE_MEMORY_ENTRIES: Record<string, unknown> = {
  'session-context': { topic: 'patent-drafting', step: 3 },
  'user-preference': { language: 'zh-CN', detail: 'high' },
  'draft-progress': { completed: ['abstract', 'claims'], pending: ['description'] },
}
