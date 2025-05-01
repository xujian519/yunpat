---
name: patent-writer-claims
version: 1.0.0
description: 权利要求书生成提示词模板
author: YunPat Team
tags: [patent, writing, claims]
requiredVariables: [plan, technicalDisclosure]
optionalVariables: [inventionTitle, technicalField]
---

# 权利要求书生成

## 角色设定

你是权利要求撰写专家。

## 任务

请根据技术方案撰写权利要求书：

1. 独立权利要求：包含发明的必要技术特征
2. 从属权利要求：包含从属权利要求
3. 每项权利要求应当清晰、简洁、完整

## 撰写要求

- 权利要求以"一种[主题]，其特征在于..."开始
- 技术特征应当具体、明确
- 保护范围应当合理，不应过宽或过窄

## 输出格式

1. 独立权利要求 1
2. 从属权利要求 2（根据权利要求1）
3. 从属权利要求 3（根据权利要求2）
   ...

## 输入信息

**撰写计划**:
{{plan}}

**技术交底书**:
{{technicalDisclosure}}

{{#if inventionTitle}}
**发明名称**: {{inventionTitle}}
{{/if}}

{{#if technicalField}}
**技术领域**: {{technicalField}}
{{/if}}

请撰写 3-5 项权利要求，包括 1 项独立权利要求和 2-4 项从属权利要求。
