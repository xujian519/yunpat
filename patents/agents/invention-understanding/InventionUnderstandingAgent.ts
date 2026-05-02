import { Agent, type ExecutionContext } from '@yunpat/core';
import * as PatentCore from '../../core/PatentCoreBridge.js';
import { PromptTemplateManager } from '@yunpat/patent-prompts';

export interface InventionUnderstandingInput {
  title: string;
  field: string;
  technicalDisclosure: string;
  drawings?: string[];
  applicant?: string;
  inventors?: string[];
}

export interface InventionUnderstandingOutput {
  technicalField: string;
  backgroundArt: string;
  technicalProblem: string;
  technicalSolution: string;
  beneficialEffects: string;
  keyFeatures: string[];
  drawingDescriptions: string[];
  confidence: number;
}

export class InventionUnderstandingAgent extends Agent {
  private promptManager?: PromptTemplateManager;

  constructor(config: {
    name: string;
    description: string;
    llm: any;
    memory?: any;
    tools?: any;
    eventBus?: any;
    promptManager?: PromptTemplateManager;
  }) {
    super(config);
    this.promptManager = config.promptManager;
  }

  protected async plan(input: InventionUnderstandingInput, context: ExecutionContext): Promise<any> {
    console.log('\n🔍 [发明理解] 步骤1: 规划阶段');
    console.log(`   发明名称: ${input.title}`);
    console.log(`   技术领域: ${input.field}`);

    this.currentStage = 'invention-understanding';

    let parsedDisclosure: any = null;
    let extractedFeatures: any = null;
    try {
      parsedDisclosure = await PatentCore.parseDisclosure(input.technicalDisclosure);
      extractedFeatures = await PatentCore.extractFeatures(input.technicalDisclosure);
      console.log(
        `[InventionUnderstandingAgent] 交底书解析置信度: ${parsedDisclosure.confidence.toFixed(2)}, 特征数: ${extractedFeatures.features.length}`
      );
    } catch (e) {
      console.warn(
        '[InventionUnderstandingAgent] patent-core 预处理失败，回退到纯 LLM 模式:',
        (e as Error).message
      );
    }

    if (this.promptManager) {
      await this.promptManager.preload('invention-understanding');
    }

    return {
      input,
      parsedDisclosure,
      extractedFeatures,
    };
  }

  protected async act(plan: any, context: ExecutionContext): Promise<InventionUnderstandingOutput> {
    console.log('\n🧠 [发明理解] 步骤2: 分析阶段');

    const { input, parsedDisclosure, extractedFeatures } = plan;
    const preprocessedInfo = this.buildPreprocessedContext(parsedDisclosure, extractedFeatures);

    const systemPrompt = `你是一位资深的专利代理人，专精于发明理解和专利申请文件撰写。

你的任务是深入理解技术交底书，提取以下结构化信息：
1. 技术领域 - 明确发明所属的技术领域
2. 背景技术 - 现有技术存在的问题
3. 技术问题 - 本发明要解决的具体技术问题
4. 技术方案 - 解决技术问题的具体方案
5. 有益效果 - 与现有技术相比的优势
6. 关键特征 - 发明的核心技术特征清单
7. 附图说明 - 各附图的内容描述

请用中文回答，保持专业术语的准确性。输出必须是严格的 JSON 格式。`;

    const userPrompt = `发明名称：${input.title}

技术领域：${input.field}

技术交底书：
${input.technicalDisclosure}

${input.drawings && input.drawings.length > 0 ? `附图说明：\n${input.drawings.join('\n')}` : ''}

${preprocessedInfo}

请分析以上技术方案，输出以下 JSON 格式：
{
  "technicalField": "技术领域描述",
  "backgroundArt": "背景技术描述",
  "technicalProblem": "要解决的技术问题",
  "technicalSolution": "技术方案详细描述",
  "beneficialEffects": "有益效果描述",
  "keyFeatures": ["特征1", "特征2", "特征3"],
  "drawingDescriptions": ["图1描述", "图2描述"],
  "confidence": 0.95
}`;

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      responseFormat: { type: 'json_object' },
    });

    let result: InventionUnderstandingOutput;
    try {
      const content = response.message.content;
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      result = {
        technicalField: parsed.technicalField || input.field,
        backgroundArt: parsed.backgroundArt || '',
        technicalProblem: parsed.technicalProblem || '',
        technicalSolution: parsed.technicalSolution || '',
        beneficialEffects: parsed.beneficialEffects || '',
        keyFeatures: Array.isArray(parsed.keyFeatures) ? parsed.keyFeatures : [],
        drawingDescriptions: Array.isArray(parsed.drawingDescriptions) ? parsed.drawingDescriptions : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      };
    } catch (e) {
      console.error('[InventionUnderstandingAgent] JSON解析失败，使用回退输出:', e);
      result = {
        technicalField: input.field,
        backgroundArt: '',
        technicalProblem: '',
        technicalSolution: input.technicalDisclosure.substring(0, 500),
        beneficialEffects: '',
        keyFeatures: [],
        drawingDescriptions: input.drawings || [],
        confidence: 0.5,
      };
    }

    console.log(`\n✅ [发明理解] 分析完成 (置信度: ${result.confidence.toFixed(2)})`);
    console.log(`   技术领域: ${result.technicalField}`);
    console.log(`   关键特征: ${result.keyFeatures.length} 个`);

    return result;
  }

  private buildPreprocessedContext(disclosure: any, features: any): string {
    if (!disclosure && !features) return '';
    const parts: string[] = ['\n## 算法预处理结果（patent-core）'];
    if (disclosure) {
      parts.push(`\n### 交底书结构解析（置信度: ${disclosure.confidence.toFixed(2)}）`);
      for (const [section, content] of Object.entries(disclosure.sections || {})) {
        if (content && (content as string).trim()) {
          parts.push(`- ${section}: ${(content as string).substring(0, 200)}`);
        }
      }
    }
    if (features && features.features?.length > 0) {
      parts.push(`\n### 提取的技术特征（${features.features.length}个）`);
      for (const f of features.features.slice(0, 10)) {
        parts.push(`- [${f.category}/${f.feature_type}] ${f.description}`);
      }
    }
    return parts.join('\n');
  }
}
