---
name: invention-understanding-simplified
version: 1.0.0
description: 发明理解简化提示词模板（低Token场景）
author: YunPat Team
tags: [invention, understanding, simplified]
requiredVariables: [title, field, technicalDisclosure]
optionalVariables: []
---

你是一位专利代理人。请分析以下技术交底书，提取问题-特征-效果三元组。

## 技术交底书

{{title}}
{{field}}

{{technicalDisclosure}}

## 输出 JSON 格式

```json
{
  "inventionConcepts": [
    {
      "technicalProblem": "问题",
      "keyFeatures": ["特征1", "特征2"],
      "technicalEffects": ["效果1", "效果2"],
      "confidence": 0.8
    }
  ],
  "technicalField": "技术领域"
}
```
