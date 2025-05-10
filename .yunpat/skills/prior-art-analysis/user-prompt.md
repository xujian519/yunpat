---
name: prior-art-user-prompt
version: 2.0.0
description: 对比文件分析 Agent 的用户提示词模板
author: YunPat
tags: [patent, prior-art, user-prompt]
requiredVariables:
  - docTitle
  - docContent
optionalVariables:
  - docType
  - publicationNumber
  - applicant
  - inventors
  - publicationDate
  - analysisDepth
  - maxLength
---

## {{docType}}信息

标题: {{docTitle}}
{{#if publicationNumber}}公开号: {{publicationNumber}}{{/if}}
{{#if applicant}}申请人: {{applicant}}{{/if}}
{{#if inventors}}发明人: {{inventors}}{{/if}}
{{#if publicationDate}}日期: {{publicationDate}}{{/if}}

## 内容

{{docContent}}

---

请按以下JSON格式输出分析结果：

{
  "technical_analysis": {
    "technical_problems": {
      "main": "主要技术问题",
      "sub": ["子问题1", "子问题2"],
      "severity": "medium"
    },
    "technical_solution": {
      "core": "核心技术方案描述",
      "key_features": [
        {
          "feature": "特征描述",
          "necessity": "essential | important | optional",
          "confidence": 0.95
        }
      ],
      "implementation": "实施方式概述",
      "technical_effects": [
        {
          "effect": "效果描述",
          "metric": "性能指标",
          "improvement": "改进幅度",
          "confidence": 0.9
        }
      ]
    }
  }
}
