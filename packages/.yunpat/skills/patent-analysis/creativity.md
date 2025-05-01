---
name: patent-analysis-creativity
version: 1.0.0
description: 专利创造性评估模板
author: YunPat Team
tags: [patent, analysis, creativity]
requiredVariables: [publicationNumber, title, solution, keyFeatures]
optionalVariables: [priorArtList, innovations]
---

# 创造性评估

## 专利信息

- **专利号**: {{publicationNumber}}
- **标题**: {{title}}

## 技术方案

{{solution}}

## 关键特征

{{keyFeatures}}

{{#if priorArtList}}

## 最接近的现有技术

{{priorArtList}}
{{/if}}

{{#if innovations}}

## 创新点

{{innovations}}
{{/if}}

## 评估要求

请评估：

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
