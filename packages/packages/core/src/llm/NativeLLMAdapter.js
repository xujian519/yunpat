/**
 * 国产大模型 + 本地模型适配器
 *
 * 优先支持：
 * - DeepSeek (深度求索)
 * - 通义千问 (阿里)
 * - 文心一言 (百度)
 * - 智谱 GLM
 * - 本地模型 (Ollama)
 */
import { EmbeddingError, EmbeddingErrorCode } from './EmbeddingProvider.js'
/**
 * 支持的国产模型列表
 */
export var NativeModel
;(function (NativeModel) {
  /** DeepSeek V4 (深度求索) - 2025 新版本 */
  NativeModel['DEEPSEEK_V4_FLASH'] = 'deepseek-v4-flash'
  NativeModel['DEEPSEEK_V4_PRO'] = 'deepseek-v4-pro'
  /** DeepSeek 旧版本 (将于 2026/07/24 弃用) */
  NativeModel['DEEPSEEK_CHAT'] = 'deepseek-chat'
  NativeModel['DEEPSEEK_CODER'] = 'deepseek-coder'
  /** 通义千问 (阿里) */
  NativeModel['QWEN_TURBO'] = 'qwen-turbo'
  NativeModel['QWEN_PLUS'] = 'qwen-plus'
  NativeModel['QWEN_MAX'] = 'qwen-max'
  /** 文心一言 (百度) */
  NativeModel['ERNIE_BOT_TURBO'] = 'ernie-bot-turbo'
  NativeModel['ERNIE_BOT'] = 'ernie-bot'
  NativeModel['ERNIE_BOT_4'] = 'ernie-bot-4'
  /** 智谱 GLM */
  NativeModel['GLM_5_1'] = 'glm-5.1'
  NativeModel['GLM_4_7_FLASH'] = 'glm-4.7-flash'
  NativeModel['GLM_4_7'] = 'glm-4.7'
  NativeModel['GLM_4_6_V'] = 'glm-4.6-v'
  NativeModel['GLM_4_FLASH'] = 'glm-4-flash'
  NativeModel['GLM_4_PLUS'] = 'glm-4-plus'
  NativeModel['GLM_4_AIR'] = 'glm-4-air'
  NativeModel['GLM_4'] = 'glm-4'
  NativeModel['GLM_3_TURBO'] = 'glm-3-turbo'
  /** 本地模型 (Ollama) */
  NativeModel['OLLAMA_LLAMA3'] = 'ollama/llama3'
  NativeModel['OLLAMA_MISTRAL'] = 'ollama/mistral'
  NativeModel['OLLAMA_QWEN'] = 'ollama/qwen'
})(NativeModel || (NativeModel = {}))
/**
 * 模型提供商
 */
export var ModelProvider
;(function (ModelProvider) {
  /** DeepSeek */
  ModelProvider['DEEPSEEK'] = 'deepseek'
  /** 阿里云 */
  ModelProvider['ALIYUN'] = 'aliyun'
  /** 百度千帆 */
  ModelProvider['BAIDU'] = 'baidu'
  /** 智谱 */
  ModelProvider['ZHIPU'] = 'zhipu'
  /** 本地 Ollama */
  ModelProvider['OLLAMA'] = 'ollama'
})(ModelProvider || (ModelProvider = {}))
/**
 * 默认配置
 */
const DEFAULT_CONFIGS = {
  [ModelProvider.DEEPSEEK]: {
    baseURL: 'https://api.deepseek.com',
    temperature: 0.7,
    maxTokens: 4096,
  },
  [ModelProvider.ALIYUN]: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    temperature: 0.7,
    maxTokens: 4096,
  },
  [ModelProvider.BAIDU]: {
    baseURL: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
    temperature: 0.7,
    maxTokens: 4096,
  },
  [ModelProvider.ZHIPU]: {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    temperature: 0.7,
    maxTokens: 4096,
  },
  [ModelProvider.OLLAMA]: {
    baseURL: 'http://localhost:11434/v1',
    temperature: 0.7,
    maxTokens: 4096,
  },
}
/**
 * 国产大模型适配器
 *
 * 支持多个国产大模型和本地模型，提供统一的接口
 */
export class NativeLLMAdapter {
  config
  provider
  constructor(config) {
    // 检测提供商
    this.provider = this.detectProvider(config.name)
    // 合并默认配置
    const defaultConfig = DEFAULT_CONFIGS[this.provider]
    this.config = {
      ...defaultConfig,
      ...config,
    }
  }
  /**
   * 检测模型提供商
   */
  detectProvider(modelName) {
    if (modelName.startsWith('deepseek')) {
      return ModelProvider.DEEPSEEK
    }
    if (modelName.startsWith('qwen') || modelName.startsWith('ollama/qwen')) {
      return ModelProvider.ALIYUN
    }
    if (modelName.startsWith('ernie')) {
      return ModelProvider.BAIDU
    }
    if (modelName.startsWith('glm')) {
      return ModelProvider.ZHIPU
    }
    if (modelName.startsWith('ollama/')) {
      return ModelProvider.OLLAMA
    }
    // 默认使用 DeepSeek
    return ModelProvider.DEEPSEEK
  }
  /**
   * 聊天 - 单次调用
   */
  async chat(params) {
    const url = `${this.config.baseURL}/chat/completions`
    // 构建请求体
    const body = {
      model: this.config.name,
      messages: params.messages,
      temperature: params.temperature ?? this.config.temperature,
      max_tokens: params.maxTokens ?? this.config.maxTokens,
      stream: false,
    }
    // 添加 DeepSeek V4 特有参数
    if (this.config.thinking) {
      body.thinking = this.config.thinking
    }
    if (this.config.reasoningEffort) {
      body.reasoning_effort = this.config.reasoningEffort
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout ?? 60000),
      })
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      const choices = data.choices
      const message = choices[0].message
      const usage = data.usage
      return {
        message: {
          role: 'assistant',
          content: message.content,
        },
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0,
            }
          : undefined,
      }
    } catch (error) {
      throw new Error(`LLM 调用失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  /**
   * 聊天 - 流式调用
   */
  async *chatStream(params) {
    const url = `${this.config.baseURL}/chat/completions`
    const body = {
      model: this.config.name,
      messages: params.messages,
      temperature: params.temperature ?? this.config.temperature,
      max_tokens: params.maxTokens ?? this.config.maxTokens,
      stream: true,
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout ?? 60000),
      })
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`)
      }
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              yield { delta: '', done: true }
              return
            }
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices[0]?.delta?.content || ''
              if (content) {
                yield {
                  delta: content,
                  done: false,
                }
              }
            } catch (e) {
              // 跳过解析失败的行
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`LLM 流式调用失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  /**
   * 嵌入 - 生成向量
   *
   * 支持的嵌入端点：
   * - DeepSeek: 使用 OpenAI 兼容的 /embeddings 端点
   * - 通义千问: 使用 DashScope 嵌入 API
   * - 智谱 GLM: 使用 GLM 嵌入 API
   */
  async embed(texts) {
    if (texts.length === 0) {
      return []
    }
    // 根据提供商选择嵌入实现
    switch (this.provider) {
      case ModelProvider.DEEPSEEK:
        return await this.embedDeepSeek(texts)
      case ModelProvider.ALIYUN:
        return await this.embedQwen(texts)
      case ModelProvider.ZHIPU:
        return await this.embedZhipu(texts)
      case ModelProvider.OLLAMA:
        return await this.embedOllama(texts)
      default:
        throw new EmbeddingError(
          `提供商 ${this.provider} 不支持嵌入功能`,
          EmbeddingErrorCode.MODEL_UNAVAILABLE,
          this.provider
        )
    }
  }
  /**
   * DeepSeek 嵌入
   *
   * 使用 OpenAI 兼容的 /embeddings 端点
   * 模型: deepseek-ai/deepseek-v2-lite (支持 1024 维)
   */
  async embedDeepSeek(texts) {
    const url = `${this.config.baseURL}/embeddings`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-ai/deepseek-v2-lite',
          input: texts,
          encoding_format: 'float',
        }),
        signal: AbortSignal.timeout(this.config.timeout ?? 60000),
      })
      if (!response.ok) {
        throw new EmbeddingError(
          `DeepSeek 嵌入 API 请求失败: ${response.status}`,
          EmbeddingErrorCode.API_ERROR,
          'deepseek'
        )
      }
      const data = await response.json()
      const embeddingsData = data.data
      // DeepSeek 返回 1024 维向量
      return embeddingsData.sort((a, b) => a.index - b.index).map((item) => item.embedding)
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error
      }
      throw new EmbeddingError(
        `DeepSeek 嵌入失败: ${error instanceof Error ? error.message : String(error)}`,
        EmbeddingErrorCode.API_ERROR,
        'deepseek'
      )
    }
  }
  /**
   * 通义千问嵌入
   *
   * 使用 DashScope text-embedding-v3 模型
   * 维度: 1024
   */
  async embedQwen(texts) {
    const url =
      'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-v3',
          input: {
            texts: texts,
          },
          parameters: {
            text_type: 'document',
          },
        }),
        signal: AbortSignal.timeout(this.config.timeout ?? 60000),
      })
      if (!response.ok) {
        throw new EmbeddingError(
          `通义千问嵌入 API 请求失败: ${response.status}`,
          EmbeddingErrorCode.API_ERROR,
          'qwen'
        )
      }
      const data = await response.json()
      const embeddingsData = data.output
      const embeddings = embeddingsData.embeddings
      // text-embedding-v3 返回 1024 维向量
      return embeddings.map((item) => item.embedding)
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error
      }
      throw new EmbeddingError(
        `通义千问嵌入失败: ${error instanceof Error ? error.message : String(error)}`,
        EmbeddingErrorCode.API_ERROR,
        'qwen'
      )
    }
  }
  /**
   * 智谱 GLM 嵌入
   *
   * 使用 Embedding-3 模型
   * 维度: 1024
   */
  async embedZhipu(texts) {
    const url = `${this.config.baseURL}/embeddings`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'embedding-3',
          input: texts,
        }),
        signal: AbortSignal.timeout(this.config.timeout ?? 60000),
      })
      if (!response.ok) {
        throw new EmbeddingError(
          `智谱 GLM 嵌入 API 请求失败: ${response.status}`,
          EmbeddingErrorCode.API_ERROR,
          'zhipu'
        )
      }
      const data = await response.json()
      const embeddingsData = data.data
      // Embedding-3 返回 1024 维向量
      return embeddingsData.sort((a, b) => a.index - b.index).map((item) => item.embedding)
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error
      }
      throw new EmbeddingError(
        `智谱 GLM 嵌入失败: ${error instanceof Error ? error.message : String(error)}`,
        EmbeddingErrorCode.API_ERROR,
        'zhipu'
      )
    }
  }
  /**
   * Ollama 嵌入
   *
   * 使用本地 Ollama 嵌入端点
   * 默认模型: nomic-embed-text (768 维)
   */
  async embedOllama(texts) {
    const url = `${this.config.baseURL}/embeddings`
    try {
      // Ollama 不支持批量，需要逐个处理
      const embeddings = []
      for (const text of texts) {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: text,
          }),
          signal: AbortSignal.timeout(this.config.timeout ?? 60000),
        })
        if (!response.ok) {
          throw new EmbeddingError(
            `Ollama 嵌入 API 请求失败: ${response.status}`,
            EmbeddingErrorCode.API_ERROR,
            'ollama'
          )
        }
        const data = await response.json()
        const embedding = data.embedding
        embeddings.push(embedding)
      }
      return embeddings
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error
      }
      throw new EmbeddingError(
        `Ollama 嵌入失败: ${error instanceof Error ? error.message : String(error)}`,
        EmbeddingErrorCode.API_ERROR,
        'ollama'
      )
    }
  }
  /**
   * 切换模型
   */
  switchModel(modelName) {
    this.provider = this.detectProvider(modelName)
    const defaultConfig = DEFAULT_CONFIGS[this.provider]
    this.config = {
      ...defaultConfig,
      ...this.config,
      name: modelName,
    }
  }
  /**
   * 获取当前提供商
   */
  getProvider() {
    return this.provider
  }
  /**
   * 获取当前模型
   */
  getModel() {
    return this.config.name
  }
}
/**
 * 多模型管理器
 *
 * 管理多个模型实例，支持模型路由和负载均衡
 */
export class MultiModelManager {
  adapters = new Map()
  defaultModel
  constructor(defaultModel = NativeModel.DEEPSEEK_CHAT) {
    this.defaultModel = defaultModel
  }
  /**
   * 注册模型
   */
  registerModel(name, config) {
    const adapter = new NativeLLMAdapter(config)
    this.adapters.set(name, adapter)
  }
  /**
   * 获取模型适配器
   */
  getAdapter(model) {
    const modelName = model ?? this.defaultModel
    const adapter = this.adapters.get(modelName)
    if (!adapter) {
      throw new Error(`模型未注册: ${modelName}`)
    }
    return adapter
  }
  /**
   * 智能模型选择
   *
   * 根据任务类型自动选择最合适的模型
   */
  selectModelForTask(taskType) {
    switch (taskType) {
      case 'code':
        return NativeModel.DEEPSEEK_CODER
      case 'chat':
        return NativeModel.DEEPSEEK_CHAT
      case 'analysis':
        return NativeModel.QWEN_MAX
      default:
        return this.defaultModel
    }
  }
  /**
   * 获取所有可用模型
   */
  listModels() {
    return Array.from(this.adapters.keys())
  }
}
/**
 * 快速创建函数
 */
/**
 * 创建 DeepSeek 模型（推荐使用 V4 版本）
 */
export function createDeepSeekModel(apiKey, model, options) {
  return new NativeLLMAdapter({
    name: model ?? NativeModel.DEEPSEEK_V4_PRO,
    apiKey,
    baseURL: DEFAULT_CONFIGS[ModelProvider.DEEPSEEK].baseURL,
    thinking: options?.thinking,
    reasoningEffort: options?.reasoningEffort,
  })
}
/**
 * 创建通义千问模型
 */
export function createQwenModel(apiKey, model) {
  return new NativeLLMAdapter({
    name: model ?? NativeModel.QWEN_PLUS,
    apiKey,
    baseURL: DEFAULT_CONFIGS[ModelProvider.ALIYUN].baseURL,
  })
}
/**
 * 创建智谱 GLM 模型（推荐使用 GLM-4.7）
 */
export function createZhipuModel(apiKey, model) {
  return new NativeLLMAdapter({
    name: model ?? NativeModel.GLM_4_7,
    apiKey,
    baseURL: DEFAULT_CONFIGS[ModelProvider.ZHIPU].baseURL,
  })
}
/**
 * 创建本地 Ollama 模型
 */
export function createOllamaModel(model = 'llama3') {
  return new NativeLLMAdapter({
    name: `ollama/${model}`,
    apiKey: 'ollama', // Ollama 不需要 API Key
    baseURL: DEFAULT_CONFIGS[ModelProvider.OLLAMA].baseURL,
  })
}
//# sourceMappingURL=NativeLLMAdapter.js.map
