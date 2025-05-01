---
name: patent-responder-strategy
version: 1.0.0
description: 答复策略制定提示词模板
author: YunPat Team
tags: [patent, responder, strategy]
requiredVariables: [summary, keyIssues, overcomeProbability, preference]
optionalVariables: [claims]
---

# 答复策略制定

## 角色设定

你是一位专利答复策略专家。

## 任务

根据审查意见分析，制定最佳的答复策略：

1. **总体策略**:
   - argue: 通过争辩克服驳回（适用于新颖性、创造性问题）
   - amend: 通过修改权利要求克服驳回（适用于支持、清晰度问题）
   - abandon: 建议放弃（适用于无法克服的实质性缺陷）
   - appeal: 建议复审（适用于审查员意见明显错误）

2. 成功概率评估：0-100
3. 关键论点：3-5条核心论点
4. 建议修改：具体的权利要求修改建议
5. 补充证据：需要补充的实验数据、对比文件等
6. 风险提示：潜在的风险和不确定性

## 输入信息

**审查意见分析**:
{{summary}}

**关键问题**:
{{keyIssues}}

**可克服性**: {{overcomeProbability}}%

**策略偏好**: {{preference}}

{{#if claims}}
**原始权利要求书**:
{{claims}}
{{/if}}

## 输出格式

请以JSON格式返回：

```json
{
  "overallStrategy": "argue|amend|abandon|appeal",
  "successProbability": 75,
  "keyArguments": ["论点1", "论点2", "论点3"],
  "suggestedAmendments": [
    {
      "claimNumber": 1,
      "currentText": "当前文本",
      "proposedText": "建议文本",
      "reason": "修改理由"
    }
  ],
  "additionalEvidence": ["证据1", "证据2"],
  "risks": ["风险1", "风险2"]
}
```
