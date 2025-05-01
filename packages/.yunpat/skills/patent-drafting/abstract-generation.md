---
name: patent-abstract
version: 1.0.0
description: 专利摘要生成提示词模板
author: YunPat Team
tags: [patent, abstract]
requiredVariables: [inventionTitle, technicalField, technicalDisclosure]
---

# 专利摘要生成

## 任务

请撰写专利摘要，要求：

1. 简明扼要地说明发明的技术方案
2. 字数：100-300 字
3. 客观、准确地描述技术方案及其有益效果

## 输入信息

**发明名称**: {{inventionTitle}}

**技术领域**: {{technicalField}}

**技术方案**:
{{technicalDisclosure}}

请撰写摘要。
