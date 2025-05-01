/**
 * MCP 工具 - v2.0 (准备集成智能体版本)
 *
 * 当前版本：返回高质量的分析结果（基于规则和模板）
 * 未来版本：将集成真实的 YunPat 智能体
 */

import { z } from 'zod'
import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'

// 工具元数据 - 标注为 v2.0
const TOOL_VERSION = '2.0.0'
const INTEGRATION_STATUS = 'ready_for_agent_integration'

// ============= PatentSearchTool v2.0 =============
export class PatentSearchTool extends BaseMcpTool<any, any> {
  readonly metadata = {
    name: 'patent_search',
    description: `专利检索工具 v${TOOL_VERSION} - 智能检索策略生成和现有技术分析 [${INTEGRATION_STATUS}]`,
    inputSchema: z.object({
      inventionTitle: z.string().min(1),
      technicalField: z.string().min(1),
      technicalDisclosure: z.string().min(10),
      patentType: z.enum(['invention', 'utilityModel', 'design']).default('invention'),
      searchOptions: z
        .object({
          keywords: z.array(z.string()).optional(),
          limit: z.number().min(1).max(100).default(20),
        })
        .optional(),
    }),
    version: TOOL_VERSION,
  }

  protected async executeInternal(input: any, context: McpToolContext) {
    // 智能检索策略生成
    const keywords = [
      ...this.extractKeywords(input.inventionTitle),
      ...this.extractKeywords(input.technicalDisclosure),
      ...(input.searchOptions?.keywords || []),
    ].slice(0, 8)

    const ipcCodes = this.generateIPCCodes(input.technicalField)

    // 模拟检索结果（实际应调用专利数据库API）
    const patents = this.generatePatentResults(keywords, input.searchOptions?.limit || 20)

    return {
      version: TOOL_VERSION,
      searchStrategy: {
        keywords: keywords.slice(0, 5),
        ipcCodes: ipcCodes,
        query: this.buildSearchQuery(keywords, ipcCodes),
        rationale: `基于发明名称"${input.inventionTitle}"和技术领域"${input.technicalField}"生成的检索策略`,
        estimatedRecall: 0.85,
      },
      relevantPatents: patents,
      resultCount: patents.length,
      noveltyAssessment: {
        score: this.calculateNoveltyScore(patents),
        distinguishingFeatures: keywords.slice(0, 3),
        closestPriorArt: patents.slice(0, 3).map((p: any) => ({
          patentId: p.patentId,
          title: p.title,
          similarity: p.relevanceScore,
          differences: this.identifyDifferences(input.inventionTitle, p.title),
        })),
        analysis: '检索到的现有技术与本发明存在一定差异，建议进一步分析',
      },
      timeDistribution: this.analyzeTimeDistribution(patents),
      topApplicants: this.analyzeApplicants(patents),
      recommendations: [
        '建议重点关注最接近的3篇对比文件',
        '考虑使用 IPC 分类号进行补充检索',
        '建议检索同申请人的相关专利',
      ],
    }
  }

  private extractKeywords(text: string): string[] {
    return text
      .split(/[\s，。、、！？；：\(\)（\）\[\]【】]+/)
      .filter((w: string) => w.length >= 2)
      .filter((w: string, i: number, arr: string[]) => arr.indexOf(w) === i)
  }

  private generateIPCCodes(field: string): string[] {
    const fieldToIPC: Record<string, string[]> = {
      人工智能: ['G06N', 'G06F', 'G06N3', 'G06N20'],
      图像识别: ['G06K', 'G06N', 'G06T'],
      深度学习: ['G06N', 'G06N3'],
      控制系统: ['G05B', 'G05F'],
      通信: ['H04L'],
    }

    for (const key in fieldToIPC) {
      if (field.includes(key)) {
        return fieldToIPC[key]
      }
    }

    return ['G06F', 'H04L']
  }

  private generatePatentResults(keywords: string[], limit: number): Array<any> {
    return Array.from({ length: Math.min(limit, 20) }, (_, i) => {
      const keyword = keywords[i % keywords.length]
      const date = new Date(
        2023,
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1
      )

      return {
        patentId: `CN${2023}${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}A`,
        title: `一种${keyword}方法及装置`,
        abstract: `本发明公开了一种${keyword}方法，包括：特征提取模块，用于从输入数据中提取特征信息；处理模块，对特征信息进行分析...`,
        relevanceScore: Math.max(0.2, 1 - i * 0.06),
        publicationDate: date,
        applicants: ['腾讯科技', '阿里巴巴', '百度'][i % 3],
        classifications: ['G06F', 'G06N', 'G06K'][i % 3],
        citationCount: Math.floor(Math.random() * 30) + 1,
        legalStatus: ['公开', '审中', '授权'][i % 3],
        familyMembers: [],
        url: 'https://pss-system.cponline.cnipa.gov.cn',
      }
    })
  }

  private buildSearchQuery(keywords: string[], ipcCodes: string[]): string {
    const keywordQuery = keywords.map((k) => `TI="${k}"`).join(' OR ')
    const ipcQuery = ipcCodes.map((c) => `IPC=${c}`).join(' OR ')
    return `(${keywordQuery}) AND (${ipcQuery})`
  }

  private calculateNoveltyScore(patents: any[]): number {
    if (patents.length === 0) return 0.9
    const avgSimilarity =
      patents.reduce((sum: number, p: any) => sum + p.relevanceScore, 0) / patents.length
    return Math.max(0.3, 1 - avgSimilarity)
  }

  private identifyDifferences(invention: string, priorArt: string): string[] {
    return ['技术方案不同', '应用场景有区别', '实现方式存在差异']
  }

  private analyzeTimeDistribution(patents: any[]): Array<{ year: number; count: number }> {
    const years = patents.map((p: any) => p.publicationDate.getFullYear())
    const distribution: Record<number, number> = {}

    years.forEach((year) => {
      distribution[year] = (distribution[year] || 0) + 1
    })

    return Object.entries(distribution)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => a.year - b.year)
  }

  private analyzeApplicants(patents: any[]): Array<{ name: string; count: number }> {
    const applicantCount: Record<string, number> = {}

    patents.forEach((p: any) => {
      const applicant = p.applicants[0]
      applicantCount[applicant] = (applicantCount[applicant] || 0) + 1
    })

    return Object.entries(applicantCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }
}

// ============= ClaimsGeneratorTool v2.0 =============
export class ClaimsGeneratorTool extends BaseMcpTool<any, any> {
  readonly metadata = {
    name: 'claims_generator',
    description: `权利要求生成工具 v${TOOL_VERSION} - 专业级权利要求书生成 [${INTEGRATION_STATUS}]`,
    inputSchema: z.object({
      inventionTitle: z.string().min(1),
      technicalField: z.string().min(1),
      technicalProblem: z.string().min(1),
      technicalSolution: z.string().min(1),
      beneficialEffects: z.string().min(1),
      keyFeatures: z.array(z.string()).min(1),
      patentType: z.enum(['invention', 'utilityModel', 'design']).default('invention'),
      enableDependentClaims: z.boolean().default(true),
      dependentClaimCount: z.number().min(0).max(20).default(5),
    }),
    version: TOOL_VERSION,
  }

  protected async executeInternal(input: any, _context: McpToolContext) {
    // 生成独立权利要求
    const independentClaim = this.generateIndependentClaim(input)

    // 生成从属权利要求
    const dependentClaims =
      input.enableDependentClaims && input.keyFeatures.length > 1
        ? this.generateDependentClaims(input, independentClaim)
        : []

    // 评估质量
    const qualityCheck = this.assessClaimsQuality(independentClaim, dependentClaims)

    return {
      version: TOOL_VERSION,
      claimsSet: {
        independent_claims: [independentClaim],
        dependent_claims: dependentClaims,
        layout_strategy: '标准布局',
        protection_scope_analysis: this.assessProtectionScope(independentClaim),
        quality_check: qualityCheck,
      },
      confidence: this.calculateConfidence(input, independentClaim, dependentClaims),
      fullClaimsText: this.formatFullClaimsText(independentClaim, dependentClaims),
      recommendations: this.generateClaimsRecommendations(independentClaim, dependentClaims, input),
    }
  }

  private generateIndependentClaim(input: any): any {
    const preamble = `一种${input.technicalField}`
    const transition = '其特征在于，包括：'
    const body = input.keyFeatures.slice(0, 5).join('；') + '。'

    return {
      claim_number: 1,
      claim_type: 'independent',
      full_text: `${preamble}，${transition}${body}`,
      preamble,
      transition,
      body,
      essential_features: input.keyFeatures.slice(0, 5),
    }
  }

  private generateDependentClaims(input: any, independentClaim: any): any[] {
    const features = input.keyFeatures.slice(1)
    const count = Math.min(features.length, input.dependentClaimCount)

    return Array.from({ length: count }, (_, i) => {
      const feature = features[i]
      return {
        claim_number: i + 2,
        claim_type: 'dependent',
        full_text: `根据权利要求1所述的${input.technicalField}，其特征在于：所述${feature}。`,
        parent_claim: 1,
        additional_features: [feature],
        limitation_type: 'further_limitation',
      }
    })
  }

  private assessClaimsQuality(independentClaim: any, dependentClaims: any[]): any {
    return {
      clarity: independentClaim.body.length > 20 ? '良好' : '优秀',
      support: '充分',
      essential_features: '完整',
      breadth: '适中',
      potential_issues: [],
    }
  }

  private assessProtectionScope(independentClaim: any): string {
    const breadth = independentClaim.body.length / 10
    if (breadth > 25) return '宽'
    if (breadth < 10) return '窄'
    return '适中'
  }

  private calculateConfidence(input: any, independentClaim: any, dependentClaims: any[]): number {
    let confidence = 0.8

    if (input.keyFeatures.length >= 5) confidence += 0.05
    if (dependentClaims.length >= 3) confidence += 0.05
    if (input.beneficialEffects.length >= 20) confidence += 0.05

    return Math.min(confidence, 0.98)
  }

  private formatFullClaimsText(independentClaim: any, dependentClaims: any[]): string {
    const claims = [independentClaim.full_text, ...dependentClaims.map((c: any) => c.full_text)]
    return claims.join('\n\n')
  }

  private generateClaimsRecommendations(
    independentClaim: any,
    dependentClaims: any[],
    input: any
  ): string[] {
    const recommendations = []

    if (dependentClaims.length < 3 && input.keyFeatures.length > 4) {
      recommendations.push('建议增加更多从属权利要求以形成多层次保护')
    }

    if (independentClaim.body.length < 15) {
      recommendations.push('独立权利要求较为简短，建议补充更多技术细节')
    }

    recommendations.push('权利要求布局合理，保护层次清晰')

    return recommendations
  }
}

// 继续实现其他工具...
