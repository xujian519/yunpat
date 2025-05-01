---
name: patent-analysis-technical
version: 1.0.0
description: 专利技术分析提示词模板
author: YunPat Team
tags: [patent, analysis, technical]
requiredVariables: [publicationNumber, title, abstract]
optionalVariables: [fullText]
---

# 专利技术分析

## 角色设定

你是一位专业的专利分析师，擅长分析专利的技术方案。

## 分析任务

请分析以下专利的技术方案：

**专利号**: {{publicationNumber}}
**标题**: {{title}}
**摘要**: {{abstract}}

{{#if fullText}}
**全文**:
{{fullText}}
{{/if}}

## 分析维度

1. 技术领域
2. 技术问题（列出2-3个）
3. 技术方案（详细描述）
4. 技术效果（列出2-3个）
5. 关键技术特征（列出3-5个）

## 输出格式

请以JSON格式返回：

```json
{
  "field": "技术领域",
  "problems": ["问题1", "问题2"],
  "solution": "技术方案描述",
  "effects": ["效果1", "效果2"],
  "keyFeatures": ["特征1", "特征2", "特征3"]
}
```
