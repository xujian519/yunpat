/**
 * 专利工具提示词模板
 */

import { InventionType } from '../types/patent.js';

/**
 * 权利要求生成模板
 */
export const CLAIMS_TEMPLATES = {
  [InventionType.DEVICE]: '一种[装置名称]，包括：',
  [InventionType.METHOD]: '一种[方法名称]，其特征在于，包括以下步骤：',
  [InventionType.SYSTEM]: '一种[系统名称]，其特征在于，包括：',
  [InventionType.COMPOSITION]: '一种[组合物名称]，其特征在于，包含：',
};

/**
 * 默认前序部分
 */
export const DEFAULT_PREAMBLES: Record<InventionType, string> = {
  [InventionType.DEVICE]: '一种装置',
  [InventionType.METHOD]: '一种方法',
  [InventionType.SYSTEM]: '一种系统',
  [InventionType.COMPOSITION]: '一种组合物',
};

/**
 * 默认过渡词
 */
export const DEFAULT_TRANSITION_WORDS: Record<InventionType, string> = {
  [InventionType.DEVICE]: '其特征在于，包括：',
  [InventionType.METHOD]: '其特征在于，包括以下步骤：',
  [InventionType.SYSTEM]: '其特征在于，包括：',
  [InventionType.COMPOSITION]: '其特征在于，包含：',
};

/**
 * 构建独立权利要求生成提示词
 */
export function buildIndependentClaimPrompt(params: {
  inventionType: InventionType;
  preamble: string;
  transitionWord: string;
  features: string;
}): string {
  return `请根据以下信息撰写独立权利要求：

**前序部分：**
${params.preamble}

**过渡词：**
${params.transitionWord}

**技术特征：**
${params.features}

**要求：**
1. 前序部分 + 过渡词 + 技术特征构成完整权利要求
2. 技术特征应使用"包括"、"包含"、"具有"等连接词串联
3. 保持语言简洁、准确，避免歧义
4. 使用"所述"引用前序部分提到的技术特征
5. 只返回权利要求文本，不要其他说明或解释

**示例格式：**
一种图像识别装置，其特征在于，包括：
图像采集模块，用于采集待识别图像；
特征提取模块，与所述图像采集模块连接，用于从所述待识别图像中提取特征向量；
识别模块，与所述特征提取模块连接，用于基于所述特征向量进行识别。`;
}

/**
 * 构建从属权利要求生成提示词
 */
export function buildDependentClaimPrompt(params: {
  independentClaim: string;
  claimNumber: number;
  additionalFeature: string;
}): string {
  return `根据以下独立权利要求，撰写第 ${params.claimNumber} 项从属权利要求：

**独立权利要求：**
${params.independentClaim}

**附加特征：**
${params.additionalFeature}

**要求：**
1. 以"根据权利要求${params.claimNumber - 1}所述的..."开头
2. 将附加特征融入权利要求，使用"其特征在于、"或"其中"等连接词
3. 保持语言简洁、准确，与独立权利要求的风格一致
4. 只返回权利要求文本，不要其他说明或解释

**示例格式：**
根据权利要求1所述的图像识别装置，其特征在于，所述特征提取模块采用卷积神经网络模型。`;
}

/**
 * 构建质量评估提示词
 */
export function buildQualityAssessmentPrompt(claimsText: string): string {
  return `请对以下权利要求书进行质量评估，从以下7个维度进行评分（每个维度0-10分）：

**权利要求书：**
${claimsText}

**评估维度：**
1. **完整性**（15%）：是否包含所有必要技术特征，是否形成完整保护方案
2. **清晰性**（15%）：语言表达是否清楚、准确，无歧义
3. **准确性**（15%）：技术特征描述是否准确，是否符合技术事实
4. **充分性**（20%）：是否得到说明书支持，是否能够实现
5. **一致性**（10%）：权利要求之间是否一致，术语是否统一
6. **规范性**（10%）：是否符合专利法及实施细则要求
7. **支持性**（15%）：是否得到说明书充分支持

**输出格式（JSON）：**
\`\`\`json
{
  "completeness": 8,
  "clarity": 7,
  "accuracy": 9,
  "sufficiency": 8,
  "consistency": 9,
  "compliance": 8,
  "support": 7,
  "suggestions": [
    "建议1：...",
    "建议2：..."
  ]
}
\`\`\`

请只返回JSON，不要包含其他说明文字。`;
}

/**
 * 构建审查意见解析提示词
 */
export function buildOfficeActionParsePrompt(officeActionText: string): string {
  return `请解析以下审查意见通知书，提取结构化信息：

**审查意见通知书内容：**
${officeActionText}

**提取信息：**
1. 申请号
2. 申请日
3. 审查意见日期
4. 审查员（如有）
5. 审查意见列表（类型、描述、严重程度）
6. 引用文献列表（文献号、相关度、相关段落）

**输出格式（JSON）：**
\`\`\`json
{
  "applicationNumber": "CN202310123456.7",
  "filingDate": "2023-03-15",
  "officeActionDate": "2024-08-20",
  "examiner": "张某某",
  "objections": [
    {
      "type": "novelty",
      "description": "...",
      "severity": "high",
      "citedReferences": ["CN123456789A"]
    }
  ],
  "citedReferences": [
    {
      "documentNumber": "CN123456789A",
      "relevance": "high",
      "relevantPassages": ["..."]
    }
  ]
}
\`\`\`

请只返回JSON，不要包含其他说明文字。`;
}

/**
 * 构建答复策略提示词
 */
export function buildResponseStrategyPrompt(params: {
  officeAction: string;
  currentClaims: string;
}): string {
  return `根据审查意见和当前权利要求，制定答复策略：

**审查意见：**
${params.officeAction}

**当前权利要求：**
${params.currentClaims}

**分析要求：**
1. 分析审查意见的类型和严重程度
2. 对比引用文献与当前权利要求的差异
3. 制定答复策略（争辩新颖性、争辩创造性、修改权利要求、组合策略）
4. 提供具体修改建议和答复理由
5. 估算成功概率

**输出格式（JSON）：**
\`\`\`json
{
  "strategy": "argue_novelty",
  "analysis": "审查意见分析...",
  "amendments": [
    "修改建议1：...",
    "修改建议2：..."
  ],
  "arguments": [
    "答复理由1：...",
    "答复理由2：..."
  ],
  "estimatedSuccessRate": 0.75
}
\`\`\`

请只返回JSON，不要包含其他说明文字。`;
}

// 重新导出枚举
export { InventionType } from '../types/patent.js';
