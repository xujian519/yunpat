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

    if (output.technicalProblem) {
      sections.push(`\n## 技术问题`)
      sections.push(output.technicalProblem)
    }

    if (output.technicalSolution) {
      sections.push(`\n## 技术方案`)
      sections.push(output.technicalSolution)
    }

    if (output.beneficialEffects) {
      sections.push(`\n## 有益效果`)
      sections.push(output.beneficialEffects)
    }

    if (output.keyFeatures.length > 0) {
      sections.push(`\n## 关键特征`)
      output.keyFeatures.forEach((feature, index) => {
        sections.push(`${index + 1}. ${feature}`)
      })
    }

    if (output.drawingDescriptions.length > 0) {
      sections.push(`\n## 附图说明`)
      output.drawingDescriptions.forEach((desc, index) => {
        sections.push(`- 图${index + 1}: ${desc}`)
      })
    }

    sections.push(`\n---`)
    sections.push(`分析置信度: ${(output.confidence * 100).toFixed(1)}%`)

    return sections.join('\n')
  }
}
