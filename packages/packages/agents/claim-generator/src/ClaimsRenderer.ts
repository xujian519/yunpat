import type { ClaimGeneratorOutput } from './ClaimGeneratorAgent.js'

/**
 * 权利要求渲染器
 * 将结构化的权利要求集合渲染为标准格式的权利要求书
 */
export class ClaimsRenderer {
  render(output: ClaimGeneratorOutput): string {
    const { claimsSet } = output
    const sections: string[] = []

    sections.push(`# 权利要求书`)
    sections.push(
      `\n${claimsSet.independent_claims.length + claimsSet.dependent_claims.length}. 一种${claimsSet.independent_claims[0]?.preamble.replace(/^一种/, '') || '发明'}，其特征在于：`
    )

    // 渲染独立权利要求
    claimsSet.independent_claims.forEach((claim) => {
      sections.push(`\n${claim.claim_number}. ${claim.full_text}`)
    })

    // 渲染从属权利要求
    claimsSet.dependent_claims.forEach((claim) => {
      sections.push(
        `\n${claim.claim_number}. 根据权利要求${claim.parent_claim}所述的${this.getClaimType(claim)}，其特征在于：${claim.content}`
      )
    })

    // 添加布局策略和保护范围分析
    sections.push(`\n---`)
    sections.push(`\n## 布局策略`)
    sections.push(claimsSet.layout_strategy)

    sections.push(`\n## 保护范围分析`)
    sections.push(claimsSet.protection_scope_analysis)

    sections.push(`\n## 质量检查`)
    sections.push(`- 清楚性：${claimsSet.quality_check.clarity}`)
    sections.push(`- 支持性：${claimsSet.quality_check.support}`)
    sections.push(`- 必要技术特征：${claimsSet.quality_check.essential_features}`)

    if (claimsSet.quality_check.potential_issues.length > 0) {
      sections.push(`\n### 潜在问题`)
      claimsSet.quality_check.potential_issues.forEach((issue, index) => {
        sections.push(`${index + 1}. ${issue}`)
      })
    }

    sections.push(`\n---`)
    sections.push(`生成置信度: ${(output.confidence * 100).toFixed(1)}%`)

    return sections.join('\n')
  }

  /**
   * 渲染为标准CN格式
   */
  renderCNFormat(output: ClaimGeneratorOutput): string {
    const { claimsSet } = output
    const lines: string[] = []

    lines.push('权利要求书')
    lines.push('')

    // 渲染所有权利要求
    const allClaims = [
      ...claimsSet.independent_claims.map((c) => ({ ...c, type: 'independent' as const })),
      ...claimsSet.dependent_claims.map((c) => ({ ...c, type: 'dependent' as const })),
    ].sort((a, b) => a.claim_number - b.claim_number)

    allClaims.forEach((claim) => {
      if (claim.type === 'independent') {
        lines.push(`${claim.claim_number}. ${claim.full_text}`)
      } else {
        lines.push(
          `${claim.claim_number}. 根据权利要求${claim.parent_claim}所述的${this.getClaimType(claim)}，其特征在于：${claim.content}`
        )
      }
      lines.push('')
    })

    return lines.join('\n')
  }

  private getClaimType(claim: any): string {
    const typeMap: Record<string, string> = {
      device: '装置',
      method: '方法',
      system: '系统',
      composition: '组合物',
    }
    return typeMap[claim.claim_type || 'device'] || '装置'
  }
}
