# YunPat Skills 模板

> 使用此模板快速创建新的 Skill

---

## 快速开始

### 1. 复制模板

```bash
cp -r .yunpat/skills/examples/hello-world .yunpat/skills/your-skill-name
```

### 2. 编辑 SKILL.md

```bash
cd .yunpat/skills/your-skill-name
vim SKILL.md
```

### 3. 测试 Skill

```typescript
await this.callSkill('your-skill-name', args)
```

---

## SKILL.md 模板

```yaml
---
# ============ 基本信息 ============
name: your-skill-name
description: |
  清晰、具体的技能描述。

  支持的场景：
  - 场景一
  - 场景二

  输出内容：
  - 内容一
  - 内容二
version: 1.0.0

# ============ 可见性控制 ============
user-invocable: true          # 用户是否可直接调用
hidden: false                 # 是否在列表中隐藏

# ============ 使用指导 ============
when_to_use: |
  - 场景一：具体描述
  - 场景二：具体描述

# ============ 工具限制 ============
# 可选：限制此技能可使用的工具
allowed-tools:
  - Read
  - Bash(yunpat patent status:*)
  - Bash(yunpat search:*)

# ============ 模型配置 ============
# 可选：指定使用的模型和参数
model: claude-sonnet-4-6
temperature: 0.3
max-tokens: 4000

# ============ 条件激活 ============
# 可选：基于文件路径自动激活
paths:
  - "**/*.pdf"
  - "**/*.patent"
  - "**/technical-disclosure.md"

file-types:
  - pdf
  - patent
  - markdown

# ============ 知识库增强 ============
# 可选：关联知识库内容
knowledge:
  concepts:               # 相关概念
    - 三步法
    - 创造性
  wiki_pages:             # Wiki 页面
    - "专利实务/创造性/创造性-概述与三步法框架.md"
  cards:                  # 知识卡片（支持通配符）
    - "20260429-三步法-*.md"
  max_items: 3            # 最多返回数量

# ============ 参数定义 ============
# 可选：定义此技能接受的参数
arguments: [file_path, analysis_depth]
argument-hint: "(可选) 文件路径和分析深度"

# ============ 执行上下文 ============
# 可选：指定执行模式或特定 Agent
context: inline           # inline | fork
agent: patent-expert      # 指定 Agent

# ============ 努力程度 ============
# 可选：指定分析深度
effort: medium             # low | medium | high | number

# ============ Hooks ============
# 可选：生命周期钩子
hooks:
  before:                 # 执行前
    - type: log
      level: info
      message: "开始分析..."
  after:                  # 执行后
    - type: save
      dir: "results"
      format: "json"

# ============ Shell 执行 ============
# 可选：Shell 命令注入配置
shell: bash               # bash | node
shell-timeout: 5000       # 超时时间（毫秒）
allowed-commands:         # 命令白名单
  - git status
  - git diff
  - cat
  - head

# ============ 其他 ============
tags:                     # 标签
  - patent
  - analysis
  - v1

deprecated: false         # 是否弃用
debug: false              # 调试模式
log-level: info           # 日志级别
---

## 角色定义

你是一位资深的专利代理人/分析师/撰写人。

### 核心专长

- 专长一：具体描述
- 专长二：具体描述
- 专长三：具体描述

### 工作原则

1. 原则一
2. 原则二
3. 原则三

---

## 核心任务

请完成以下任务：

### 任务一：XXX

具体任务描述...

### 任务二：XXX

具体任务描述...

---

## 输入信息

{{#if file_path}}
- **文件路径**：{{file_path}}
{{/if}}

{{#if analysis_depth}}
- **分析深度**：{{analysis_depth}}
{{/if}}

---

## 输出要求

请按以下格式输出：

### 1. 第一部分

**要求**：
- 要点一
- 要点二

### 2. 第二部分

**要求**：
- 要点一
- 要点二

---

## 参考标准

{{#knowledge.concepts}}
### {{name}}

{{description}}
{{/knowledge.concepts}}

---

## 示例

### 输入示例

```

输入内容...

```

### 输出示例

```

输出内容...

```

---

## 注意事项

1. 注意事项一
2. 注意事项二
3. 注意事项三
```

---

## 示例：hello-world

```yaml
---
name: hello-world
description: 向用户打招呼
user-invocable: true
when_to_use: 需要友好问候时
model: claude-sonnet-4-6
temperature: 0.7
---
你是一位友好的专利助手。

请用温暖的语气向用户打招呼，并询问今天能帮助他们完成什么专利相关工作。
```

---

## 示例：patent-analyzer

```yaml
---
name: patent-analyzer
description: 深度分析专利文件，提取技术要点
user-invocable: true
when_to_use: |
  - 分析专利申请文件时
  - 评估专利技术方案时
allowed-tools:
  - Read
  - Bash(yunpat patent status:*)
model: claude-sonnet-4-6
temperature: 0.3

paths:
  - "**/*.pdf"
  - "**/*.patent"

knowledge:
  concepts:
    - 三步法
    - 创造性
  wiki_pages:
    - "专利实务/创造性/创造性-概述与三步法框架.md"
  max_items: 3

arguments: [file_path]
argument-hint: "专利文件路径"
---

## 角色定义

你是一位资深的专利代理人...

## 核心任务

请分析以下专利文件...

## 输出要求

请按以下格式输出...
```

---

## 检查清单

创建新 Skill 时，请检查：

### Frontmatter

- [ ] `name` 或 `description` 字段存在
- [ ] 名称符合命名规范
- [ ] 描述清晰、具体
- [ ] 参数定义完整（如果有）

### 内容

- [ ] 角色定义清晰
- [ ] 核心任务明确
- [ ] 输出要求具体
- [ ] 参考标准完整（如果有）

### 测试

- [ ] 创建测试用例
- [ ] 验证输出格式
- [ ] 检查边界情况

---

_模板结束_
