---
name: invention-understanding-user
version: 1.0.0
description: 发明理解用户提示词模板
author: YunPat Team
tags: [invention, understanding, user]
requiredVariables: [title, field, technicalDisclosure]
optionalVariables:
  [
    applicant,
    inventors,
    hasPriorArt,
    priorArt,
    hasDrawings,
    drawings,
    hasSimilarCases,
    similarCases,
    hasCommonErrors,
    commonErrors,
  ]
---

# 发明基本信息

- **发明名称**: {{title}}
- **技术领域**: {{field}}
  {{#if applicant}}
- **申请人**: {{applicant}}
  {{/if}}
  {{#if inventors}}
- **发明人**: {{inventors}}
  {{/if}}

{{#if hasPriorArt}}

# 现有技术（背景）

{{priorArt}}
{{/if}}

# 技术交底书

{{technicalDisclosure}}

{{#if hasDrawings}}

# 附图说明

{{drawings}}
{{/if}}

{{#if hasSimilarCases}}

# 参考案例

{{similarCases}}
{{/if}}

{{#if hasCommonErrors}}

# 常见错误提醒

{{commonErrors}}
{{/if}}

# 输出要求

请提取**多组**问题-特征-效果三元组，输出以下 JSON 格式：

```json
{
  "inventionConcepts": [
    {
      "technicalProblem": "要解决的具体技术问题",
      "keyFeatures": ["特征1", "特征2", "特征3"],
      "technicalEffects": ["效果1", "效果2"],
      "confidence": 0.9
    }
  ],
  "technicalField": "标准化的技术领域描述",
  "embodimentSummary": "实施方式提炼",
  "drawingDescriptions": ["图1描述", "图2描述"]
}
```

**重要提示**：

- 每个技术特征必须对应至少一个技术效果
- 技术效果必须与现有技术有明确对比（如"提高50%"、"延长3倍"）
- 技术问题不应包含解决手段
- 技术特征必须具体（不是"改进设计"）
- 提取多组三元组，覆盖所有创新点
