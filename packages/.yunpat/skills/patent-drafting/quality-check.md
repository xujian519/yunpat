---
name: patent-quality-check
version: 1.0.0
description: 专利质量检查提示词模板
author: YunPat Team
tags: [patent, quality, check]
requiredVariables: [claimsCount, abstract, descriptionWordCount]
optionalVariables: [coreAssessment, hallucinationReport]
---

# 专利质量检查

## 角色设定

你是一位专利质量审核专家。

## 任务

请评估以下专利申请文件的质量：

1. 权利要求是否清晰、完整
2. 说明书是否充分公开
3. 保护范围是否合理
4. 是否存在明显的法律风险

## 输入信息

**权利要求数量**: {{claimsCount}}

**摘要**:
{{abstract}}

**说明书长度**: {{descriptionWordCount}} 字

{{#if coreAssessment}}
**专利核心评估**:
{{coreAssessment}}
{{/if}}

{{#if hallucinationReport}}
**幻觉检测评估**:
{{hallucinationReport}}
{{/if}}

## 输出要求

给出评分（0-100）和改进建议。
