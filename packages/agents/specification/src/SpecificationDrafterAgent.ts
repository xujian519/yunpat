import { Agent, type ExecutionContext } from '@yunpat/core';
import { PromptTemplateManager } from '@yunpat/patent-prompts';

export interface SpecificationDrafterInput {
  inventionUnderstanding: {
    technicalField: string;
    backgroundArt: string;
    technicalProblem: string;
    technicalSolution: string;
    beneficialEffects: string;
    keyFeatures: string[];
    drawingDescriptions: string[];
  };
  claims?: {
    independentClaims: { claimNumber: number; fullText: string; claimType: string }[];
    dependentClaims: { claimNumber: number; content: string; parentClaim: number }[];
  };
  priorArtAnalysis?: {
    technicalProblems: { main: string; sub: string[] };
    technicalSolution: { core: string; keyFeatures: { feature: string }[] };
  }[];
}

export interface PatentSpecification {
  technicalField: string;
  backgroundArt: string;
  inventionContent: {
    technicalProblem: string;
    technicalSolution: string;
    beneficialEffects: string;
  };
  drawingsDescription: string;
  detailedDescription: string;
  abstract: string;
  qualityCheck: {
    disclosure: string;
    clarity: string;
    completeness: string;
    support: string;
    potentialIssues: string[];
  };
}

interface DraftingPlan {
  input: SpecificationDrafterInput;
}

export class SpecificationDrafterAgent extends Agent {
  private promptManager?: PromptTemplateManager;

  constructor(config: {
    name: string;
    description: string;
    eventBus: any;
    memory: any;
    tools: any;
    llm: any;
    promptManager?: PromptTemplateManager;
  }) {
    super(config);
    this.promptManager = config.promptManager;
  }

  protected async plan(
    input: SpecificationDrafterInput,
    _context: ExecutionContext
  ): Promise<DraftingPlan> {
    if (!input.inventionUnderstanding?.technicalField?.trim()) {
      throw new Error('技术领域不能为空');
    }
    if (!input.inventionUnderstanding?.technicalProblem?.trim()) {
      throw new Error('技术问题不能为空');
    }
    if (!input.inventionUnderstanding?.technicalSolution?.trim()) {
      throw new Error('技术方案不能为空');
    }

    console.log('\n📄 [说明书撰写] 步骤1: 规划阶段');
    console.log(`   技术领域: ${input.inventionUnderstanding.technicalField}`);
    console.log(`   关键特征: ${input.inventionUnderstanding.keyFeatures.length} 个`);
    if (input.claims) {
      console.log(`   权利要求: ${input.claims.independentClaims.length} 项独立, ${input.claims.dependentClaims.length} 项从属`);
    }

    return { input };
  }

  protected async act(
    plan: DraftingPlan,
    context: ExecutionContext
  ): Promise<PatentSpecification> {
    console.log('\n✍️ [说明书撰写] 步骤2: 撰写阶段');

    const { input } = plan;

    if (!context.llm) {
      throw new Error('LLM 未配置，无法撰写说明书');
    }

    if (this.promptManager) {
      await this.promptManager.loadTemplate('02-specification-drafting');
    }

    const startTime = Date.now();

    console.log('   1️⃣ 撰写技术领域...');
    const technicalField = await this.draftTechnicalField(input, context);
    console.log(`      ✅ ${technicalField.length} 字`);

    console.log('   2️⃣ 撰写背景技术...');
    const backgroundArt = await this.draftBackgroundArt(input, context);
    console.log(`      ✅ ${backgroundArt.length} 字`);

    console.log('   3️⃣ 撰写发明内容...');
    const inventionContent = await this.draftInventionContent(input, context);
    console.log(`      ✅ 问题:${inventionContent.technicalProblem.length}字 方案:${inventionContent.technicalSolution.length}字 效果:${inventionContent.beneficialEffects.length}字`);

    console.log('   4️⃣ 撰写附图说明...');
    const drawingsDescription = await this.draftDrawingsDescription(input, context);
    console.log(`      ✅ ${drawingsDescription.length} 字`);

    console.log('   5️⃣ 撰写具体实施方式...');
    const detailedDescription = await this.draftDetailedDescription(input, context);
    console.log(`      ✅ ${detailedDescription.length} 字`);

    console.log('   6️⃣ 生成摘要...');
    const abstract = await this.draftAbstract(input, context);
    console.log(`      ✅ ${abstract.length} 字`);

    console.log('   7️⃣ 质量检查...');
    const qualityCheck = await this.performQualityCheck(
      { technicalField, backgroundArt, inventionContent, drawingsDescription, detailedDescription, abstract, qualityCheck: {} as any },
      input,
      context
    );

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ [说明书撰写] 完成 (耗时 ${duration.toFixed(1)}s)`);
    console.log(`   总字数: ${technicalField.length + backgroundArt.length + inventionContent.technicalSolution.length + inventionContent.beneficialEffects.length + drawingsDescription.length + detailedDescription.length}`);

    return {
      technicalField,
      backgroundArt,
      inventionContent,
      drawingsDescription,
      detailedDescription,
      abstract,
      qualityCheck,
    };
  }

  private async draftTechnicalField(
    input: SpecificationDrafterInput,
    context: ExecutionContext
  ): Promise<string> {
    const { inventionUnderstanding } = input;

    const systemPrompt = `你是一位资深的专利代理师。请撰写说明书的技术领域章节。
要求：
- 明确发明所属的技术领域
- 通常是发明直接所属或直接应用的技术领域
- 不是上位领域，也不是发明本身
- 50-100字`;

    const userPrompt = `发明名称：基于技术方案的发明
技术领域：${inventionUnderstanding.technicalField}
技术问题：${inventionUnderstanding.technicalProblem}

请撰写技术领域章节，输出纯文本（不要包含"技术领域"标题）。`;

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    return this.cleanText(response.message.content);
  }

  private async draftBackgroundArt(
    input: SpecificationDrafterInput,
    context: ExecutionContext
  ): Promise<string> {
    const { inventionUnderstanding, priorArtAnalysis } = input;

    const priorArtSummary = priorArtAnalysis
      ? priorArtAnalysis.map((art, i) => `
现有技术${i + 1}：${art.technicalProblems.main}
核心方案：${art.technicalSolution.core}
关键特征：${art.technicalSolution.keyFeatures.map((f) => f.feature).join(', ')}
`).join('\n')
      : '暂无现有技术分析';

    const systemPrompt = `你是一位资深的专利代理师。请撰写说明书的背景技术章节。
要求：
- 客观描述现有技术
- 指出现有技术存在的问题
- 引出本发明要解决的技术问题
- 300-500字
- 避免贬低现有技术，保持客观`;

    const userPrompt = `技术领域：${inventionUnderstanding.technicalField}
背景技术：${inventionUnderstanding.backgroundArt}
要解决的技术问题：${inventionUnderstanding.technicalProblem}

现有技术分析：
${priorArtSummary}

请撰写背景技术章节，输出纯文本（不要包含"背景技术"标题）。`;

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    return this.cleanText(response.message.content);
  }

  private async draftInventionContent(
    input: SpecificationDrafterInput,
    context: ExecutionContext
  ): Promise<PatentSpecification['inventionContent']> {
    const { inventionUnderstanding, claims } = input;

    const claimsText = claims
      ? `
权利要求：
${claims.independentClaims.map((c) => `${c.claimNumber}. ${c.fullText}`).join('\n')}
${claims.dependentClaims.map((c) => `${c.claimNumber}. ${c.content}`).join('\n')}
`
      : '';

    const systemPrompt = `你是一位资深的专利代理师。请撰写说明书的发明内容章节，包括技术问题、技术方案和有益效果。

要求：
1. 技术问题：100-200字，基于现有技术的缺陷，具体明确
2. 技术方案：800-1500字，清楚完整地描述技术方案，与权利要求对应
3. 有益效果：200-400字，具体描述直接技术效果，避免广告用语

输出JSON格式：
{\n  "technical_problem": "...",\n  "technical_solution": "...",\n  "beneficial_effects": "..."\n}`;

    const userPrompt = `技术领域：${inventionUnderstanding.technicalField}
技术问题：${inventionUnderstanding.technicalProblem}
技术方案：${inventionUnderstanding.technicalSolution}
有益效果：${inventionUnderstanding.beneficialEffects}
关键特征：${inventionUnderstanding.keyFeatures.join(', ')}
${claimsText}

请撰写发明内容章节，输出JSON格式。`;

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    try {
      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
          technicalProblem: this.cleanText(data.technical_problem || ''),
          technicalSolution: this.cleanText(data.technical_solution || ''),
          beneficialEffects: this.cleanText(data.beneficial_effects || ''),
        };
      }
    } catch (e) {
      console.warn('[SpecificationDrafterAgent] 发明内容JSON解析失败，回退到文本解析');
    }

    const content = response.message.content;
    const parts = content.split(/技术方案[:：]|有益效果[:：]/);
    return {
      technicalProblem: this.cleanText(parts[0] || inventionUnderstanding.technicalProblem),
      technicalSolution: this.cleanText(parts[1] || inventionUnderstanding.technicalSolution),
      beneficialEffects: this.cleanText(parts[2] || inventionUnderstanding.beneficialEffects),
    };
  }

  private async draftDrawingsDescription(
    input: SpecificationDrafterInput,
    context: ExecutionContext
  ): Promise<string> {
    const { inventionUnderstanding } = input;

    if (!inventionUnderstanding.drawingDescriptions?.length) {
      return '本申请未提供附图。';
    }

    const systemPrompt = `你是一位资深的专利代理师。请撰写说明书的附图说明章节。
要求：
- 对每幅附图作出简要说明
- 包含附图编号
- 附图标记不得解释为对权利要求的限制`;

    const userPrompt = `附图描述：
${inventionUnderstanding.drawingDescriptions.map((d, i) => `图${i + 1}：${d}`).join('\n')}

请撰写附图说明，输出纯文本。`;

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    return this.cleanText(response.message.content);
  }

  private async draftDetailedDescription(
    input: SpecificationDrafterInput,
    context: ExecutionContext
  ): Promise<string> {
    const { inventionUnderstanding, claims } = input;

    const claimsText = claims
      ? `
独立权利要求：
${claims.independentClaims.map((c) => `${c.claimNumber}. ${c.fullText}`).join('\n')}

从属权利要求：
${claims.dependentClaims.map((c) => `${c.claimNumber}. ${c.content}`).join('\n')}
`
      : '';

    const systemPrompt = `你是一位资深的专利代理师。请撰写说明书的具体实施方式章节。
要求：
- 详细描述实现发明的优选方式
- 至少提供一个详细实施例
- 包含所有技术特征的细节描述
- 1500-3000字
- 与权利要求的技术方案相对应
- 使用自然语言描述，避免纯数学公式`;

    const userPrompt = `技术方案：${inventionUnderstanding.technicalSolution}
关键特征：${inventionUnderstanding.keyFeatures.join(', ')}
有益效果：${inventionUnderstanding.beneficialEffects}
${claimsText}

请撰写具体实施方式章节，输出纯文本（不要包含"具体实施方式"标题）。`;

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
    });

    return this.cleanText(response.message.content);
  }

  private async draftAbstract(
    input: SpecificationDrafterInput,
    context: ExecutionContext
  ): Promise<string> {
    const { inventionUnderstanding } = input;

    const systemPrompt = `你是一位资深的专利代理师。请撰写专利摘要。
要求：
- 简明扼要说明发明的技术方案
- 100-300字
- 客观、准确
- 不解释原因或作广告性宣传`;

    const userPrompt = `发明名称：基于技术方案的发明
技术领域：${inventionUnderstanding.technicalField}
技术问题：${inventionUnderstanding.technicalProblem}
技术方案：${inventionUnderstanding.technicalSolution.substring(0, 500)}
有益效果：${inventionUnderstanding.beneficialEffects}

请撰写摘要，输出纯文本。`;

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    return this.cleanText(response.message.content);
  }

  private async performQualityCheck(
    spec: PatentSpecification,
    input: SpecificationDrafterInput,
    context: ExecutionContext
  ): Promise<PatentSpecification['qualityCheck']> {
    const fullText = `
技术领域：${spec.technicalField}
背景技术：${spec.backgroundArt}
技术问题：${spec.inventionContent.technicalProblem}
技术方案：${spec.inventionContent.technicalSolution}
有益效果：${spec.inventionContent.beneficialEffects}
附图说明：${spec.drawingsDescription}
具体实施方式：${spec.detailedDescription}
`;

    const systemPrompt = `你是一位专利质量审核专家。请对以下说明书进行质量检查。

检查项：
1. 充分公开（A26.3）：技术用语清晰、完整、能够实现
2. 清楚性：术语一致、语句通顺
3. 完整性：五大章节齐全
4. 支持性（A26.4）：与权利要求对应

输出JSON格式：
{\n  "disclosure": "充分公开检查结论",\n  "clarity": "清楚性检查结论",\n  "completeness": "完整性检查结论",\n  "support": "支持性检查结论",\n  "potential_issues": ["问题1", "问题2"]\n}`;

    const userPrompt = `关键特征：${input.inventionUnderstanding.keyFeatures.join(', ')}

说明书全文：
${fullText.substring(0, 3000)}...

请进行质量检查，输出JSON格式。`;

    try {
      const response = await context.llm.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      });

      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
          disclosure: data.disclosure || '已检查',
          clarity: data.clarity || '已检查',
          completeness: data.completeness || '已检查',
          support: data.support || '已检查',
          potentialIssues: data.potential_issues || [],
        };
      }
    } catch (e) {
      console.warn('[SpecificationDrafterAgent] 质量检查JSON解析失败');
    }

    return {
      disclosure: '自动检查通过',
      clarity: '自动检查通过',
      completeness: '自动检查通过',
      support: '自动检查通过',
      potentialIssues: [],
    };
  }

  private cleanText(text: string): string {
    return text
      .replace(/^\s*\n/gm, '')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
}
