// 源自 Athena: prompts/business/task_1_4_write_claims.md + task_1_3_write_specification.md
// 转换日期: 2026-04-29

export const DRAFTING_CLAIMS_PROMPT = `
# 专利撰写任务 - 权利要求书

## 撰写原则
1. 独立权利要求应包含所有必要技术特征，保护范围合理
2. 从属权利要求应逐步缩小保护范围，形成防御层次
3. 使用"包括"、"包含"等开放式表达扩大保护范围
4. 避免使用模糊用语，确保权利要求清楚

## 格式要求
- 独立权利要求：前序部分 + 转折词"其特征在于" + 特征部分
- 从属权利要求：引用部分 + 进一步限定
- 编号连续，从1开始
`

export function renderDraftingClaimsPrompt(params: {
  inventionTitle: string
  technicalField: string
  technicalFeatures: string
  technicalProblem: string
  technicalSolution: string
}): string {
  return `${DRAFTING_CLAIMS_PROMPT}

## 发明信息
- 名称：${params.inventionTitle}
- 技术领域：${params.technicalField}
- 技术问题：${params.technicalProblem}
- 技术方案：${params.technicalSolution}

## 提取的技术特征
${params.technicalFeatures}

请撰写完整的权利要求书（含1项独立权利要求和3-5项从属权利要求）。
`
}

export const DRAFTING_SPECIFICATION_PROMPT = `
# 专利撰写任务 - 说明书

## 说明书结构（必须按此顺序）
1. 技术领域 — 写明要求保护的技术方案所属的具体技术领域
2. 背景技术 — 必须引证最接近的现有技术，客观指出其缺陷
3. 发明内容 — 包含技术问题、技术方案、有益效果三要素
4. 附图说明 — 对各幅附图做简要说明
5. 具体实施方式 — 详细描述至少一个实施例，结合附图说明

## 撰写原则
- 充分公开（A26.3）：所属技术领域的技术人员能够实现
- 支持权利要求：说明书应支持权利要求的保护范围
- 实施例充分：保护范围较宽时至少2个不同实施例

## 禁止用语
- 禁止"如权利要求……所述"引用语
- 禁止商业宣传用语（"最佳""最优""革命性"等）
- 禁止不确定用语（"厚""薄""强""弱"等无数值上下文时）
- 禁止"例如""最好是""尤其是"等范围模糊词
`

export function renderDraftingSpecificationPrompt(params: {
  inventionTitle: string
  claims: string
  technicalFeatures: string
  backgroundArt?: string
}): string {
  return `${DRAFTING_SPECIFICATION_PROMPT}

## 发明信息
- 名称：${params.inventionTitle}

## 权利要求
${params.claims}

## 技术特征
${params.technicalFeatures}

${params.backgroundArt ? `## 现有技术\n${params.backgroundArt}` : ''}

请撰写完整的专利说明书，注意：背景技术必须引证最接近现有技术（注明公开号和日期），有益效果必须与现有技术对比，具体实施方式中区别技术特征必须详细描述。
`
}
