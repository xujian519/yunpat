import type { SpecificationDrafterOutput } from './SpecificationDrafterAgent.js'

/**
 * 说明书渲染器
 * 将结构化的说明书内容渲染为标准CN格式的说明书
 */
export class SpecificationRenderer {
  render(output: SpecificationDrafterOutput): string {
    const { specification } = output
    const sections: string[] = []

    sections.push(`# 说明书`)
    sections.push(`\n${specification.technical_field.content}`)
    sections.push(`\n${specification.background_art.content}`)
    sections.push(`\n${specification.invention_content.content}`)
    sections.push(`\n${specification.embodiments.content}`)
    sections.push(`\n${specification.drawings_description.content}`)

    return sections.join('\n')
  }

  /**
   * 渲染为标准CN格式
   */
  renderCNFormat(output: SpecificationDrafterOutput): string {
    const { specification } = output
    const lines: string[] = []

    lines.push('说明书')
    lines.push('')

    // 技术领域
    lines.push(specification.technical_field.content)
    lines.push('')
    lines.push('')

    // 背景技术
    lines.push(specification.background_art.content)
    lines.push('')
    lines.push('')

    // 发明内容
    lines.push(specification.invention_content.content)
    lines.push('')
    lines.push('')

    // 具体实施方式
    lines.push(specification.embodiments.content)
    lines.push('')
    lines.push('')

    // 附图说明
    lines.push(specification.drawings_description.content)

    return lines.join('\n')
  }

  /**
   * 渲染完整专利申请文件（权利要求书 + 说明书）
   */
  renderFullPatentApplication(
    claimsOutput: any,
    specificationOutput: SpecificationDrafterOutput
  ): string {
    const sections: string[] = []

    // 1. 请求书部分（简化）
    sections.push(`# 专利申请文件`)
    sections.push(`\n## 发明名称`)
    sections.push(`${specificationOutput.specification.technical_field.content.split('，')[0]}`)
    sections.push(`\n## 摘要`)
    sections.push(`本发明公开了${specificationOutput.specification.invention_content.technical_solution.substring(0, 100)}...。`)

    // 2. 权利要求书
    sections.push(`\n## 权利要求书`)
    if (claimsOutput?.claimsSet) {
      claimsOutput.claimsSet.independent_claims.forEach((claim: any) => {
        sections.push(`\n${claim.claim_number}. ${claim.full_text}`)
      })
      claimsOutput.claimsSet.dependent_claims.forEach((claim: any) => {
        sections.push(`\n${claim.claim_number}. ${claim.content}`)
      })
    }

    // 3. 说明书
    sections.push(`\n## 说明书`)
    sections.push(`\n${specificationOutput.specification.technical_field.content}`)
    sections.push(`\n${specificationOutput.specification.background_art.content}`)
    sections.push(`\n${specificationOutput.specification.invention_content.content}`)
    sections.push(`\n${specificationOutput.specification.embodiments.content}`)
    sections.push(`\n${specificationOutput.specification.drawings_description.content}`)

    return sections.join('\n')
  }

  /**
   * 获取章节统计
   */
  getChapterStats(output: SpecificationDrafterOutput): Record<string, any> {
    const { specification, metrics } = output

    return {
      '技术领域': {
        title: specification.technical_field.title,
        wordCount: specification.technical_field.wordCount,
      },
      '背景技术': {
        title: specification.background_art.title,
        wordCount: specification.background_art.wordCount,
      },
      '发明内容': {
        title: specification.invention_content.title,
        wordCount: specification.invention_content.wordCount,
      },
      '具体实施方式': {
        title: specification.embodiments.title,
        wordCount: specification.embodiments.wordCount,
      },
      '附图说明': {
        title: specification.drawings_description.title,
        wordCount: specification.drawings_description.wordCount,
      },
      '总计': {
        总字数: metrics.totalWordCount,
        章节数: metrics.chapterCount,
        术语一致性: metrics.terminologyConsistency ? '✓' : '✗',
        连贯性: metrics.coherenceCheck ? '✓' : '✗',
      },
    }
  }
}
