/**
 * OMLX 本地模型适配器
 *
 * OMLX 是本地部署的大模型服务，兼容 OpenAI API 格式
 * 端口：8009
 */

import {
  LLMAdapter as ILLMAdapter,
  ChatParams,
  ChatResponse,
  ChatChunk,
} from '../lifecycle/Lifecycle.js';

/**
 * OMLX 配置
 */
export interface OMLXConfig {
  /** API 基础 URL */
  baseURL: string;

  /** API 密钥（OMXL 可能需要） */
  apiKey?: string;

  /** 模型名称 */
  modelName?: string;

  /** 温度 */
  temperature?: number;

  /** 最大 Token 数 */
  maxTokens?: number;

  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * OMLX 适配器
 *
 * 连接本地 OMLX 服务
 */
export class OMLXAdapter implements ILLMAdapter {
  private config: OMLXConfig;

  constructor(config: OMLXConfig) {
    this.config = {
      ...config,
      modelName: config.modelName || 'gemma-4-e2b-it-4bit',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      timeout: config.timeout ?? 60000,
    };
  }

  /**
   * 聊天 - 单次调用
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    const url = `${this.config.baseURL}/chat/completions`;

    const body = {
      model: this.config.modelName,
      messages: params.messages,
      temperature: params.temperature ?? this.config.temperature,
      max_tokens: params.maxTokens ?? this.config.maxTokens,
      stream: false,
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 如果有 API Key，添加到请求头
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        throw new Error(`OMXL API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      return {
        message: {
          role: 'assistant',
          content: data.choices[0].message.content,
        },
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            }
          : undefined,
      };
    } catch (error) {
      throw new Error(`OMXL 调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 聊天 - 流式调用
   */
  async *chatStream(params: ChatParams): AsyncIterable<ChatChunk> {
    const url = `${this.config.baseURL}/chat/completions`;

    const body = {
      model: this.config.modelName,
      messages: params.messages,
      temperature: params.temperature ?? this.config.temperature,
      max_tokens: params.maxTokens ?? this.config.maxTokens,
      stream: true,
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        throw new Error(`OMXL API 请求失败: ${response.status} ${response.statusText}`);
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
        `OMXL 流式调用失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 嵌入 - 生成向量
   */
  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error('OMXL 嵌入功能尚未实现');
  }
}

/**
 * 快速创建 OMLX 适配器
 */
export function createOMXLModel(apiKey?: string): OMLXAdapter {
  return new OMLXAdapter({
    baseURL: 'http://localhost:8009/v1',
    apiKey,
    modelName: 'gemma-4-e2b-it-4bit',
  });
}
