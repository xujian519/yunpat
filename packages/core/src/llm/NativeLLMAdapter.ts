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

import {
  LLMAdapter as ILLMAdapter,
  ChatParams,
  ChatResponse,
  ChatChunk,
} from '../lifecycle/Lifecycle.js';

import { EmbeddingError, EmbeddingErrorCode } from './EmbeddingProvider.js';

/**
 * 支持的国产模型列表
 */
export enum NativeModel {
  /** DeepSeek V4 (深度求索) - 2025 新版本 */
  DEEPSEEK_V4_FLASH = 'deepseek-v4-flash',
  DEEPSEEK_V4_PRO = 'deepseek-v4-pro',

  /** DeepSeek 旧版本 (将于 2026/07/24 弃用) */
  DEEPSEEK_CHAT = 'deepseek-chat',
  DEEPSEEK_CODER = 'deepseek-coder',

  /** 通义千问 (阿里) */
  QWEN_TURBO = 'qwen-turbo',
  QWEN_PLUS = 'qwen-plus',
  QWEN_MAX = 'qwen-max',

  /** 文心一言 (百度) */
  ERNIE_BOT_TURBO = 'ernie-bot-turbo',
  ERNIE_BOT = 'ernie-bot',
  ERNIE_BOT_4 = 'ernie-bot-4',

  /** 智谱 GLM */
  GLM_4_7 = 'glm-4.7', // 2025 最新旗舰
  GLM_4_FLASH = 'glm-4-flash', // 快速响应
  GLM_4_PLUS = 'glm-4-plus', // 平衡性能
  GLM_4_AIR = 'glm-4-air', // 轻量级
  GLM_4 = 'glm-4',
  GLM_3_TURBO = 'glm-3-turbo',

  /** 本地模型 (Ollama) */
  OLLAMA_LLAMA3 = 'ollama/llama3',
  OLLAMA_MISTRAL = 'ollama/mistral',
  OLLAMA_QWEN = 'ollama/qwen',
}

/**
 * 思考模式配置
 */
export interface ThinkingConfig {
  /** 思考模式类型 */
  type: 'enabled' | 'disabled';
}

/**
 * 推理强度
 */
export type ReasoningEffort = 'high' | 'medium' | 'low';

/**
 * 模型配置
 */
export interface ModelConfig {
  /** 模型名称 */
  name: NativeModel | string;

  /** API 基础 URL */
  baseURL: string;

  /** API 密钥 */
  apiKey: string;

  /** 温度 */
  temperature?: number;

  /** 最大 Token 数 */
  maxTokens?: number;

  /** 超时时间（毫秒） */
  timeout?: number;

  /** 思考模式配置（仅 DeepSeek V4 支持） */
  thinking?: ThinkingConfig;

  /** 推理强度（仅 DeepSeek V4 支持） */
  reasoningEffort?: ReasoningEffort;
}

/**
 * 模型提供商
 */
export enum ModelProvider {
  /** DeepSeek */
  DEEPSEEK = 'deepseek',

  /** 阿里云 */
  ALIYUN = 'aliyun',

  /** 百度千帆 */
  BAIDU = 'baidu',

  /** 智谱 */
  ZHIPU = 'zhipu',

  /** 本地 Ollama */
  OLLAMA = 'ollama',
}

/**
 * 默认配置
 */
const DEFAULT_CONFIGS: Record<ModelProvider, Partial<ModelConfig>> = {
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
};

/**
 * 国产大模型适配器
 *
 * 支持多个国产大模型和本地模型，提供统一的接口
 */
export class NativeLLMAdapter implements ILLMAdapter {
  private config: ModelConfig;
  private provider: ModelProvider;

  constructor(config: ModelConfig) {
    // 检测提供商
    this.provider = this.detectProvider(config.name);

    // 合并默认配置
    const defaultConfig = DEFAULT_CONFIGS[this.provider];
    this.config = {
      ...defaultConfig,
      ...config,
    };
  }

  /**
   * 检测模型提供商
   */
  private detectProvider(modelName: string): ModelProvider {
    if (modelName.startsWith('deepseek')) {
      return ModelProvider.DEEPSEEK;
    }
    if (modelName.startsWith('qwen') || modelName.startsWith('ollama/qwen')) {
      return ModelProvider.ALIYUN;
    }
    if (modelName.startsWith('ernie')) {
      return ModelProvider.BAIDU;
    }
    if (modelName.startsWith('glm')) {
      return ModelProvider.ZHIPU;
    }
    if (modelName.startsWith('ollama/')) {
      return ModelProvider.OLLAMA;
    }

    // 默认使用 DeepSeek
    return ModelProvider.DEEPSEEK;
  }

  /**
   * 聊天 - 单次调用
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    const url = `${this.config.baseURL}/chat/completions`;

    // 构建请求体
    const body: Record<string, unknown> = {
      model: this.config.name,
      messages: params.messages,
      temperature: params.temperature ?? this.config.temperature,
      max_tokens: params.maxTokens ?? this.config.maxTokens,
      stream: false,
    };

    // 添加 DeepSeek V4 特有参数
    if (this.config.thinking) {
      body.thinking = this.config.thinking;
    }
    if (this.config.reasoningEffort) {
      body.reasoning_effort = this.config.reasoningEffort;
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
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as Record<string, unknown>;

      const choices = data.choices as Array<Record<string, unknown>>;
      const message = choices[0].message as Record<string, unknown>;
      const usage = data.usage as Record<string, number> | undefined;

      return {
        message: {
          role: 'assistant',
          content: message.content as string,
        },
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0,
            }
          : undefined,
      };
    } catch (error) {
      throw new Error(`LLM 调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 聊天 - 流式调用
   */
  async *chatStream(params: ChatParams): AsyncIterable<ChatChunk> {
    const url = `${this.config.baseURL}/chat/completions`;

    const body = {
      model: this.config.name,
      messages: params.messages,
      temperature: params.temperature ?? this.config.temperature,
      max_tokens: params.maxTokens ?? this.config.maxTokens,
      stream: true,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout ?? 60000),
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { delta: '', done: true };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';

              if (content) {
                yield {
                  delta: content,
                  done: false,
                };
              }
            } catch (e) {
              // 跳过解析失败的行
            }
          }
        }
      }
    } catch (error) {
      throw new Error(
        `LLM 流式调用失败: ${error instanceof Error ? error.message : String(error)}`
      );
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
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // 根据提供商选择嵌入实现
    switch (this.provider) {
      case ModelProvider.DEEPSEEK:
        return await this.embedDeepSeek(texts);
      case ModelProvider.ALIYUN:
        return await this.embedQwen(texts);
      case ModelProvider.ZHIPU:
        return await this.embedZhipu(texts);
      case ModelProvider.OLLAMA:
        return await this.embedOllama(texts);
      default:
        throw new EmbeddingError(
          `提供商 ${this.provider} 不支持嵌入功能`,
          EmbeddingErrorCode.MODEL_UNAVAILABLE,
          this.provider
        );
    }
  }

  /**
   * DeepSeek 嵌入
   *
   * 使用 OpenAI 兼容的 /embeddings 端点
   * 模型: deepseek-ai/deepseek-v2-lite (支持 1024 维)
   */
  private async embedDeepSeek(texts: string[]): Promise<number[][]> {
    const url = `${this.config.baseURL}/embeddings`;

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
      });

      if (!response.ok) {
        throw new EmbeddingError(
          `DeepSeek 嵌入 API 请求失败: ${response.status}`,
          EmbeddingErrorCode.API_ERROR,
          'deepseek'
        );
      }

      const data = (await response.json()) as Record<string, unknown>;
      const embeddingsData = data.data as Array<Record<string, unknown>>;

      // DeepSeek 返回 1024 维向量
      return embeddingsData
        .sort((a, b) => (a.index as number) - (b.index as number))
        .map((item) => item.embedding as number[]);
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      throw new EmbeddingError(
        `DeepSeek 嵌入失败: ${error instanceof Error ? error.message : String(error)}`,
        EmbeddingErrorCode.API_ERROR,
        'deepseek'
      );
    }
  }

  /**
   * 通义千问嵌入
   *
   * 使用 DashScope text-embedding-v3 模型
   * 维度: 1024
   */
  private async embedQwen(texts: string[]): Promise<number[][]> {
    const url =
      'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';

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
      });

      if (!response.ok) {
        throw new EmbeddingError(
          `通义千问嵌入 API 请求失败: ${response.status}`,
          EmbeddingErrorCode.API_ERROR,
          'qwen'
        );
      }

      const data = (await response.json()) as Record<string, unknown>;
      const embeddingsData = data.output as Record<string, unknown>;
      const embeddings = embeddingsData.embeddings as Array<Record<string, unknown>>;

      // text-embedding-v3 返回 1024 维向量
      return embeddings.map((item) => item.embedding as number[]);
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      throw new EmbeddingError(
        `通义千问嵌入失败: ${error instanceof Error ? error.message : String(error)}`,
        EmbeddingErrorCode.API_ERROR,
        'qwen'
      );
    }
  }

  /**
   * 智谱 GLM 嵌入
   *
   * 使用 Embedding-3 模型
   * 维度: 1024
   */
  private async embedZhipu(texts: string[]): Promise<number[][]> {
    const url = `${this.config.baseURL}/embeddings`;

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
      });

      if (!response.ok) {
        throw new EmbeddingError(
          `智谱 GLM 嵌入 API 请求失败: ${response.status}`,
          EmbeddingErrorCode.API_ERROR,
          'zhipu'
        );
      }

      const data = (await response.json()) as Record<string, unknown>;
      const embeddingsData = data.data as Array<Record<string, unknown>>;

      // Embedding-3 返回 1024 维向量
      return embeddingsData
        .sort((a, b) => (a.index as number) - (b.index as number))
        .map((item) => item.embedding as number[]);
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      throw new EmbeddingError(
        `智谱 GLM 嵌入失败: ${error instanceof Error ? error.message : String(error)}`,
        EmbeddingErrorCode.API_ERROR,
        'zhipu'
      );
    }
  }

  /**
   * Ollama 嵌入
   *
   * 使用本地 Ollama 嵌入端点
   * 默认模型: nomic-embed-text (768 维)
   */
  private async embedOllama(texts: string[]): Promise<number[][]> {
    const url = `${this.config.baseURL}/embeddings`;

    try {
      // Ollama 不支持批量，需要逐个处理
      const embeddings: number[][] = [];

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
        });

        if (!response.ok) {
          throw new EmbeddingError(
            `Ollama 嵌入 API 请求失败: ${response.status}`,
            EmbeddingErrorCode.API_ERROR,
            'ollama'
          );
        }

        const data = (await response.json()) as Record<string, unknown>;
        const embedding = data.embedding as number[];
        embeddings.push(embedding);
      }

      return embeddings;
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      throw new EmbeddingError(
        `Ollama 嵌入失败: ${error instanceof Error ? error.message : String(error)}`,
        EmbeddingErrorCode.API_ERROR,
        'ollama'
      );
    }
  }

  /**
   * 切换模型
   */
  switchModel(modelName: NativeModel | string): void {
    this.provider = this.detectProvider(modelName);
    const defaultConfig = DEFAULT_CONFIGS[this.provider];
    this.config = {
      ...defaultConfig,
      ...this.config,
      name: modelName,
    };
  }

  /**
   * 获取当前提供商
   */
  getProvider(): ModelProvider {
    return this.provider;
  }

  /**
   * 获取当前模型
   */
  getModel(): string {
    return this.config.name;
  }
}

/**
 * 多模型管理器
 *
 * 管理多个模型实例，支持模型路由和负载均衡
 */
export class MultiModelManager {
  private adapters = new Map<string, NativeLLMAdapter>();
  private defaultModel: string;

  constructor(defaultModel: NativeModel = NativeModel.DEEPSEEK_CHAT) {
    this.defaultModel = defaultModel;
  }

  /**
   * 注册模型
   */
  registerModel(name: string, config: ModelConfig): void {
    const adapter = new NativeLLMAdapter(config);
    this.adapters.set(name, adapter);
  }

  /**
   * 获取模型适配器
   */
  getAdapter(model?: string): NativeLLMAdapter {
    const modelName = model ?? this.defaultModel;
    const adapter = this.adapters.get(modelName);

    if (!adapter) {
      throw new Error(`模型未注册: ${modelName}`);
    }

    return adapter;
  }

  /**
   * 智能模型选择
   *
   * 根据任务类型自动选择最合适的模型
   */
  selectModelForTask(taskType: 'code' | 'chat' | 'analysis'): string {
    switch (taskType) {
      case 'code':
        return NativeModel.DEEPSEEK_CODER;
      case 'chat':
        return NativeModel.DEEPSEEK_CHAT;
      case 'analysis':
        return NativeModel.QWEN_MAX;
      default:
        return this.defaultModel;
    }
  }

  /**
   * 获取所有可用模型
   */
  listModels(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * 快速创建函数
 */

/**
 * 创建 DeepSeek 模型（推荐使用 V4 版本）
 */
export function createDeepSeekModel(
  apiKey: string,
  model?: NativeModel,
  options?: {
    thinking?: ThinkingConfig;
    reasoningEffort?: ReasoningEffort;
  }
): NativeLLMAdapter {
  return new NativeLLMAdapter({
    name: model ?? NativeModel.DEEPSEEK_V4_PRO,
    apiKey,
    baseURL: DEFAULT_CONFIGS[ModelProvider.DEEPSEEK].baseURL!,
    thinking: options?.thinking,
    reasoningEffort: options?.reasoningEffort,
  });
}

/**
 * 创建通义千问模型
 */
export function createQwenModel(apiKey: string, model?: NativeModel): NativeLLMAdapter {
  return new NativeLLMAdapter({
    name: model ?? NativeModel.QWEN_PLUS,
    apiKey,
    baseURL: DEFAULT_CONFIGS[ModelProvider.ALIYUN].baseURL!,
  });
}

/**
 * 创建智谱 GLM 模型（推荐使用 GLM-4.7）
 */
export function createZhipuModel(apiKey: string, model?: NativeModel): NativeLLMAdapter {
  return new NativeLLMAdapter({
    name: model ?? NativeModel.GLM_4_7,
    apiKey,
    baseURL: DEFAULT_CONFIGS[ModelProvider.ZHIPU].baseURL!,
  });
}

/**
 * 创建本地 Ollama 模型
 */
export function createOllamaModel(model: string = 'llama3'): NativeLLMAdapter {
  return new NativeLLMAdapter({
    name: `ollama/${model}`,
    apiKey: 'ollama', // Ollama 不需要 API Key
    baseURL: DEFAULT_CONFIGS[ModelProvider.OLLAMA].baseURL!,
  });
}
