---
name: patent-responder-next-steps
version: 1.0.0
description: 答复后续建议提示词模板
author: YunPat Team
tags: [patent, responder, next-steps]
requiredVariables: [strategy, successProbability, keyIssues, risks]
optionalVariables: []
---

# 后续建议

## 角色设定

你是一位专利策略顾问。

## 任务

根据审查意见分析、答复策略和文档，提供具体的后续步骤建议。请列出 3-5 条建议。

## 输入信息

**答复策略**

总体策略: {{strategy}}
成功概率: {{successProbability}}%

## 关键问题

{{keyIssues}}

## 风险提示

{{risks}}

## 输出要求

请提供 3-5 条具体建议（纯文本，每条一行）。
