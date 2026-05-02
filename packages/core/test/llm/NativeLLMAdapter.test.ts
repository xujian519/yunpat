import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NativeLLMAdapter,
  NativeModel,
  ModelProvider,
  MultiModelManager,
  createDeepSeekModel,
  createQwenModel,
  createZhipuModel,
  createOllamaModel,
} from '../../src/llm/NativeLLMAdapter.js';
import { EmbeddingError, EmbeddingErrorCode } from '../../src/llm/EmbeddingProvider.js';

// Mock global fetch
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

describe('NativeLLMAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('应该检测 DeepSeek 提供商', () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      expect(adapter.getProvider()).toBe(ModelProvider.DEEPSEEK);
      expect(adapter.getModel()).toBe(NativeModel.DEEPSEEK_CHAT);
    });

    it('应该检测通义千问提供商', () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.QWEN_PLUS,
        apiKey: 'test-key',
        baseURL: 'https://dashscope.aliyuncs.com',
      });

      expect(adapter.getProvider()).toBe(ModelProvider.ALIYUN);
    });

    it('应该检测百度提供商', () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.ERNIE_BOT,
        apiKey: 'test-key',
        baseURL: 'https://aip.baidubce.com',
      });

      expect(adapter.getProvider()).toBe(ModelProvider.BAIDU);
    });

    it('应该检测智谱提供商', () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.GLM_4,
        apiKey: 'test-key',
        baseURL: 'https://open.bigmodel.cn',
      });

      expect(adapter.getProvider()).toBe(ModelProvider.ZHIPU);
    });

    it('应该检测 Ollama 提供商', () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.OLLAMA_LLAMA3,
        apiKey: 'test-key',
        baseURL: 'http://localhost:11434',
      });

      expect(adapter.getProvider()).toBe(ModelProvider.OLLAMA);
    });

    it('应该默认使用 DeepSeek', () => {
      const adapter = new NativeLLMAdapter({
        name: 'unknown-model',
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect(adapter.getProvider()).toBe(ModelProvider.DEEPSEEK);
    });

    it('应该合并默认配置', () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      expect(adapter.getModel()).toBe(NativeModel.DEEPSEEK_CHAT);
    });
  });

  describe('chat', () => {
    it('应该成功调用 chat', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: '测试回复',
              },
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const result = await adapter.chat({
        messages: [{ role: 'user', content: '你好' }],
      });

      expect(result.message.content).toBe('测试回复');
      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(5);
      expect(result.usage?.totalTokens).toBe(15);
    });

    it('应该在 API 失败时抛出错误', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        adapter.chat({ messages: [{ role: 'user', content: '你好' }] })
      ).rejects.toThrow('API 请求失败');
    });

    it('应该在网络错误时抛出错误', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        adapter.chat({ messages: [{ role: 'user', content: '你好' }] })
      ).rejects.toThrow('LLM 调用失败');
    });

    it('应该支持思考模式参数', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_V4_PRO,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
        thinking: { type: 'enabled' },
        reasoningEffort: 'high',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: '思考后的回复' } }],
        }),
      });

      await adapter.chat({ messages: [{ role: 'user', content: '你好' }] });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.thinking).toEqual({ type: 'enabled' });
      expect(requestBody.reasoning_effort).toBe('high');
    });
  });

  describe('chatStream', () => {
    it('应该返回流式响应', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: [DONE]\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks: Array<{ delta: string; done?: boolean }> = [];
      for await (const chunk of adapter.chatStream({
        messages: [{ role: 'user', content: '你好' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('应该在响应失败时抛出错误', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const generator = adapter.chatStream({ messages: [{ role: 'user', content: '你好' }] });
      await expect(generator.next()).rejects.toThrow('API 请求失败');
    });
  });

  describe('embed', () => {
    it('应该返回空数组对于空输入', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      const result = await adapter.embed([]);
      expect(result).toEqual([]);
    });

    it('应该调用 DeepSeek 嵌入', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { index: 0, embedding: [0.1, 0.2, 0.3] },
            { index: 1, embedding: [0.4, 0.5, 0.6] },
          ],
        }),
      });

      const result = await adapter.embed(['文本1', '文本2']);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([0.1, 0.2, 0.3]);
    });

    it('应该调用通义千问嵌入', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.QWEN_PLUS,
        apiKey: 'test-key',
        baseURL: 'https://dashscope.aliyuncs.com',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            embeddings: [
              { embedding: [0.1, 0.2] },
              { embedding: [0.3, 0.4] },
            ],
          },
        }),
      });

      const result = await adapter.embed(['文本1', '文本2']);
      expect(result).toHaveLength(2);
    });

    it('应该调用智谱嵌入', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.GLM_4,
        apiKey: 'test-key',
        baseURL: 'https://open.bigmodel.cn',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { index: 0, embedding: [0.1, 0.2] },
          ],
        }),
      });

      const result = await adapter.embed(['文本1']);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual([0.1, 0.2]);
    });

    it('应该调用 Ollama 嵌入', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.OLLAMA_LLAMA3,
        apiKey: 'test-key',
        baseURL: 'http://localhost:11434',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
      });

      const result = await adapter.embed(['文本1']);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual([0.1, 0.2, 0.3]);
    });

    it('应该在百度嵌入时抛出错误', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.ERNIE_BOT,
        apiKey: 'test-key',
        baseURL: 'https://aip.baidubce.com',
      });

      await expect(adapter.embed(['文本'])).rejects.toThrow(EmbeddingError);
    });

    it('应该在 API 错误时抛出 EmbeddingError', async () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Error',
      });

      await expect(adapter.embed(['文本'])).rejects.toThrow(EmbeddingError);
    });
  });

  describe('switchModel', () => {
    it('应该切换模型', () => {
      const adapter = new NativeLLMAdapter({
        name: NativeModel.DEEPSEEK_CHAT,
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
      });

      adapter.switchModel(NativeModel.QWEN_PLUS);

      expect(adapter.getModel()).toBe(NativeModel.QWEN_PLUS);
      expect(adapter.getProvider()).toBe(ModelProvider.ALIYUN);
    });
  });
});

describe('MultiModelManager', () => {
  it('应该注册和获取模型', () => {
    const manager = new MultiModelManager();

    manager.registerModel('deepseek', {
      name: NativeModel.DEEPSEEK_CHAT,
      apiKey: 'key1',
      baseURL: 'https://api.deepseek.com',
    });

    const adapter = manager.getAdapter('deepseek');
    expect(adapter).toBeDefined();
    expect(adapter.getModel()).toBe(NativeModel.DEEPSEEK_CHAT);
  });

  it('应该在获取未注册模型时抛出错误', () => {
    const manager = new MultiModelManager();

    expect(() => manager.getAdapter('non-existent')).toThrow('模型未注册');
  });

  it('应该返回默认模型', () => {
    const manager = new MultiModelManager(NativeModel.QWEN_PLUS);

    manager.registerModel(NativeModel.QWEN_PLUS, {
      name: NativeModel.QWEN_PLUS,
      apiKey: 'key1',
      baseURL: 'https://dashscope.aliyuncs.com',
    });

    const adapter = manager.getAdapter();
    expect(adapter.getModel()).toBe(NativeModel.QWEN_PLUS);
  });

  it('应该根据任务类型选择模型', () => {
    const manager = new MultiModelManager();

    expect(manager.selectModelForTask('code')).toBe(NativeModel.DEEPSEEK_CODER);
    expect(manager.selectModelForTask('chat')).toBe(NativeModel.DEEPSEEK_CHAT);
    expect(manager.selectModelForTask('analysis')).toBe(NativeModel.QWEN_MAX);
  });

  it('应该列出所有模型', () => {
    const manager = new MultiModelManager();

    manager.registerModel('model1', {
      name: NativeModel.DEEPSEEK_CHAT,
      apiKey: 'key1',
      baseURL: 'https://api.deepseek.com',
    });
    manager.registerModel('model2', {
      name: NativeModel.QWEN_PLUS,
      apiKey: 'key2',
      baseURL: 'https://dashscope.aliyuncs.com',
    });

    const models = manager.listModels();
    expect(models).toContain('model1');
    expect(models).toContain('model2');
  });
});

describe('工厂函数', () => {
  it('createDeepSeekModel 应该创建 DeepSeek 适配器', () => {
    const adapter = createDeepSeekModel('test-key');
    expect(adapter.getProvider()).toBe(ModelProvider.DEEPSEEK);
    expect(adapter.getModel()).toBe(NativeModel.DEEPSEEK_V4_PRO);
  });

  it('createDeepSeekModel 应该支持自定义模型', () => {
    const adapter = createDeepSeekModel('test-key', NativeModel.DEEPSEEK_CHAT);
    expect(adapter.getModel()).toBe(NativeModel.DEEPSEEK_CHAT);
  });

  it('createQwenModel 应该创建通义千问适配器', () => {
    const adapter = createQwenModel('test-key');
    expect(adapter.getProvider()).toBe(ModelProvider.ALIYUN);
    expect(adapter.getModel()).toBe(NativeModel.QWEN_PLUS);
  });

  it('createZhipuModel 应该创建智谱适配器', () => {
    const adapter = createZhipuModel('test-key');
    expect(adapter.getProvider()).toBe(ModelProvider.ZHIPU);
    expect(adapter.getModel()).toBe(NativeModel.GLM_4_7);
  });

  it('createOllamaModel 应该创建 Ollama 适配器', () => {
    const adapter = createOllamaModel('llama3');
    expect(adapter.getProvider()).toBe(ModelProvider.OLLAMA);
    expect(adapter.getModel()).toBe('ollama/llama3');
  });
});
