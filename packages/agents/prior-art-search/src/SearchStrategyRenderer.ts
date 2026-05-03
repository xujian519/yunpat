import type { PriorArtSearchOutput } from './PriorArtSearchAgent.js'

/**
 * 检索策略渲染器
 * 将结构化的检索结果渲染为人类可读的Markdown报告
 */
export class SearchStrategyRenderer {
  render(output: PriorArtSearchOutput): string {
    const sections: string[] = []

    sections.push(`# 先导技术检索报告`)
    sections.push(`\n## 检索策略`)
    sections.push(`\n### 关键词`)
    sections.push(output.searchStrategy.keywords.map(k => `- ${k}`).join('\n'))

    if (output.searchStrategy.ipcCpcClasses.length > 0) {
      sections.push(`\n### IPC/CPC 分类`)
      sections.push(output.searchStrategy.ipcCpcClasses.map(c => `- ${c}`).join('\n'))
    }

    sections.push(`\n### 检索式`)
    output.searchStrategy.searchQueries.forEach((query, index) => {
      sections.push(`${index + 1}. ${query}`)
    })

    sections.push(`\n### 检索范围`)
    sections.push(output.searchStrategy.searchScope)

    sections.push(`\n## 检索结果`)

    if (output.results.patents.length > 0) {
      sections.push(`\n### 相关专利 (${output.results.patents.length}件)`)
      output.results.patents.forEach((patent, index) => {
        sections.push(`\n#### ${index + 1}. ${patent.title}`)
        sections.push(`- 公开号: ${patent.publicationNumber}`)
        if (patent.applicant) sections.push(`- 申请人: ${patent.applicant}`)
        if (patent.publicationDate) sections.push(`- 公开日期: ${patent.publicationDate}`)
        sections.push(`- 相似度: ${(patent.similarityScore * 100).toFixed(1)}%`)
        if (patent.simulated) sections.push(`- ⚠️ 模拟数据`)
      })
    } else {
      sections.push(`\n### 相关专利`)
      sections.push(`未找到相关专利`)
    }

    if (output.results.papers.length > 0) {
      sections.push(`\n### 相关论文 (${output.results.papers.length}篇)`)
      output.results.papers.forEach((paper, index) => {
        sections.push(`\n#### ${index + 1}. ${paper.title}`)
        sections.push(`- 作者: ${paper.authors.join(', ')}`)
        if (paper.year) sections.push(`- 年份: ${paper.year}`)
        if (paper.venue) sections.push(`- 期刊/会议: ${paper.venue}`)
        sections.push(`- 相似度: ${(paper.similarityScore * 100).toFixed(1)}%`)
        if (paper.simulated) sections.push(`- ⚠️ 模拟数据`)
      })
    }

    sections.push(`\n## 对比分析`)

    const closest = output.comparisonAnalysis.closestPriorArt
    sections.push(`\n### 最接近的现有技术`)
    sections.push(`**${closest.title}**`)

    // 根据类型显示不同的信息
    if ('publicationNumber' in closest && closest.publicationNumber) {
      sections.push(`专利号: ${closest.publicationNumber}`)
    } else if ('authors' in closest && closest.authors.length > 0) {
      sections.push(`作者: ${closest.authors.join(', ')}`)
      if (closest.year) sections.push(`年份: ${closest.year}`)
      if (closest.venue) sections.push(`期刊/会议: ${closest.venue}`)
    }

    sections.push(`相似度: ${(closest.similarityScore * 100).toFixed(1)}%`)

    sections.push(`\n### 区别特征`)
    if (output.comparisonAnalysis.differences.length > 0) {
      output.comparisonAnalysis.differences.forEach((diff, index) => {
        sections.push(`${index + 1}. ${diff}`)
      })
    } else {
      sections.push(`无明确区别特征`)
    }

    sections.push(`\n### 实际解决的技术问题`)
    sections.push(output.comparisonAnalysis.technicalProblemSolved)

    sections.push(`\n### 创造性评估`)
    const creativity = output.comparisonAnalysis.creativityAssessment
    const levelMap = {
      high: '高',
      medium: '中',
      low: '低'
    }
    const levelEmoji = {
      high: '🟢',
      medium: '🟡',
      low: '🔴'
    }
    sections.push(`**等级**: ${levelEmoji[creativity.level]} ${levelMap[creativity.level]}`)
    sections.push(`**理由**: ${creativity.reasoning}`)
    sections.push(`**置信度**: ${(creativity.confidence * 100).toFixed(1)}%`)

    sections.push(`\n---`)
    sections.push(`检索置信度: ${(output.confidence * 100).toFixed(1)}%`)

    if (output.results.patents.some(p => p.simulated) || output.results.papers.some(p => p.simulated)) {
      sections.push(`\n⚠️ 注意: 当前检索结果为AI生成的模拟数据，尚未接入真实专利数据库`)
    }

    return sections.join('\n')
  }
}
