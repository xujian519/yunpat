import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ClaimsGeneratorTool,
  FeatureExtractorTool,
} from '../../src/tools/ClaimsGeneratorTool.js';
import { InventionType, ClaimType } from '../../src/types/patent.js';

describe('ClaimsGeneratorTool', () => {
  let tool: ClaimsGeneratorTool;

  beforeEach(() => {
    tool = new ClaimsGeneratorTool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(tool.metadata.name).toBe('generate_claims');
    expect(tool.metadata.category).toBe('patent');
    expect(tool.metadata.isConcurrencySafe).toBe(true);
    expect(tool.metadata.inputSchema).toBeDefined();
    expect(tool.metadata.outputSchema).toBeDefined();
  });

  it('throws error when no essential features provided', async () => {
    const context = {} as any;
    const input = {
      inventionType: InventionType.DEVICE,
      coreFeatures: [
        { text: '可选特征1', isEssential: false },
      ],
    };

    await expect(tool.execute(input as any, context)).rejects.toThrow(
      '至少需要一个必要特征来生成独立权利要求'
    );
  });

  it('generates claims with mocked LLM', async () => {
    const mockLLM = {
      chat: vi.fn().mockResolvedValue({
        message: {
          content: '一种图像识别装置，其特征在于，包括：图像采集模块；',
        },
      }),
    };

    const context = { llm: mockLLM } as any;
    const input = {
      inventionType: InventionType.DEVICE,
      coreFeatures: [
        { text: '图像采集模块', isEssential: true },
        { text: '特征提取模块', isEssential: true },
        { text: '采用卷积神经网络', isEssential: false },
      ],
      preamble: '一种图像识别装置',
      transitionWord: '其特征在于，包括：',
    };

    const result = await tool.execute(input, context);

    expect(result).toHaveLength(2); // 1 independent + 1 dependent
    expect(result[0].claimNumber).toBe(1);
    expect(result[0].claimType).toBe(ClaimType.INDEPENDENT);
    expect(result[0].text).toBe('一种图像识别装置，其特征在于，包括：图像采集模块；');
    expect(result[1].claimNumber).toBe(2);
    expect(result[1].claimType).toBe(ClaimType.DEPENDENT);
    expect(result[1].dependsOn).toEqual([1]);

    // Verify LLM was called twice (once for independent, once for dependent)
    expect(mockLLM.chat).toHaveBeenCalledTimes(2);
  });

  it('uses default preamble and transition word when not provided', async () => {
    const mockLLM = {
      chat: vi.fn().mockResolvedValue({
        message: { content: '一种装置，其特征在于，包括：模块A；' },
      }),
    };

    const context = { llm: mockLLM } as any;
    const input = {
      inventionType: InventionType.METHOD,
      coreFeatures: [{ text: '步骤一', isEssential: true }],
    };

    await tool.execute(input, context);

    const firstCall = mockLLM.chat.mock.calls[0];
    const promptContent = firstCall[0].messages[1].content;
    expect(promptContent).toContain('一种方法');
    expect(promptContent).toContain('包括以下步骤');
  });

  it('cleans markdown from LLM response', async () => {
    const mockLLM = {
      chat: vi.fn().mockResolvedValue({
        message: {
          content: '```\n一种装置，其特征在于，包括：模块；\n```',
        },
      }),
    };

    const context = { llm: mockLLM } as any;
    const input = {
      inventionType: InventionType.DEVICE,
      coreFeatures: [{ text: '模块', isEssential: true }],
    };

    const result = await tool.execute(input, context);
    expect(result[0].text).not.toContain('```');
    expect(result[0].text).toBe('一种装置，其特征在于，包括：模块；');
  });
});

describe('FeatureExtractorTool', () => {
  let tool: FeatureExtractorTool;

  beforeEach(() => {
    tool = new FeatureExtractorTool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(tool.metadata.name).toBe('extract_features');
    expect(tool.metadata.category).toBe('patent');
  });

  it('extracts features from description with mocked LLM', async () => {
    const mockLLM = {
      chat: vi.fn().mockResolvedValue({
        message: {
          content: JSON.stringify({
            features: [
              { text: '图像采集模块', isEssential: true, category: '结构' },
              { text: '采用CNN', isEssential: false, category: '方法' },
            ],
          }),
        },
      }),
    };

    const context = { llm: mockLLM } as any;
    const result = await tool.execute(
      { description: '本发明涉及一种图像识别装置...' },
      context
    );

    expect(result.features).toHaveLength(2);
    expect(result.features[0].text).toBe('图像采集模块');
    expect(result.features[0].isEssential).toBe(true);
    expect(result.features[1].text).toBe('采用CNN');
    expect(result.features[1].isEssential).toBe(false);

    expect(mockLLM.chat).toHaveBeenCalledTimes(1);
  });

  it('cleans markdown from LLM response', async () => {
    const mockLLM = {
      chat: vi.fn().mockResolvedValue({
        message: {
          content: '```json\n{"features":[{"text":"模块A","isEssential":true}]}\n```',
        },
      }),
    };

    const context = { llm: mockLLM } as any;
    const result = await tool.execute({ description: 'test' }, context);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].text).toBe('模块A');
  });

  it('throws error on invalid JSON response', async () => {
    const mockLLM = {
      chat: vi.fn().mockResolvedValue({
        message: { content: 'not valid json' },
      }),
    };

    const context = { llm: mockLLM } as any;
    await expect(tool.execute({ description: 'test' }, context)).rejects.toThrow(
      'Failed to parse extracted features'
    );
  });
});
