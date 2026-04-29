/**
 * 审查意见答复智能体
 *
 * 专门用于专利审查意见的智能答复，包括：
 * 1. 审查意见分析
 * 2. 对比文件检索
 * 3. 答复策略制定
 * 4. 答复书生成
 */

import { Agent } from '@yunpat/core';
import * as PatentCore from '../../core/PatentCoreBridge.js';
import { renderOaAnalysisPrompt } from '../../prompts/business/oa-response.js';

/**
 * 审查意见答复输入
 */
export interface OfficeActionInput {
  /** 申请号 */
  applicationNumber: string;

  /** 专利名称 */
  patentTitle: string;

  /** 审查意见通知书内容 */
  officeAction: string;

  /** 对比文件列表 */
  priorArt: string[];

  /** 权利要求书 */
  claims: string[];

  /** 说明书 */
  description: string;
}

/**
 * 审查意见答复输出
 */
export interface OfficeActionOutput {
  /** 答复策略 */
  responseStrategy: {
    /** 策略类型：修改/争辩/合并 */
    type: 'amendment' | 'argument' | 'combination';

    /** 核心论点 */
    arguments: string[];

    /** 建议修改的权利要求 */
    suggestedAmendments: string[];
  };

  /** 答复书 */
  response: {
    /** 意见陈述书 */
    writtenArgument: string;

    /** 修改后的权利要求 */
  amendedClaims: string[];

    /** 修改对照页 */
    amendmentComparison: string;
  };

  /** 答复指标 */
  metrics: {
    /** 授权成功率预测 */
    allowanceProbability: number;

    /** 答复质量评分 */
    qualityScore: number;

    /** 审查员接受可能性 */
    examinerAcceptance: number;
  };
}

/**
 * 审查意见答复智能体
 */
export class PatentResponderAgent extends Agent<OfficeActionInput, OfficeActionOutput> {
  constructor(config: any) {
    super({
      ...config,
      name: 'patent-responder',
      description: '审查意见答复智能体 - 专业的专利审查意见答复助手',
    });
  }

  /**
   * 规划阶段：分析审查意见并制定答复策略
   */
  protected async plan(
    input: OfficeActionInput,
    context: any
  ): Promise<any> {
    console.log(`\n📋 [审查答复] 开始分析审查意见`);
    console.log(`   申请号: ${input.applicationNumber}`);
    console.log(`   专利名称: ${input.patentTitle}`);
    console.log(`   对比文件数量: ${input.priorArt.length}`);

    // patent-core 预处理：解析 OA + 推荐策略
    let parsedOa: any = null;
    let recommendedStrategies: any = null;
    try {
      parsedOa = await PatentCore.parseOa(input.officeAction);
      console.log(`[PatentResponderAgent] OA 类型: ${parsedOa.oa_type}, 受影响权利要求: ${parsedOa.affected_claims.join(',')}`);
      recommendedStrategies = await PatentCore.recommendStrategy(JSON.stringify(parsedOa));
      console.log(`[PatentResponderAgent] 推荐策略: ${recommendedStrategies.strategies.map((s: any) => `${s.strategy_type}(${s.confidence})`).join(', ')}`);
    } catch (e) {
      console.warn('[PatentResponderAgent] patent-core OA 解析失败，回退到纯 LLM 模式:', (e as Error).message);
    }

    // 构建增强的提示词
    const oaContext = parsedOa
      ? `\n\n## patent-core OA 分析\n类型: ${parsedOa.oa_type}\n受影响权利要求: ${parsedOa.affected_claims.join(', ')}\n引用文献: ${parsedOa.citations.map((c: any) => c.document_number).join(', ')}\n审查员论点: ${parsedOa.examiner_arguments.substring(0, 500)}`
      : '';

    const strategyContext = recommendedStrategies
      ? `\n\n## 推荐答复策略（patent-core）\n${recommendedStrategies.strategies.map((s: any) => `- ${s.strategy_type} (置信度: ${s.confidence}): ${s.reasoning}`).join('\n')}`
      : '';

    // 使用 LLM 分析审查意见（结合 patent-core 预处理结果）
    const analysis = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是一位资深的专利代理人，擅长分析审查意见并制定答复策略。

你的任务是：
1. 深入分析审查意见中的驳回理由
2. 评估对比文件的相关性
3. 制定有效的答复策略
4. 设计权利要求修改方案

请分析以下审查意见，并给出答复策略。`
        },
        {
          role: 'user',
          content: `申请号：${input.applicationNumber}

专利名称：${input.patentTitle}

审查意见：
${input.officeAction}

对比文件：
${input.priorArt.join('\n')}

权利要求书：
${input.claims.join('\n')}

说明书：
${input.description.substring(0, 1000)}...
${oaContext}${strategyContext}`
        }
      ],
      temperature: 0.3,
    });

    return {
      analysis: analysis.message.content,
      keyIssues: [],
      strategy: '待制定',
      parsedOa,
      recommendedStrategies,
    };
  }

  /**
   * 执行阶段：生成答复书
   */
  protected async act(
    plan: any,
    context: any
  ): Promise<OfficeActionOutput> {
    console.log(`\n✍️ [审查答复] 开始生成答复书`);

    // 1. 制定答复策略
    console.log(`   1️⃣ 制定答复策略...`);
    const strategy = await this.formulateStrategy(plan, context);
    console.log(`      ✅ 策略类型: ${strategy.type}`);

    // 2. 生成意见陈述书
    console.log(`   2️⃣ 生成意见陈述书...`);
    const writtenArgument = await this.generateWrittenArgument(plan, context);
    console.log(`      ✅ 意见陈述书长度: ${writtenArgument.split(/\s+/).length} 字`);

    // 3. 生成修改后的权利要求
    console.log(`   3️⃣ 生成修改后的权利要求...`);
    const amendedClaims = await this.generateAmendedClaims(plan, context);
    console.log(`      ✅ 修改权利要求 ${amendedClaims.length} 项`);

    // 4. 生成修改对照页
    console.log(`   4️⃣ 生成修改对照页...`);
    const amendmentComparison = await this.generateAmendmentComparison(plan, context);
    console.log(`      ✅ 修改对照页完成`);

    return {
      responseStrategy: strategy,
      response: {
        writtenArgument,
        amendedClaims,
        amendmentComparison,
      },
      metrics: {
        allowanceProbability: this.calculateAllowanceProbability(plan, strategy),
        qualityScore: this.calculateQualityScore(plan, writtenArgument),
        examinerAcceptance: this.calculateExaminerAcceptance(plan, strategy),
      },
    };
  }

  /**
   * 反思阶段：答复质量检查
   */
  protected async reflect(
    output: OfficeActionOutput,
    context: any
  ): Promise<any> {
    console.log(`\n🤔 [审查答复] 质量检查`);

    // patent-core 质量评估
    let coreAssessment: any = null;
    try {
      const claimDrafts = output.response.amendedClaims.map((c, i) => ({
        id: String(i + 1),
        claim_type: (i === 0 ? 'Independent' : 'Dependent') as 'Independent' | 'Dependent',
        preamble: c.substring(0, 50),
        transitional_phrase: '',
        elements: [c],
        dependent_on: i > 0 ? String(i) : null,
      }));
      coreAssessment = await PatentCore.assessQuality(claimDrafts);
      console.log(`[PatentResponderAgent] 修改后权利要求质量: ${coreAssessment.overall_score.toFixed(2)}`);
    } catch (e) {
      console.warn('[PatentResponderAgent] patent-core 质量评估失败:', (e as Error).message);
    }

    const coreInfo = coreAssessment
      ? `\n\n## patent-core 规则化评估\n综合: ${coreAssessment.overall_score}\n${coreAssessment.issues?.map((i: any) => `- [${i.severity}] ${i.suggestion}`).join('\n') || ''}`
      : '';

    const qualityCheck = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是一位专利答复质量审核专家。

请评估以下答复书的质量：

1. 论点是否充分、有说服力
2. 权利要求修改是否合理
3. 是否充分回应了审查意见
4. 是否存在明显的法律风险

给出评分（0-100）和改进建议。`
        },
        {
          role: 'user',
          content: `答复策略：${output.responseStrategy.type}
核心论点数量：${output.responseStrategy.arguments.length}
修改权利要求数量：${output.response.amendedClaims.length}
意见陈述书长度：${output.response.writtenArgument.split(/\s+/).length} 字
授权成功率预测：${output.metrics.allowanceProbability}%${coreInfo}`
        }
      ],
      temperature: 0.3,
    });

    return {
      qualityCheck: qualityCheck.message.content,
      coreAssessment,
      improvementSuggestions: coreAssessment?.issues?.map((i: any) => i.suggestion) || [],
    };
  }

  /**
   * 制定答复策略
   */
  private async formulateStrategy(plan: any, context: any): Promise<any> {
    const strategyResponse = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是一位资深的专利代理人。请根据审查意见分析制定答复策略。

策略类型必须是以下之一：
- amendment - 通过修改权利要求来克服驳回
- argument - 通过争辩来反驳审查员观点
- combination - 修改 + 争辩结合

你必须以 JSON 格式返回，不要包含任何其他内容：
{
  "type": "amendment | argument | combination",
  "arguments": ["核心论点1", "核心论点2", ...],
  "suggestedAmendments": ["建议修改1", "建议修改2", ...]
}`
        },
        {
          role: 'user',
          content: `审查意见分析：
${plan.analysis}

请制定最佳答复策略，并以 JSON 格式返回。`
        }
      ],
      temperature: 0.4,
    });

    // 解析 LLM 返回的 JSON
    const content = strategyResponse.message.content;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      const parsed = JSON.parse(jsonStr);

      const validTypes: Array<'amendment' | 'argument' | 'combination'> = ['amendment', 'argument', 'combination'];
      const type = validTypes.includes(parsed.type) ? parsed.type : 'combination';

      return {
        type,
        arguments: Array.isArray(parsed.arguments) ? parsed.arguments : ['区别技术特征分析', '创造性论述'],
        suggestedAmendments: Array.isArray(parsed.suggestedAmendments)
          ? parsed.suggestedAmendments
          : ['权利要求1增加区别技术特征', '从属权利要求合并到独立权利要求'],
      };
    } catch {
      // 解析失败则回退到硬编码默认值
      return {
        type: 'combination',
        arguments: ['区别技术特征分析', '创造性论述', '不支持驳回理由的论点'],
        suggestedAmendments: ['权利要求1增加区别技术特征', '从属权利要求合并到独立权利要求'],
      };
    }
  }

  /**
   * 生成意见陈述书
   */
  private async generateWrittenArgument(plan: any, context: any): Promise<string> {
    const argument = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `请撰写专利审查意见陈述书，要求：

1. 针对审查员的驳回理由逐一进行回应
2. 充分论述本申请与对比文件的区别
3. 强调本申请的技术特点和创造性
4. 引用相关法律条款和审查指南
5. 语言专业、逻辑清晰、有说服力

字数：1500-3000 字`
        },
        {
          role: 'user',
          content: `请根据以下审查意见撰写陈述书：
${plan.analysis.substring(0, 2000)}...
`
        }
      ],
      temperature: 0.5,
    });

    return argument.message.content;
  }

  /**
   * 生成修改后的权利要求
   */
  private async generateAmendedClaims(plan: any, context: any): Promise<string[]> {
    const amended = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `请根据答复策略修改权利要求：

要求：
1. 保持权利要求的清楚性
2. 增加区别技术特征
3. 合理合并从属权利要求
4. 确保修改得到说明书支持

输出格式：每项权利要求单独一行`
        },
        {
          role: 'user',
          content: `请修改权利要求以克服审查意见的驳回理由。
${plan.analysis.substring(0, 1000)}...
`
        }
      ],
      temperature: 0.4,
    });

    // 解析修改后的权利要求
    const content = amended.message.content;
    return content
      .split(/\n/)
      .filter(line => line.trim().length > 0)
      .filter(line => /^\s*\d+[\.、]/.test(line) || line.includes('权利要求'));
  }

  /**
   * 生成修改对照页
   */
  private async generateAmendmentComparison(plan: any, context: any): Promise<string> {
    const comparison = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `请生成权利要求修改对照页，格式：

权利要求1：
原权利要求：...
修改后的权利要求：...
修改内容：[新增/删除/修改] XXX

权利要求2：
...
`
        },
        {
          role: 'user',
          content: `请生成修改对照页。`
        }
      ],
      temperature: 0.3,
    });

    return comparison.message.content;
  }

  /**
   * 计算授权成功率
   */
  private calculateAllowanceProbability(plan: any, strategy: any): number {
    // 基于多个因素计算授权成功率
    let probability = 50; // 基础概率

    // 策略类型加成
    if (strategy.type === 'combination') {
      probability += 20;
    } else if (strategy.type === 'argument') {
      probability += 10;
    }

    // 论点数量加成
    probability += Math.min(strategy.arguments.length * 5, 15);

    return Math.min(probability, 90);
  }

  /**
   * 计算答复质量评分
   */
  private calculateQualityScore(plan: any, writtenArgument: string): number {
    let score = 70; // 基础分

    // 意见陈述书长度评估
    const wordCount = writtenArgument.split(/\s+/).length;
    if (wordCount >= 1500 && wordCount <= 3000) {
      score += 15;
    } else if (wordCount >= 1000) {
      score += 10;
    }

    // 逻辑结构评估
    if (writtenArgument.includes('首先') && writtenArgument.includes('其次')) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * 计算审查员接受可能性
   */
  private calculateExaminerAcceptance(plan: any, strategy: any): number {
    // 基于策略和论点质量计算
    let acceptance = 60;

    if (strategy.type === 'amendment' || strategy.type === 'combination') {
      acceptance += 15;
    }

    if (strategy.arguments.length >= 3) {
      acceptance += 10;
    }

    return Math.min(acceptance, 95);
  }
}
