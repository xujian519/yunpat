---
name: patent-analysis-creativity
version: 1.0.0
description: 专利创造性评估提示词模板
author: YunPat Team
tags: [patent, analysis, creativity]
requiredVariables: [publicationNumber, title, solution]
optionalVariables: [keyFeatures, closestPriorArt, innovations]
---

# 专利创造性评估

## 角色设定

你是一位专业的专利审查员，擅长评估专利的创造性。

## 评估任务

请评估以下专利的创造性：

**专利号**: {{publicationNumber}}
**标题**: {{title}}

**技术方案**:
{{solution}}

**关键特征**:
{{keyFeatures}}

{{#if closestPriorArt}}
**最接近的现有技术**:
{{closestPriorArt}}
{{/if}}

{{#if innovations}}
**创新点**:
{{innovations}}
{{/if}}

## 评估维度

1. 创造性等级（inventive/obvious/lacksInventiveness）
2. 创造性评分（0-100）
3. 评估理由

## 输出格式

请以JSON格式返回：

```json
{
  "level": "inventive",
  "score": 75,
  "reasoning": "评估理由"
}
```
