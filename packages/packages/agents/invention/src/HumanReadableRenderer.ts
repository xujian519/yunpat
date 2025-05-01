import type { InventionUnderstandingOutput } from './InventionUnderstandingAgent.js'

export class HumanReadableRenderer {
  render(output: InventionUnderstandingOutput): string {
    const sections: string[] = []

    sections.push(`# 发明理解报告`)
    sections.push(`\n## 技术领域`)
    sections.push(output.technicalField)

    if (output.backgroundArt) {
      sections.push(`\n## 背景技术`)
      sections.push(output.backgroundArt)
    }

    sections.push(`\n## 发明构思（问题-特征-效果三元组）`)

    if (output.inventionConcepts.length > 0) {
      output.inventionConcepts.forEach((concept, index) => {
        sections.push(`\n### 第${index + 1}组三元组`)
        sections.push(`**技术问题**: ${concept.technicalProblem}`)
        sections.push(`**技术特征**:`)
        concept.keyFeatures.forEach((feature) => {
          sections.push(`  - ${feature}`)
        })
        sections.push(`**技术效果**:`)
        concept.technicalEffects.forEach((effect) => {
          sections.push(`  - ${effect}`)
        })
        sections.push(`**置信度**: ${(concept.confidence * 100).toFixed(1)}%`)
      })
    } else {
      sections.push('暂无')
    }

    if (output.embodimentSummary) {
      sections.push(`\n## 实施方式`)
      sections.push(output.embodimentSummary)
    }

    sections.push(`\n## 附图说明`)
    if (output.drawingDescriptions.length > 0) {
      output.drawingDescriptions.forEach((desc, index) => {
        sections.push(`- 图${index + 1}: ${desc}`)
      })
    } else {
      sections.push('暂无')
    }

    sections.push(`\n---`)
    sections.push(`总体置信度: ${(output.confidence * 100).toFixed(1)}%`)

    if (output.validation) {
      sections.push(`\n## 验证结果`)
      if (output.validation.passed) {
        sections.push('✅ 通过一致性验证')
      } else {
        sections.push('❌ 未通过一致性验证')
        if (output.validation.errors.length > 0) {
          sections.push('\n**错误列表**:')
          output.validation.errors.forEach((error) => {
            sections.push(`  - ${error}`)
          })
        }
      }
    }

    return sections.join('\n')
  }
}
