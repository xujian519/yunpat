---
name: patent-drawings
version: 1.0.0
description: 专利附图说明生成提示词模板
author: YunPat Team
tags: [patent, drawings]
requiredVariables: [drawings, plan]
---

# 专利附图说明生成

## 任务

请撰写附图说明，要求：

1. 结合附图详细描述实施方式
2. 每幅附图都应当说明
3. 字数适中，清晰易懂

## 输入信息

**附图列表**:
{{drawings}}

**技术方案**:
{{plan}}

请为以上附图撰写说明。
