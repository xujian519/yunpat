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
`;
export function renderDraftingClaimsPrompt(params) {
    return `${DRAFTING_CLAIMS_PROMPT}

## 发明信息
- 名称：${params.inventionTitle}
- 技术领域：${params.technicalField}
- 技术问题：${params.technicalProblem}
- 技术方案：${params.technicalSolution}

## 提取的技术特征
${params.technicalFeatures}

请撰写完整的权利要求书（含1项独立权利要求和3-5项从属权利要求）。
`;
}
export const DRAFTING_SPECIFICATION_PROMPT = `
# 专利撰写任务 - 说明书

## 说明书结构
1. 技术领域
2. 背景技术
3. 发明内容（技术问题、技术方案、有益效果）
4. 附图说明
5. 具体实施方式

## 撰写原则
- 充分公开：确保所属技术领域的技术人员能够实现
- 支持权利要求：说明书应支持权利要求的保护范围
- 实施例详尽：提供至少2个具体实施方式
`;
export function renderDraftingSpecificationPrompt(params) {
    return `${DRAFTING_SPECIFICATION_PROMPT}

## 发明信息
- 名称：${params.inventionTitle}

## 权利要求
${params.claims}

## 技术特征
${params.technicalFeatures}

${params.backgroundArt ? `## 现有技术\n${params.backgroundArt}` : ''}

请撰写完整的专利说明书。
`;
}
