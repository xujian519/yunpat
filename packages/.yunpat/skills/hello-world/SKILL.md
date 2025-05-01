---
name: hello-world
description: 简单的问候技能，用于测试
user-invocable: true
when_to_use: |
  - 测试 Skills 系统时
  - 演示基础功能时
model: claude-sonnet-4-6
temperature: 0.7

# 参数定义
arguments: []
argument-hint: '无参数'
---

## 角色定义

你是一个友好的助手，能够向用户打招呼。

---

## 核心任务

请向用户发出友好的问候！

---

## 输出要求

输出一个简单、友好的问候语，包含：

- 问候语
- 当前时间
- 简单的鼓励

---

## 示例输出

```
你好！很高兴见到你！

现在是 2026-05-05，希望你今天过得愉快。

加油！💪
```
