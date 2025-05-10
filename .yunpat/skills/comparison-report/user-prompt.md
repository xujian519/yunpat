---
name: comparison-report-user-prompt
version: 2.0.0
description: 对比分析报告 Agent 的用户提示词模板
author: YunPat
tags: [patent, comparison, user-prompt]
requiredVariables:
  - inventionProblem
  - inventionSolution
  - inventionFeatures
  - priorArtSummary
optionalVariables:
  - inventionEffects
---

## 发明信息

技术问题: {{inventionProblem}}
技术方案: {{inventionSolution}}
技术效果: {{inventionEffects}}
关键特征: {{inventionFeatures}}

{{priorArtSummary}}

---

请生成对比分析报告，输出以下JSON格式：

```json
{
  "closest_prior_art": {
    "publication_number": "最接近现有技术的公开号",
    "title": "标题",
    "similarity": 0.5,
    "reason": "为什么是最接近的现有技术（需具体说明相似点）"
  },
  "distinct_features": [
    {
      "feature": "区别特征的具体描述",
      "novelty": "high | medium | low",
      "evidence": ["证据1：对比文件中未公开XXX", "证据2：对比文件中YYY不能实现该功能"]
    }
  ],
  "technical_problem": {
    "original": "发明原始技术问题",
    "refined": "提炼后的技术问题（基于区别特征重新定义）",
    "refinement_reason": "提炼理由"
  },
  "technical_solution": {
    "original": "发明原始技术方案",
    "refined": {
      "core": "提炼后的核心创新点",
      "innovative": ["创新特征1：具体说明为何创新", "创新特征2"],
      "obvious": ["显而易见特征1：说明理由", "显而易见特征2"]
    }
  },
  "technical_effects": {
    "original": ["原始技术效果1", "原始技术效果2"],
    "refined": {
      "unexpected": ["预料不到的技术效果1：说明为何出乎意料"],
      "expected": ["可预期的技术效果1"]
    }
  },
  "inventiveness": {
    "score": 0.7,
    "key_factors": ["创造性因素1：具体说明", "创造性因素2"]
  },
  "protection_scope": {
    "independent_claims": ["独立权利要求1：具体撰写建议"],
    "dependent_claims": [["从属权利要求1-1", "从属权利要求1-2"]],
    "breadth": "保护范围评估（宽/适中/窄）及理由"
  }
}
```

**关键要求**：
- 区别特征必须逐一与对比文件对比，给出具体证据
- 创造性评分需综合考虑：区别特征的显著程度、技术效果的预料不到性、技术启示是否存在
- 保护范围建议应兼顾授权前景和商业价值
- 使用专利术语标准化用语（固定连接、配置、采用等）
