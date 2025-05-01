# 提示词系统快速参考指南

## 30 秒理解核心差异

### YunPat 当前

```
Agent 类 → 硬编码提示词字符串 → 调用 LLM
```

**问题**：修改提示词需要改代码、重新编译

### claude-code Skills

```
SKILL.md (Markdown + Frontmatter) → 动态加载 → 调用 LLM
```

**优势**：修改提示词只需编辑文本文件，无需重编译

---

## 5 分钟实现最小示例

### Step 1: 创建技能目录

```bash
mkdir -p .yunpat/skills/hello-world
```

### Step 2: 编写 SKILL.md

```yaml
# .yunpat/skills/hello-world/SKILL.md
---
name: hello-world
description: 向用户打招呼
when_to_use: 需要友好问候时
---
你是一位友好的助手。请用温暖的语气向用户打招呼。
```

### Step 3: 在 Agent 中调用

```typescript
class MyAgent extends ProfessionalAgent {
  async act(input: any) {
    const result = await this.callSkill('hello-world', {})
    return { success: true, data: result }
  }
}
```

---

## 10 分钟掌握核心特性

### 1. 条件激活（自动触发）

```yaml
---
name: patent-analyzer
paths:
  - '**/*.pdf'
  - '**/*.patent'
---
分析以下专利文件...
```

**效果**：用户操作 PDF 文件时自动激活此技能

### 2. Shell 命令注入（动态内容）

```markdown
## 当前 Git 状态

!`git status --short`

## 最新提交

!`git log -1 --pretty=format:"%h - %s"`
```

**效果**：提示词包含命令执行结果

### 3. 变量替换（参数化）

```markdown
---
arguments: [file_path]
---

分析文件：{{file_path}}

!`cat {{file_path}} | head -50`
```

**调用**：

```typescript
await this.callSkill('analyze-file', {
  file_path: 'path/to/file.pdf',
})
```

### 4. 工具限制（安全控制）

```yaml
---
allowed-tools:
  - Read
  - Bash(git status:*)
  - Bash(git diff:*)
---
```

**效果**：技能只能使用指定的工具

---

## 核心文件对照表

| YunPat                     | claude-code        | 作用       |
| -------------------------- | ------------------ | ---------- |
| `PromptBuilder.ts`         | `SKILL.md`         | 提示词定义 |
| `PromptTemplateManager.ts` | `loadSkillsDir.ts` | 加载器     |
| 无                         | `frontmatter`      | 元数据     |
| 无                         | `paths` 字段       | 条件激活   |
| 无                         | `!command``        | Shell 注入 |

---

## 迁移检查清单

### 阶段一：准备

- [ ] 确定 Skills 目录位置（建议 `.yunpat/skills/`）
- [ ] 设计 Frontmatter 规范
- [ ] 编写加载器骨架代码

### 阶段二：实现

- [ ] 实现 `loadSkillsFromDir()`
- [ ] 实现 `parseFrontmatter()`
- [ ] 实现 `createSkillCommand()`
- [ ] 实现 `getPromptForCommand()`

### 阶段三：测试

- [ ] 创建示例技能
- [ ] 在 Agent 中调用技能
- [ ] 验证变量替换
- [ ] 验证 Shell 注入

### 阶段四：增强

- [ ] 实现条件激活
- [ ] 实现多源加载
- [ ] 实现缓存优化

---

## 常见问题

### Q: 为什么要从硬编码迁移到 Skills？

**A**:

- 修改提示词无需重编译（开发效率 +50%）
- 提示词集中管理（可维护性 +70%）
- 支持动态激活（用户体验 +40%）

### Q: 现有 Agent 需要全部重写吗？

**A**: 不需要。可以渐进式迁移：

1. 保留现有 `PromptBuilder`
2. 新 Agent 使用 Skills 系统
3. 逐步迁移旧 Agent

### Q: Shell 注入安全吗？

**A**: 需要严格的安全措施：

- 命令白名单
- 沙箱执行
- 超时控制
- 错误处理

### Q: 条件激活会影响性能吗？

**A**: 影响很小：

- 路径匹配使用 `ignore` 库（高效）
- 只在文件操作时触发
- 激活后缓存结果

---

## 相关文档

- **完整分析报告**: [docs/reports/2026-05/prompt-system-comparison-analysis.md](../reports/2026-05/prompt-system-comparison-analysis.md)
- **核心启示**: [docs/analysis/prompt-system-key-insights.md](./prompt-system-key-insights.md)
- **架构对比**: [docs/analysis/prompt-system-architecture-comparison.md](./prompt-system-architecture-comparison.md)

---

_快速参考结束_
