// 源自 Athena: prompts/capability/cap02_analysis.md
// 转换日期: 2026-04-29

export const CAP_ANALYSIS_PROMPT = `
# 技术分析能力

## 分析维度
1. 技术特征提取 - 从交底书/权利要求中提取结构化特征
2. 特征分类 - 区分结构特征、功能特征、方法特征
3. 关联分析 - 识别特征之间的依赖和组合关系
4. 三元组构建 - 问题-特征-效果关联

## 分析原则
- 全面性：不遗漏关键技术特征
- 准确性：特征描述与原文一致
- 层次性：区分核心特征和可选特征
`;

export function renderAnalysisPrompt(params: { text: string; analysisType: string }): string {
  return `${CAP_ANALYSIS_PROMPT}

## 待分析文本
${params.text}

## 分析类型
${params.analysisType}
`;
}
