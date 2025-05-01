---
name: patent-analysis-risk
version: 1.0.0
description: 专利风险评估模板
author: YunPat Team
tags: [patent, analysis, risk]
requiredVariables: [publicationNumber, title, riskFactors]
optionalVariables: []
---

# 风险评估

## 专利信息

- **专利号**: {{publicationNumber}}
- **标题**: {{title}}

## 已知风险因素

{{#if riskFactors}}
{{riskFactors}}
{{else}}

- 无明显风险因素
  {{/if}}

## 评估要求

请评估：

1. 无效风险等级（low/medium/high）
2. 侵权风险等级（low/medium/high）
3. 补充风险因素（如有）

## 输出格式

请以JSON格式返回：

```json
{
  "invalidityRisk": "medium",
  "infringementRisk": "low",
  "riskFactors": ["风险因素1", "风险因素2"]
}
```
