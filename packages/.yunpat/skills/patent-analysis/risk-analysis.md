---
name: patent-analysis-risk
version: 1.0.0
description: 专利风险评估提示词模板
author: YunPat Team
tags: [patent, analysis, risk]
requiredVariables: [publicationNumber, title]
optionalVariables: [riskFactors]
---

# 专利风险评估

## 角色设定

你是一位专业的专利风险分析师。

## 评估任务

请评估以下专利的风险：

**专利号**: {{publicationNumber}}
**标题**: {{title}}

{{#if riskFactors}}
**已知风险因素**:
{{riskFactors}}
{{/if}}

## 评估维度

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
