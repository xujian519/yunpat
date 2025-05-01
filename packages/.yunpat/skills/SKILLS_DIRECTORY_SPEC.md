# YunPat Skills 目录规范

**版本**: v1.0
**日期**: 2026-05-05

---

## 目录结构

```
.yunpat/skills/
├── examples/              # 示例 Skills
│   ├── hello-world/
│   │   └── SKILL.md
│   └── README.md
├── invention-understanding/
│   └── SKILL.md
├── claims-drafting/
│   └── SKILL.md
├── specification-drafting/
│   └── SKILL.md
└── patent-analysis/
    └── SKILL.md
```

---

## 命名规范

### 目录命名

- **格式**: 小写，连字符分隔
- **示例**: `invention-understanding`, `claims-drafting`
- **规则**:
  - 只能包含小写字母（a-z）
  - 单词之间用连字符（-）分隔
  - 不能有空格或特殊字符
  - 不能以连字符开头或结尾

### 文件命名

- **格式**: 固定为 `SKILL.md`（大写）
- **位置**: 每个技能目录的根目录
- **规则**:
  - 必须使用大写 `SKILL.md`
  - 不能使用其他文件名
  - 每个技能目录只能有一个 `SKILL.md` 文件

---

## 文件组织

### 单个 Skill 目录

```
skill-name/
├── SKILL.md              # 必需：技能定义文件
├── assets/               # 可选：资源文件
│   ├── images/
│   └── templates/
├── tests/                # 可选：测试文件
│   ├── test-cases.json
│   └── expected-output.md
└── README.md             # 可选：技能说明
```

---

## SKILL.md 模板

```yaml
---
# 基本信息
name: skill-name
description: 技能描述
version: 1.0.0

# 可见性控制
user-invocable: true
hidden: false

# 使用指导
when_to_use: |
  - 场景一
  - 场景二

# 工具限制
allowed-tools:
  - Read
  - Bash(command:*)

# 模型配置
model: claude-sonnet-4-6
temperature: 0.3

# 条件激活
paths:
  - "**/*.pdf"
  - "**/*.patent"

# 知识库增强
knowledge:
  concepts:
    - 三步法
    - 创造性
  wiki_pages:
    - "专利实务/创造性/创造性-概述与三步法框架.md"
  max_items: 3

# 参数定义
arguments: [file_path, depth]
argument-hint: "(可选) 文件路径和分析深度"
---

## 角色定义

你是一位...

## 核心任务

请完成以下任务...

## 输出要求

请按以下格式输出...
```

---

## 最佳实践

### 1. 目录命名

**推荐**：

- ✅ `invention-understanding`
- ✅ `claims-drafting`
- ✅ `patent-analysis`

**不推荐**：

- ❌ `InventionUnderstanding`
- ❌ `invention_understanding`
- ❌ `invention.understanding`

### 2. 描述编写

**推荐**：

- ✅ `description: 深度分析专利文件，提取技术要点`
- ✅ `description: 基于技术交底书撰写权利要求`

**不推荐**：

- ❌ `description: 分析专利`
- ❌ `description: 写权利要求`

### 3. 文件组织

**推荐**：

- ✅ 每个技能一个目录
- ✅ 目录名称与技能名称一致
- ✅ 只有一个 `SKILL.md` 文件

**不推荐**：

- ❌ 多个技能共享一个目录
- ❌ 目录名称与技能名称不一致
- ❌ 有多个 `.md` 文件

---

## 迁移指南

### 从 PromptBuilder 迁移

**Before**:

```typescript
class MyAgent {
  buildPrompt() {
    return `你是...`
  }
}
```

**After**:

```yaml
---
name: my-skill
description: 我的技能
---
你是...
```

然后在 Agent 中调用：

```typescript
await this.callSkill('my-skill', args)
```

---

## 检查清单

创建新 Skill 时，请检查：

- [ ] 目录名称符合命名规范
- [ ] 使用 `SKILL.md` 作为文件名（大写）
- [ ] Frontmatter 包含必需字段（name 或 description）
- [ ] 描述清晰、具体
- [ ] 参数定义完整（如果有）
- [ ] 测试用例完整（可选）

---

_目录规范结束_
