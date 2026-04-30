/**
 * Kimi Code 适配器
 *
 * Kimi Code 是 Kimi 会员权益中专为开发者提供的智能编程服务
 * API 文档: https://www.kimi.com/code/docs/
 *
 * 特点：
 * - 最高输出速度可达 100 Tokens/s
 * - 每 5 小时支持约 300–1200 次请求
 * - 最高并发 30
 * - 专为编程场景设计
 */

import {
  LLMAdapter as ILLMAdapter,
  ChatParams,
  ChatResponse,
  ChatChunk,
} from '../lifecycle/Lifecycle.js';

/**
 * Kimi Code 模型 ID
 */
export const KIMI_CODE_MODEL = 'kimi-for-coding';

/**
 * Kimi Code 配置
 */
export interface KimiCodeConfig {
  /** API 密钥 */
  apiKey: string;

  /** API 基础 URL（OpenAI 兼容） */
  baseURL?: string;

  /** 模型 ID（固定为 kimi-for-coding） */
  model?: string;

  /** 温度 */
  temperature?: number;

  /** 最大 Token 数 */
  maxTokens?: number;

  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  baseURL: 'https://api.kimi.com/coding/v1',
  model: KIMI_CODE_MODEL,
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 60000,
};

/**
 * Kimi Code 适配器
 *
 * 提供 OpenAI 兼容的 API 接口
 */
export class KimiCodeAdapter implements ILLMAdapter {
  private config: Required<KimiCodeConfig>;

  constructor(config: KimiCodeConfig) {
    this.config = {
      baseURL: config.baseURL ?? DEFAULT_CONFIG.baseURL,
      model: config.model ?? DEFAULT_CONFIG.model,
      apiKey: config.apiKey,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxTokens: config.maxTokens ?? DEFAULT_CONFIG.maxTokens,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
    };
  }

  /**
   * 聊天 - 单次调用
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    const url = `${this.config.baseURL}/chat/completions`;

    const body = {
      model: this.config.model,
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
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Kimi Code API 请求失败: ${response.status} ${response.statusText}\n${errorText}`
        );
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
      throw new Error(
        `Kimi Code 调用失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 聊天 - 流式调用
   */
  async *chatStream(params: ChatParams): AsyncIterable<ChatChunk> {
    const url = `${this.config.baseURL}/chat/completions`;

    const body = {
      model: this.config.model,
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
        signal: AbortSignal.timeout(this.config.timeout),
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
        `Kimi Code 流式调用失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 嵌入 - Kimi Code 不支持嵌入功能
   */
  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error('Kimi Code 不支持嵌入功能，请使用 BGE-M3 或其他嵌入模型');
  }

  /**
   * 获取模型信息
   */
  getModelInfo(): { model: string; baseURL: string } {
    return {
      model: this.config.model,
      baseURL: this.config.baseURL,
    };
  }
}

/**
 * 快速创建 Kimi Code 适配器
 *
 * @param apiKey Kimi Code API Key（从 Kimi Code 控制台获取）
 * @param config 可选配置
 */
export function createKimiCodeAdapter(
  apiKey: string,
  config?: Partial<KimiCodeConfig>
): KimiCodeAdapter {
  return new KimiCodeAdapter({
    apiKey,
    ...config,
  });
}

/**
 * Kimi Code 使用示例
 *
 * @example
 * ```typescript
 * import { createKimiCodeAdapter } from '@yunpat/core';
 *
 * const kimi = createKimiCodeAdapter(process.env.KIMI_CODE_API_KEY);
 *
 * // 代码生成
 * const response = await kimi.chat({
 *   messages: [
 *     { role: 'user', content: '用 TypeScript 写一个快速排序算法' }
 *   ],
 *   maxTokens: 2000,
 * });
 *
 * console.log(response.message.content);
 * ```
 */
