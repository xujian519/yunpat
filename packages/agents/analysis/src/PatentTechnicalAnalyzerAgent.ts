import { Agent, type ExecutionContext } from '@yunpat/core';

export interface PatentTechnicalAnalyzerInput {
  patent: {
    publicationNumber: string;
    title: string;
    abstract: string;
    applicant?: string;
    publicationDate?: string;
    fullText?: string;
  };
  inventionUnderstanding?: {
    technicalProblem: string;
    technicalSolution: string;
    keyFeatures: string[];
  };
}

export interface PatentTechnicalAnalysis {
  patentInfo: {
    publicationNumber: string;
    title: string;
    applicant?: string;
    publicationDate?: string;
  };
  technicalAnalysis: {
    technicalProblems: { main: string; sub: string[] };
    technicalSolution: {
      core: string;
      keyFeatures: { feature: string; necessity: 'essential' | 'optional' }[];
      implementation: string;
    };
    technicalEffects: { main: string; sub: string[] };
    drawings: { figureNumber: string; description: string; keyElements: string[] }[];
  };
  comparison: {
    similarity: number;
    overlappingFeatures: string[];
    distinctFeatures: string[];
    novelty: boolean;
  };
}

interface AnalysisPlan {
  input: PatentTechnicalAnalyzerInput;
}

export class PatentTechnicalAnalyzerAgent extends Agent {
  protected async plan(
    input: PatentTechnicalAnalyzerInput,
    _context: ExecutionContext
  ): Promise<AnalysisPlan> {
    if (!input.patent?.publicationNumber?.trim()) {
      throw new Error('专利公开号不能为空');
    }
    if (!input.patent?.title?.trim()) {
      throw new Error('专利标题不能为空');
    }
    if (!input.patent?.abstract?.trim()) {
      throw new Error('专利摘要不能为空');
    }

    console.log('\n🔬 [专利技术分析] 步骤1: 规划阶段');
    console.log(`   专利: ${input.patent.publicationNumber} - ${input.patent.title}`);
    if (input.inventionUnderstanding) {
      console.log(`   对比分析: 启用`);
    }

    return { input };
  }

  protected async act(
    plan: AnalysisPlan,
    context: ExecutionContext
  ): Promise<PatentTechnicalAnalysis> {
    console.log('\n📊 [专利技术分析] 步骤2: 分析阶段');

    const { input } = plan;

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行专利技术分析');
    }

    console.log('   1️⃣ 提取技术问题/方案/效果...');

    const systemPrompt = `你是一位资深的专利技术分析专家，擅长从专利文献中提取结构化技术信息。

你的任务：
1. 分析专利的技术问题（主要问题 + 子问题）
2. 提取技术方案的核心、关键特征和实施方式
3. 识别技术效果（主要效果 + 子效果）
4. 如果有对比发明，分析与对比发明的相似性和区别

输出必须是严格的JSON格式。`;

    const comparisonPrompt = input.inventionUnderstanding
      ? `
## 待对比发明信息
技术问题: ${input.inventionUnderstanding.technicalProblem}
技术方案: ${input.inventionUnderstanding.technicalSolution}
关键特征: ${input.inventionUnderstanding.keyFeatures.join(', ')}
`
      : '';

    const userPrompt = `## 专利信息

公开号: ${input.patent.publicationNumber}
标题: ${input.patent.title}
申请人: ${input.patent.applicant || '未知'}
公开日: ${input.patent.publicationDate || '未知'}

## 摘要
${input.patent.abstract}

${input.patent.fullText ? `## 全文\n${input.patent.fullText.substring(0, 3000)}...` : ''}

${comparisonPrompt}

请分析以上专利，输出以下JSON格式:

{\n  "technical_analysis": {\n    "technical_problems": {\n      "main": "主要技术问题",\n      "sub": ["子问题1", "子问题2"]\n    },\n    "technical_solution": {\n      "core": "核心技术方案",\n      "key_features": [\n        { "feature": "特征1", "necessity": "essential" },\n        { "feature": "特征2", "necessity": "optional" }\n      ],\n      "implementation": "实施方式概述"\n    },\n    "technical_effects": {\n      "main": "主要技术效果",\n      "sub": ["子效果1", "子效果2"]\n    },\n    "drawings": [\n      { "figure_number": "图1", "description": "附图说明", "key_elements": ["要素1", "要素2"] }\n    ]\n  },\n  "comparison": {\n    "similarity": 0.5,\n    "overlapping_features": ["共同特征1"],\n    "distinct_features": ["区别特征1"],\n    "novelty": true\n  }\n}`;

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    const analysis = this.parseAnalysisResponse(response.message.content);

    console.log(`   ✅ 分析完成`);
    console.log(`      技术问题: ${analysis.technicalAnalysis.technicalProblems.main}`);
    console.log(`      核心方案: ${analysis.technicalAnalysis.technicalSolution.core.substring(0, 50)}...`);
    console.log(`      关键特征: ${analysis.technicalAnalysis.technicalSolution.keyFeatures.length} 个`);
    if (input.inventionUnderstanding) {
      console.log(`      相似度: ${(analysis.comparison.similarity * 100).toFixed(1)}%`);
      console.log(`      区别特征: ${analysis.comparison.distinctFeatures.length} 个`);
    }

    return analysis;
  }

  private parseAnalysisResponse(content: string): PatentTechnicalAnalysis {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('未找到JSON格式的分析数据');
      }

      const data = JSON.parse(jsonMatch[0]);

      return {
        patentInfo: {
          publicationNumber: data.patent_info?.publication_number || '',
          title: data.patent_info?.title || '',
          applicant: data.patent_info?.applicant,
          publicationDate: data.patent_info?.publication_date,
        },
        technicalAnalysis: {
          technicalProblems: {
            main: data.technical_analysis?.technical_problems?.main || '',
            sub: data.technical_analysis?.technical_problems?.sub || [],
          },
          technicalSolution: {
            core: data.technical_analysis?.technical_solution?.core || '',
            keyFeatures: data.technical_analysis?.technical_solution?.key_features || [],
            implementation: data.technical_analysis?.technical_solution?.implementation || '',
          },
          technicalEffects: {
            main: data.technical_analysis?.technical_effects?.main || '',
            sub: data.technical_analysis?.technical_effects?.sub || [],
          },
          drawings: data.technical_analysis?.drawings || [],
        },
        comparison: {
          similarity: data.comparison?.similarity || 0,
          overlappingFeatures: data.comparison?.overlapping_features || [],
          distinctFeatures: data.comparison?.distinct_features || [],
          novelty: data.comparison?.novelty || false,
        },
      };
    } catch (error) {
      console.warn('[PatentTechnicalAnalyzerAgent] JSON解析失败，回退到默认结构:', error);
      return this.getDefaultAnalysis();
    }
  }

  private getDefaultAnalysis(): PatentTechnicalAnalysis {
    return {
      patentInfo: { publicationNumber: '', title: '' },
      technicalAnalysis: {
        technicalProblems: { main: '', sub: [] },
        technicalSolution: { core: '', keyFeatures: [], implementation: '' },
        technicalEffects: { main: '', sub: [] },
        drawings: [],
      },
      comparison: {
        similarity: 0,
        overlappingFeatures: [],
        distinctFeatures: [],
        novelty: false,
      },
    };
  }
}
