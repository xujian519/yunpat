import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';
import {
  InventionType,
  ClaimType,
  ClaimDraft,
  TechnicalFeature,
  IndependentClaimParams,
  IndependentClaimParamsSchema,
  ClaimDraftSchema,
} from '../types/patent.js';
import {
  CLAIMS_TEMPLATES,
  DEFAULT_PREAMBLES,
  DEFAULT_TRANSITION_WORDS,
  buildIndependentClaimPrompt,
  buildDependentClaimPrompt,
} from '../utils/template.js';

/**
 * 权利要求生成工具
 *
 * 根据技术交底书自动生成专利权利要求书
 */
export class ClaimsGeneratorTool extends EnhancedBaseTool<
  IndependentClaimParams,
  ClaimDraft[]
> {
  readonly metadata = {
    name: 'generate_claims',
    description: '根据技术交底书自动生成专利权利要求书，包括独立权利要求和从属权利要求',
    category: ToolCategory.PATENT,
    isConcurrencySafe: true,
    inputSchema: IndependentClaimParamsSchema.strict(),
    outputSchema: z.array(ClaimDraftSchema),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  /**
   * 执行权利要求生成
   */
  async execute(
    input: IndependentClaimParams,
    context: ToolContext
  ): Promise<ClaimDraft[]> {
    const { inventionType, coreFeatures, preamble, transitionWord } = input;

    // 1. 提取必要特征和附加特征
    const essentialFeatures = coreFeatures.filter((f) => f.isEssential);
    const additionalFeatures = coreFeatures.filter((f) => !f.isEssential);

    if (essentialFeatures.length === 0) {
      throw new Error('至少需要一个必要特征来生成独立权利要求');
    }

    // 2. 生成独立权利要求
    const independentClaim = await this.generateIndependentClaim(
      {
        inventionType,
        coreFeatures: essentialFeatures,
        preamble,
        transitionWord,
      },
      context
    );

    // 3. 生成从属权利要求
    const dependentClaims: ClaimDraft[] = [];
    for (let i = 0; i < additionalFeatures.length; i++) {
      const dependentClaim = await this.generateDependentClaim(
        independentClaim,
        additionalFeatures[i],
        i + 2, // 权利要求编号从 2 开始
        context
      );
      dependentClaims.push(dependentClaim);
    }

    return [independentClaim, ...dependentClaims];
  }

  /**
   * 生成独立权利要求
   */
  private async generateIndependentClaim(
    params: IndependentClaimParams,
    context: ToolContext
  ): Promise<ClaimDraft> {
    const { inventionType, coreFeatures, preamble, transitionWord } = params;

    // 构建特征列表字符串
    const featuresStr = coreFeatures
      .map((f, index) => `${index + 1}. ${f.text}`)
      .join('\n');

    // 确保有默认值
    const finalPreamble = preamble || DEFAULT_PREAMBLES[inventionType];
    const finalTransitionWord = transitionWord || DEFAULT_TRANSITION_WORDS[inventionType];

    // 构建提示词
    const prompt = buildIndependentClaimPrompt({
      inventionType,
      preamble: finalPreamble,
      transitionWord: finalTransitionWord,
      features: featuresStr,
    });

    // 调用 LLM 生成
    const response = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的专利代理人，擅长撰写高质量的专利权利要求。' +
            '你熟悉中国专利法及其实施细则对权利要求的撰写要求。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    // 提取生成的权利要求文本
    let text = response.message.content.trim();

    // 清理可能的 markdown 标记
    text = this.cleanMarkdown(text);

    return {
      claimNumber: 1,
      claimType: ClaimType.INDEPENDENT,
      text,
    };
  }

  /**
   * 生成从属权利要求
   */
  private async generateDependentClaim(
    independentClaim: ClaimDraft,
    feature: TechnicalFeature,
    claimNumber: number,
    context: ToolContext
  ): Promise<ClaimDraft> {
    const prompt = buildDependentClaimPrompt({
      independentClaim: independentClaim.text,
      claimNumber,
      additionalFeature: feature.text,
    });

    const response = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的专利代理人，擅长撰写从属权利要求。' +
            '你能够根据独立权利要求和附加特征，撰写出层次清晰、保护合理的从属权利要求。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    let text = response.message.content.trim();
    text = this.cleanMarkdown(text);

    return {
      claimNumber,
      claimType: ClaimType.DEPENDENT,
      text,
      dependsOn: [independentClaim.claimNumber],
    };
  }

  /**
   * 清理 markdown 标记
   */
  private cleanMarkdown(text: string): string {
    // 移除可能的代码块标记
    text = text.replace(/^```\w*\n?/gm, '');
    text = text.replace(/\n?```$/gm, '');

    // 移除可能的引用标记
    text = text.replace(/^>\s?/gm, '');

    return text.trim();
  }
}

/**
 * 技术特征提取工具
 *
 * 从技术描述中自动提取技术特征
 */
export class FeatureExtractorTool extends EnhancedBaseTool<
  { description: string },
  { features: TechnicalFeature[] }
> {
  readonly metadata = {
    name: 'extract_features',
    description: '从技术描述中自动提取技术特征，区分必要特征和附加特征',
    category: ToolCategory.PATENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      description: z.string().describe('技术描述'),
    }).strict(),
    outputSchema: z.object({
      features: z.array(
        z.object({
          text: z.string(),
          isEssential: z.boolean(),
          category: z.string().optional(),
        })
      ),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { description: string },
    context: ToolContext
  ): Promise<{ features: TechnicalFeature[] }> {
    const prompt = `请从以下技术描述中提取技术特征，并区分必要特征和附加特征：

**技术描述：**
${input.description}

**要求：**
1. 提取所有技术特征
2. 区分必要特征（对技术方案必不可少）和附加特征（改进或优化）
3. 对特征进行分类（结构、方法、参数等）
4. 以JSON格式输出

**输出格式：**
\`\`\`json
{
  "features": [
    {
      "text": "包括图像采集模块",
      "isEssential": true,
      "category": "结构"
    },
    {
      "text": "采用卷积神经网络",
      "isEssential": false,
      "category": "方法"
    }
  ]
}
\`\`\`

请只返回JSON，不要包含其他说明文字。`;

    const response = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的专利代理人，擅长分析技术方案并提取技术特征。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    let content = response.message.content.trim();
    content = this.cleanMarkdown(content);

    try {
      const parsed = JSON.parse(content);
      return parsed;
    } catch (error) {
      throw new Error(
        `Failed to parse extracted features: ${error}. Raw content: ${content}`
      );
    }
  }

  private cleanMarkdown(text: string): string {
    text = text.replace(/^```\w*\n?/gm, '');
    text = text.replace(/\n?```$/gm, '');
    return text.trim();
  }
}
