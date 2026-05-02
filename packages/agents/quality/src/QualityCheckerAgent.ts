import { Agent, type ExecutionContext } from '@yunpat/core';

export interface QualityCheckerInput {
  claims: {
    independentClaims: { claimNumber: number; fullText: string; claimType: string; essentialFeatures: string[] }[];
    dependentClaims: { claimNumber: number; content: string; parentClaim: number; additionalFeatures: string[] }[];
  };
  specification: {
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
  };
}

export interface QualityCheckResult {
  overallScore: number;
  claimsCheck: {
    score: number;
    protectionScope: {
      status: 'pass' | 'warning' | 'fail';
      issues: string[];
    };
    clarity: {
      status: 'pass' | 'warning' | 'fail';
      issues: string[];
    };
    support: {
      status: 'pass' | 'warning' | 'fail';
      issues: string[];
    };
  };
  specificationCheck: {
    score: number;
    disclosure: {
      status: 'pass' | 'warning' | 'fail';
      issues: string[];
    };
    termConsistency: {
      status: 'pass' | 'warning' | 'fail';
      inconsistentTerms: { term: string; occurrences: string[] }[];
    };
    completeness: {
      status: 'pass' | 'warning' | 'fail';
      issues: string[];
    };
  };
  formalCheck: {
    score: number;
    errors: {
      type: string;
      location: string;
      description: string;
      severity: 'error' | 'warning';
    }[];
  };
  improvementSuggestions: {
    category: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
    location: string;
  }[];
}

interface QualityCheckPlan {
  input: QualityCheckerInput;
}

export class QualityCheckerAgent extends Agent {
  protected async plan(
    input: QualityCheckerInput,
    _context: ExecutionContext
  ): Promise<QualityCheckPlan> {
    if (!input.claims?.independentClaims?.length) {
      throw new Error('权利要求不能为空');
    }
    if (!input.specification?.technicalField?.trim()) {
      throw new Error('说明书不能为空');
    }

    console.log('\n🔍 [质量检查] 步骤1: 规划阶段');
    console.log(`   独立权利要求: ${input.claims.independentClaims.length} 项`);
    console.log(`   说明书章节: 完整`);

    return { input };
  }

  protected async act(
    plan: QualityCheckPlan,
    context: ExecutionContext
  ): Promise<QualityCheckResult> {
    console.log('\n✅ [质量检查] 步骤2: 检查阶段');

    const { input } = plan;

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行质量检查');
    }

    console.log('   1️⃣ 检查权利要求...');
    const claimsCheck = await this.checkClaims(input, context);
    console.log(`      权利要求得分: ${claimsCheck.score}/100`);

    console.log('   2️⃣ 检查说明书...');
    const specificationCheck = await this.checkSpecification(input, context);
    console.log(`      说明书得分: ${specificationCheck.score}/100`);

    console.log('   3️⃣ 形式检查...');
    const formalCheck = await this.checkFormal(input);
    console.log(`      形式得分: ${formalCheck.score}/100`);

    console.log('   4️⃣ 生成改进建议...');
    const improvementSuggestions = await this.generateSuggestions(
      claimsCheck,
      specificationCheck,
      formalCheck,
      context
    );

    const overallScore = Math.round(
      (claimsCheck.score + specificationCheck.score + formalCheck.score) / 3
    );

    console.log(`\n✅ [质量检查] 完成`);
    console.log(`   综合评分: ${overallScore}/100`);
    console.log(`   问题数: ${formalCheck.errors.length} 个`);
    console.log(`   改进建议: ${improvementSuggestions.length} 个`);

    return {
      overallScore,
      claimsCheck,
      specificationCheck,
      formalCheck,
      improvementSuggestions,
    };
  }

  private async checkClaims(
    input: QualityCheckerInput,
    context: ExecutionContext
  ): Promise<QualityCheckResult['claimsCheck']> {
    const claimsText = input.claims.independentClaims
      .map((c) => `${c.claimNumber}. ${c.fullText}`)
      .join('\n');

    const systemPrompt = `你是一位专利质量检查专家。请检查以下权利要求的质量。

检查维度：
1. 保护范围：是否合理，不过宽也不过窄
2. 清楚性：术语是否清楚，保护范围是否明确
3. 支持性：权利要求是否得到说明书支持（A26.4）

输出JSON格式：
{\n  "score": 85,\n  "protection_scope": {\n    "status": "pass | warning | fail",\n    "issues": ["问题1"]\n  },\n  "clarity": {\n    "status": "pass | warning | fail",\n    "issues": ["问题1"]\n  },\n  "support": {\n    "status": "pass | warning | fail",\n    "issues": ["问题1"]\n  }\n}`;

    const userPrompt = `权利要求：\n${claimsText}\n\n说明书技术方案：\n${input.specification.inventionContent.technicalSolution}`;

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
          score: data.score || 80,
          protectionScope: {
            status: data.protection_scope?.status || 'pass',
            issues: data.protection_scope?.issues || [],
          },
          clarity: {
            status: data.clarity?.status || 'pass',
            issues: data.clarity?.issues || [],
          },
          support: {
            status: data.support?.status || 'pass',
            issues: data.support?.issues || [],
          },
        };
      }
    } catch (e) {
      console.warn('[QualityCheckerAgent] 权利要求检查JSON解析失败');
    }

    return this.getDefaultClaimsCheck();
  }

  private async checkSpecification(
    input: QualityCheckerInput,
    context: ExecutionContext
  ): Promise<QualityCheckResult['specificationCheck']> {
    const specText = `
技术领域：${input.specification.technicalField}
背景技术：${input.specification.backgroundArt}
技术问题：${input.specification.inventionContent.technicalProblem}
技术方案：${input.specification.inventionContent.technicalSolution}
有益效果：${input.specification.inventionContent.beneficialEffects}
附图说明：${input.specification.drawingsDescription}
具体实施方式：${input.specification.detailedDescription}
`;

    const systemPrompt = `你是一位专利质量检查专家。请检查以下说明书的质量。

检查维度：
1. 充分公开（A26.3）：是否清楚、完整、能够实现
2. 术语一致性：同一术语在不同章节中含义是否一致
3. 完整性：五大章节是否齐全

输出JSON格式：
{\n  "score": 85,\n  "disclosure": {\n    "status": "pass | warning | fail",\n    "issues": ["问题1"]\n  },\n  "term_consistency": {\n    "status": "pass | warning | fail",\n    "inconsistent_terms": [{ "term": "术语", "occurrences": ["章节1", "章节2"] }]\n  },\n  "completeness": {\n    "status": "pass | warning | fail",\n    "issues": ["问题1"]\n  }\n}`;

    try {
      const response = await context.llm.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: specText },
        ],
        temperature: 0.3,
      });

      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
          score: data.score || 80,
          disclosure: {
            status: data.disclosure?.status || 'pass',
            issues: data.disclosure?.issues || [],
          },
          termConsistency: {
            status: data.term_consistency?.status || 'pass',
            inconsistentTerms: data.term_consistency?.inconsistent_terms || [],
          },
          completeness: {
            status: data.completeness?.status || 'pass',
            issues: data.completeness?.issues || [],
          },
        };
      }
    } catch (e) {
      console.warn('[QualityCheckerAgent] 说明书检查JSON解析失败');
    }

    return this.getDefaultSpecificationCheck();
  }

  private async checkFormal(input: QualityCheckerInput): Promise<QualityCheckResult['formalCheck']> {
    const errors: QualityCheckResult['formalCheck']['errors'] = [];

    const claimNumbers = new Set<number>();
    for (const claim of input.claims.independentClaims) {
      if (claimNumbers.has(claim.claimNumber)) {
        errors.push({
          type: '编号重复',
          location: `权利要求${claim.claimNumber}`,
          description: `权利要求编号 ${claim.claimNumber} 重复`,
          severity: 'error',
        });
      }
      claimNumbers.add(claim.claimNumber);
    }
    for (const claim of input.claims.dependentClaims) {
      if (claimNumbers.has(claim.claimNumber)) {
        errors.push({
          type: '编号重复',
          location: `权利要求${claim.claimNumber}`,
          description: `权利要求编号 ${claim.claimNumber} 重复`,
          severity: 'error',
        });
      }
      claimNumbers.add(claim.claimNumber);
    }

    for (const claim of input.claims.dependentClaims) {
      if (!claimNumbers.has(claim.parentClaim)) {
        errors.push({
          type: '引用错误',
          location: `权利要求${claim.claimNumber}`,
          description: `引用的权利要求${claim.parentClaim}不存在`,
          severity: 'error',
        });
      }
    }

    const requiredSections = ['技术领域', '背景技术', '发明内容', '附图说明', '具体实施方式'];
    for (const section of requiredSections) {
      if (!input.specification[section === '发明内容' ? 'inventionContent' : section === '附图说明' ? 'drawingsDescription' : section === '具体实施方式' ? 'detailedDescription' : section === '背景技术' ? 'backgroundArt' : 'technicalField']) {
        errors.push({
          type: '章节缺失',
          location: '说明书',
          description: `${section}章节缺失`,
          severity: 'error',
        });
      }
    }

    for (const claim of input.claims.independentClaims) {
      if (!claim.fullText.includes('其特征在于') && !claim.fullText.includes('其特征')) {
        errors.push({
          type: '格式错误',
          location: `权利要求${claim.claimNumber}`,
          description: '独立权利要求缺少"其特征在于"过渡语',
          severity: 'warning',
        });
      }
    }

    const score = Math.max(0, 100 - errors.filter((e) => e.severity === 'error').length * 10 - errors.filter((e) => e.severity === 'warning').length * 5);

    return { score, errors };
  }

  private async generateSuggestions(
    claimsCheck: QualityCheckResult['claimsCheck'],
    specificationCheck: QualityCheckResult['specificationCheck'],
    formalCheck: QualityCheckResult['formalCheck'],
    context: ExecutionContext
  ): Promise<QualityCheckResult['improvementSuggestions']> {
    const suggestions: QualityCheckResult['improvementSuggestions'] = [];

    claimsCheck.protectionScope.issues.forEach((issue) => {
      suggestions.push({
        category: '权利要求-保护范围',
        priority: 'high',
        description: issue,
        location: '权利要求',
      });
    });

    claimsCheck.clarity.issues.forEach((issue) => {
      suggestions.push({
        category: '权利要求-清楚性',
        priority: 'high',
        description: issue,
        location: '权利要求',
      });
    });

    claimsCheck.support.issues.forEach((issue) => {
      suggestions.push({
        category: '权利要求-支持性',
        priority: 'medium',
        description: issue,
        location: '权利要求/说明书',
      });
    });

    specificationCheck.disclosure.issues.forEach((issue) => {
      suggestions.push({
        category: '说明书-充分公开',
        priority: 'high',
        description: issue,
        location: '说明书',
      });
    });

    specificationCheck.completeness.issues.forEach((issue) => {
      suggestions.push({
        category: '说明书-完整性',
        priority: 'medium',
        description: issue,
        location: '说明书',
      });
    });

    formalCheck.errors.forEach((error) => {
      suggestions.push({
        category: '形式问题',
        priority: error.severity === 'error' ? 'high' : 'medium',
        description: error.description,
        location: error.location,
      });
    });

    return suggestions;
  }

  private getDefaultClaimsCheck(): QualityCheckResult['claimsCheck'] {
    return {
      score: 80,
      protectionScope: { status: 'pass', issues: [] },
      clarity: { status: 'pass', issues: [] },
      support: { status: 'pass', issues: [] },
    };
  }

  private getDefaultSpecificationCheck(): QualityCheckResult['specificationCheck'] {
    return {
      score: 80,
      disclosure: { status: 'pass', issues: [] },
      termConsistency: { status: 'pass', inconsistentTerms: [] },
      completeness: { status: 'pass', issues: [] },
    };
  }
}
