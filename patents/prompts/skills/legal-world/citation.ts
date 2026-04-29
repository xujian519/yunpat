// 源自 Athena: prompts/skills/legal-world-model/
// 转换日期: 2026-04-29

export const LEGAL_REASONING_PROMPT = `
# 法律推理技能

## 推理方法
1. 法条适用分析 - 确定适用的法律条文
2. 案例类比推理 - 参考类似判例
3. 法律解释方法 - 文义解释、目的解释、体系解释

## 三层知识体系
- 基础法律层：民法典、民事诉讼法
- 专利专业层：专利法、审查指南
- 司法案例层：判决文书

## 引用规范
- 法条引用：完整法条编号+条/款/项
- 案例引用：案件编号+裁判要点
`;

export function renderLegalReasoningPrompt(params: {
  question: string;
  context?: string;
  legalBasis?: string;
}): string {
  return `${LEGAL_REASONING_PROMPT}

## 法律问题
${params.question}

${params.context ? `## 案件背景\n${params.context}` : ''}
${params.legalBasis ? `## 相关法条\n${params.legalBasis}` : ''}

请给出专业的法律分析意见。
`;
}
