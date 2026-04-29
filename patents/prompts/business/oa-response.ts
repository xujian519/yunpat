// 源自 Athena: prompts/business/task_2_1_analyze_office_action.md + task_2_3_develop_response_strategy.md
// 转换日期: 2026-04-29

export const OA_ANALYSIS_PROMPT = `
# 审查意见分析任务

## 分析步骤
1. 识别审查意见类型（新颖性/创造性/清楚性/支持/形式）
2. 提取审查员的核心论点和引用的对比文件
3. 分析受影响的权利要求
4. 评估每个论点的强弱

## 判断标准
- 新颖性：单独对比原则，存在区别特征即具备新颖性
- 创造性：三步法（确定最接近现有技术→确定区别特征→判断是否显而易见）
- 清楚性：26条第4款，权利要求应当清楚、简明
- 支持性：26条第4款，权利要求应当得到说明书支持
`;

export function renderOaAnalysisPrompt(params: {
  officeActionText: string;
  currentClaims: string;
}): string {
  return `${OA_ANALYSIS_PROMPT}

## 审查意见原文
${params.officeActionText}

## 当前权利要求
${params.currentClaims}

请分析审查意见并给出答复建议。
`;
}
