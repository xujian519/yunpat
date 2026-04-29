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

/**
 * 支持的国产模型列表
 */
export enum NativeModel {
  /** DeepSeek (深度求索) */
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
  GLM_4 = 'glm-4',
  GLM_4_AIR = 'glm-4-air',
  GLM_3_TURBO = 'glm-3-turbo',

  /** 本地模型 (Ollama) */
  OLLAMA_LLAMA3 = 'ollama/llama3',
  OLLAMA_MISTRAL = 'ollama/mistral',
  OLLAMA_QWEN = 'ollama/qwen',
}

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
    baseURL: 'https://api.deepseek.com/v1',
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

    const body = {
      model: this.config.name,
      messages: params.messages,
      temperature: params.temperature ?? this.config.temperature,
      max_tokens: params.maxTokens ?? this.config.maxTokens,
      stream: false,
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
   * TODO: 实现嵌入功能
   */
  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error('嵌入功能尚未实现');
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
 * 创建 DeepSeek 模型
 */
export function createDeepSeekModel(apiKey: string, model?: NativeModel): NativeLLMAdapter {
  return new NativeLLMAdapter({
    name: model ?? NativeModel.DEEPSEEK_CHAT,
    apiKey,
    baseURL: DEFAULT_CONFIGS[ModelProvider.DEEPSEEK].baseURL!,
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
 * 创建本地 Ollama 模型
 */
export function createOllamaModel(model: string = 'llama3'): NativeLLMAdapter {
  return new NativeLLMAdapter({
    name: `ollama/${model}`,
    apiKey: 'ollama', // Ollama 不需要 API Key
    baseURL: DEFAULT_CONFIGS[ModelProvider.OLLAMA].baseURL!,
  });
}
