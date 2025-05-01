/**
 * @file 模型配置
 * @description 支持多种 LLM 提供商
 */

/**
 * 模型提供商类型
 */
export type ModelProvider = 'anthropic' | 'openai' | 'zhipu' | 'omlx'

/**
 * LLM 配置
 */
export interface LLMConfig {
  /** 提供商 */
  provider: ModelProvider
  /** 模型名称 */
  model: string
  /** API 密钥 */
  apiKey?: string
  /** API 基础 URL */
  baseURL?: string
  /** 温度 */
  temperature?: number
  /** 最大 Token 数 */
  maxTokens?: number
}

/**
 * 多模态模型配置
 */
export interface MultimodalConfig {
  /** 提供商 */
  provider: ModelProvider
  /** 模型名称 */
  model: string
  /** API 基础 URL */
  baseURL: string
  /** API 密钥 */
  apiKey?: string
}

/**
 * 嵌入模型配置
 */
export interface EmbeddingConfig {
  /** 提供商 */
  provider: ModelProvider
  /** 模型名称 */
  model: string
  /** API 基础 URL */
  baseURL: string
  /** API 密钥 */
  apiKey?: string
}

/**
 * Rerank 模型配置
 */
export interface RerankConfig {
  /** 提供商 */
  provider: ModelProvider
  /** 模型名称 */
  model: string
  /** API 基础 URL */
  baseURL: string
  /** API 密钥 */
  apiKey?: string
}

/**
 * 完整模型配置
 */
export interface ModelConfigs {
  /** 主 LLM 配置 */
  llm: LLMConfig
  /** 多模态配置 */
  multimodal?: MultimodalConfig
  /** 嵌入配置 */
  embedding?: EmbeddingConfig
  /** Rerank 配置 */
  rerank?: RerankConfig
}

/**
 * 默认配置 - 使用 GLM 编程套餐 + oMLX
 */
export const defaultModelConfigs: ModelConfigs = {
  // 主 LLM - 智谱 GLM-4.7 Flash (编程套餐)
  llm: {
    provider: 'zhipu',
    model: process.env.ZHIPU_MODEL || 'glm-4.7-flash',
    apiKey: process.env.ZHIPU_API_KEY,
    temperature: 0.7,
    maxTokens: 8192,
  },
  // 多模态 - oMLX (本地 8009 端口)
  multimodal: {
    provider: 'omlx',
    model: process.env.OMLX_MULTIMODAL_MODEL || 'glm-4v',
    baseURL: process.env.OMLX_BASE_URL || 'http://localhost:8009',
    apiKey: process.env.OMLX_API_KEY,
  },
  // 嵌入 - oMLX
  embedding: {
    provider: 'omlx',
    model: process.env.OMLX_EMBEDDING_MODEL || 'bge-m3',
    baseURL: process.env.OMLX_BASE_URL || 'http://localhost:8009',
    apiKey: process.env.OMLX_API_KEY,
  },
  // Rerank - oMLX
  rerank: {
    provider: 'omlx',
    model: process.env.OMLX_RERANK_MODEL || 'bge-reranker-v2',
    baseURL: process.env.OMLX_BASE_URL || 'http://localhost:8009',
    apiKey: process.env.OMLX_API_KEY,
  },
}

/**
 * 从环境变量加载配置
 */
export function loadConfig(): ModelConfigs {
  // 支持通过 MODEL_PROVIDER 环境变量切换主 LLM 提供商
  const provider = (process.env.MODEL_PROVIDER || 'zhipu') as ModelProvider

  let llm: LLMConfig

  switch (provider) {
    case 'zhipu':
      llm = {
        provider: 'zhipu',
        model: process.env.ZHIPU_MODEL || 'glm-4.7-flash',
        apiKey: process.env.ZHIPU_API_KEY,
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '8192'),
      }
      break
    case 'anthropic':
      llm = {
        provider: 'anthropic',
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        apiKey: process.env.ANTHROPIC_API_KEY,
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '8192'),
      }
      break
    case 'openai':
      llm = {
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '8192'),
      }
      break
    default:
      llm = defaultModelConfigs.llm
  }

  const omlxBaseURL = process.env.OMLX_BASE_URL || 'http://localhost:8009'
  const omlxApiKey = process.env.OMLX_API_KEY

  return {
    llm,
    multimodal: {
      provider: 'omlx',
      model: process.env.OMLX_MULTIMODAL_MODEL || 'glm-4v',
      baseURL: omlxBaseURL,
      apiKey: omlxApiKey,
    },
    embedding: {
      provider: 'omlx',
      model: process.env.OMLX_EMBEDDING_MODEL || 'bge-m3',
      baseURL: omlxBaseURL,
      apiKey: omlxApiKey,
    },
    rerank: {
      provider: 'omlx',
      model: process.env.OMLX_RERANK_MODEL || 'bge-reranker-v2',
      baseURL: omlxBaseURL,
      apiKey: omlxApiKey,
    },
  }
}
