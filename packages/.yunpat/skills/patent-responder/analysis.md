---
name: patent-responder-analysis
version: 1.0.0
description: 审查意见分析提示词模板
author: YunPat Team
tags: [patent, responder, analysis]
requiredVariables: [applicationNumber, patentTitle, officeActionContent]
optionalVariables: [examiner, notificationDate, deadline, citedReferences, rejectionTypes, claims]
---

# 审查意见分析

## 角色设定

你是一位专业的专利代理人，擅长分析审查意见。

## 分析任务

请分析以下审查意见：

**申请号**: {{applicationNumber}}
**专利名称**: {{patentTitle}}
{{#if examiner}}
**审查员**: {{examiner}}
{{/if}}
{{#if notificationDate}}
**审查通知日期**: {{notificationDate}}
{{/if}}
{{#if deadline}}
**答复期限**: {{deadline}}
{{/if}}

**审查意见内容**:
{{officeActionContent}}

{{#if citedReferences}}
**引用的对比文件**:
{{citedReferences}}
{{/if}}

{{#if rejectionTypes}}
**审查意见类型**: {{rejectionTypes}}
{{/if}}

{{#if claims}}
**原始权利要求书**:
{{claims}}
{{/if}}

## 分析维度

1. 审查意见摘要（50-100字）
2. 关键问题识别（3-5个问题，每个问题包括：类型、描述、严重程度）
3. 可克服性评估（0-100分）

## 动态知识检索

分析过程中应主动检索以下知识源：

1. **法条全文检索**：识别 OA 中引用的法条编号后，调用 `PostgreSQLClient.searchLawArticles()` 获取法条全文，确保对法条的理解准确
2. **类似无效决定检索**：根据技术领域和审查意见类型，调用 `PostgreSQLClient.queryInvalidDecisions()` 搜索相似案例，参考成功答复先例
3. **推理模式匹配**：根据审查意见类型匹配对应的推理模式：
   - 创造性驳回 → 参考「推理模式-创造性-\*」系列
   - 新颖性驳回 → 参考「推理模式-新颖性-\*」系列
   - 权利要求不支持 → 参考「推理模式-权利要求-不支持认定」

{{#if lawArticles}}
**检索到的法条**:
{{lawArticles}}
{{/if}}

{{#if similarCases}}
**类似先例**:
{{similarCases}}
{{/if}}

## 输出格式

请以JSON格式返回：

```json
{
  "summary": "审查意见摘要",
  "keyIssues": [{ "type": "问题类型", "description": "问题描述", "severity": "high|medium|low" }],
  "overcomeProbability": 70
}
```
