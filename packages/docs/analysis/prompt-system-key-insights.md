# 提示词系统对比分析 - 核心启示

> 基于 YunPat 与 claude-code 项目的深度对比分析
> 日期: 2026-05-05

---

## 一句话总结

**claude-code 的 Skills 系统是一个完全解耦、元数据驱动、动态激活的提示词管理架构，相比 YunPat 当前的硬编码+简单模板方案，在可维护性、灵活性和用户体验上具有代际优势。**

---

## 核心差异一览表

| 维度           | YunPat 当前    | claude-code                           | 差距等级   |
| -------------- | -------------- | ------------------------------------- | ---------- |
| **架构**       | Agent 内硬编码 | Skills 独立模块                       | 🔴🔴🔴🔴🔴 |
| **元数据**     | 无 frontmatter | 丰富元数据系统                        | 🔴🔴🔴🔴🔴 |
| **动态加载**   | 静态预加载     | 运行时发现+加载                       | 🔴🔴🔴🔴🔴 |
| **条件激活**   | 不支持         | 基于路径自动激活                      | 🔴🔴🔴🔴   |
| **Shell 注入** | 不支持         | `!command`` 语法                      | 🔴🔴🔴     |
| **缓存策略**   | 无             | 分层缓存(静态/动态)                   | 🔴🔴🔴🔴   |
| **多源加载**   | 单一目录       | 5源(managed/user/project/bundled/MCP) | 🔴🔴🔴     |

---

## 可直接借鉴的设计

### 1. Skills Frontmatter 规范

```yaml
---
name: patent-analyzer
description: 分析专利文件
user-invocable: true
when_to_use: 分析专利时
allowed-tools: [Read, Bash]
model: claude-sonnet-4-6
paths:
  - "**/*.pdf"
  - "**/*.patent"
---

## 角色定义
你是一位资深专利分析师...

## 当前状态
!`yunpat patent status --format table`
```

**关键元数据字段**：

- `when_to_use`: 何时使用
- `allowed-tools`: 工具白名单
- `paths`: 条件激活路径模式
- `model`: 指定模型
- `hooks`: 生命周期钩子

### 2. 条件激活机制

```typescript
// 当用户操作 PDF 文件时，自动激活 patent-analyzer 技能
activateConditionalSkillsForPaths(['path/to/file.pdf'])
// → 自动加载 patent-analyzer 技能
```

### 3. Shell 命令注入

```markdown
## 当前专利状态

!`yunpat patent status --format table`

## 最新审查意见

!`yunpat patent oa --latest`
```

**优势**：提示词本身可包含动态内容，无需修改 Agent 代码

### 4. 分层缓存策略

```typescript
const prompt = [
  // === 静态部分（全局缓存）===
  '## 角色定义\n...',
  '## 核心任务\n...',

  SYSTEM_PROMPT_DYNAMIC_BOUNDARY, // 边界标记

  // === 动态部分（会话特定）===
  `## 当前工作目录\n${cwd}`,
  `## 用户输入\n${userInput}`,
]
```

**优势**：静态部分使用全局缓存，降低 API 成本

---

## 实施路线图

### 阶段一：基础 Skills 系统（1-2周）

**目标**：实现基本的模块化提示词系统

```
.yunpat/skills/
├── patent-analyzer/
│   └── SKILL.md
├── invention-understanding/
│   └── SKILL.md
└── claims-drafting/
    └── SKILL.md
```

**任务**：

1. 设计 Skill Frontmatter 规范
2. 实现 `loadSkillsFromDir()` 加载器
3. 实现 `parseSkillFrontmatter()` 解析器
4. 实现 `getPromptForCommand()` 渲染器

### 阶段二：条件激活（1周）

**目标**：实现基于文件路径的智能激活

**效果**：操作 PDF 文件时自动激活专利分析技能

### 阶段三：Shell 注入（1周）

**目标**：支持 `!command`` 语法

**效果**：提示词可包含动态命令输出

### 阶段四：缓存优化（1周）

**目标**：实现分层缓存策略

**效果**：API 成本降低 30%

---

## 预期收益

- **开发效率**：+50%（提示词修改无需重新编译）
- **可维护性**：+70%（提示词集中管理）
- **用户体验**：+40%（条件自动激活）
- **API 成本**：-30%（分层缓存）

---

## 快速示例

### 重构前

```typescript
// packages/agents/invention/src/PromptBuilder.ts
export class PromptBuilder {
  buildSystemPrompt(): string {
    return `## 角色定义\n你是一位专利代理人...`
  }
}
```

### 重构后

```yaml
# .yunpat/skills/invention-understanding/SKILL.md
---
name: invention-understanding
description: 深入理解技术交底书
when_to_use: 分析技术交底书时
---

## 角色定义
你是一位专利代理人...

## 当前状态
!`yunpat invention status`
```

**调用方式**：

```typescript
const result = await agent.callSkill('invention-understanding', input)
```

---

## 完整分析报告

详见：[docs/reports/2026-05/prompt-system-comparison-analysis.md](../reports/2026-05/prompt-system-comparison-analysis.md)

---

_核心启示结束_
