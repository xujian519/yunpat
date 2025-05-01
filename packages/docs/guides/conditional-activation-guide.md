# Skills 条件激活使用指南

**版本**: 1.0.0
**更新日期**: 2026-05-05

---

## 📖 概述

条件激活机制允许 Skills 根据文件路径、文件类型和 Agent 名称自动激活，无需手动指定使用哪个 Skill。

---

## 🚀 快速开始

### 1. 在 SKILL.md 中配置条件

```yaml
---
name: my-skill
description: 我的技能

# 路径模式（使用 Glob）
paths:
  - '**/*.pdf' # 所有 PDF 文件
  - 'src/**/*.ts' # src 目录下所有 TypeScript 文件

# 或使用文件扩展名
file-types:
  - '.pdf'
  - '.md'

# 或指定 Agent
agent:
  - 'MyAgent'
  - 'AnotherAgent'
---
```

### 2. 在 Agent 中使用

```typescript
import { SkillsProfessionalAgent } from '@yunpat/agent-base'

class MyAgent extends SkillsProfessionalAgent {
  async processFile(filePath: string) {
    // 自动激活并调用匹配的 Skill
    const result = await this.callActiveSkill(filePath, {
      content: await readFile(filePath),
    })

    if (result) {
      console.log(`使用 ${result.skillName} 处理 ${filePath}`)
    } else {
      console.log('没有匹配的 Skill')
    }
  }
}
```

---

## 📋 配置选项

### paths（路径模式）

使用 [Glob 模式](<https://en.wikipedia.org/wiki/Glob_(programming)>) 匹配文件路径。

```yaml
paths:
  - '**/*.pdf' # 所有 PDF 文件
  - 'src/**/*.tsx' # src 目录下所有 TSX 文件
  - '**/{test,spec}/**/*.ts' # test 或 spec 目录
  - 'docs/**/*' # docs 目录下所有文件
```

**Glob 语法**：

- `*` - 匹配任意文件名
- `**` - 匹配任意目录层级
- `?` - 匹配单个字符
- `{a,b}` - 匹配 a 或 b
- `[a-z]` - 匹配 a-z 范围

### file-types（文件扩展名）

直接指定文件扩展名（包含点号）。

```yaml
file-types:
  - '.pdf'
  - '.md'
  - '.txt'
```

**注意**: `file-types` 比 `paths` 更快，但功能更简单。

### agent（Agent 限制）

指定哪些 Agent 可以使用此 Skill。

```yaml
agent:
  - 'PatentWriter'
  - 'PatentAnalyzer'
```

**注意**: 如果不指定 `agent`，所有 Agent 都可以使用此 Skill。

---

## 🔍 匹配规则

### 优先级顺序

1. **路径匹配** (`paths`) - 最高优先级
2. **文件类型匹配** (`file-types`)
3. **Agent 匹配** (`agent`)
4. **无条件激活** - 默认激活

### 匹配逻辑

```typescript
// 默认策略：匹配任一条件即激活
const results = activator.getActiveSkills(skills, {
  filePath: '/path/to/file.pdf',
  agentName: 'MyAgent',
})

// 返回所有满足以下条件之一的 Skills：
// 1. paths 包含匹配的模式
// 2. file-types 包含文件的扩展名
// 3. agent 包含当前 Agent 名称
// 4. 无任何条件限制
```

---

## 💡 使用场景

### 场景 1: 文件类型自动识别

```yaml
# patent-analysis/SKILL.md
paths: ["**/*.pdf"]

# invention-understanding/SKILL.md
paths: ["**/*.md", "**/*.txt"]

# 代码自动匹配
agent.callActiveSkill('/path/to/patent.pdf')
  → 使用 patent-analysis

agent.callActiveSkill('/path/to/invention.md')
  → 使用 invention-understanding
```

### 场景 2: 专用 Agent 限制

```yaml
# admin-skill/SKILL.md
agent: ['AdminAgent']

# 只有 AdminAgent 可以使用此 Skill
```

### 场景 3: 组合条件

```yaml
# specialized-analysis/SKILL.md
paths: ['**/*.pdf']
agent: ['ExpertAgent']

# 仅 ExpertAgent 处理 PDF 文件时激活
```

---

## 🛠️ API 参考

### SkillsProfessionalAgent

#### getActiveSkills(filePath: string): ActivationResult[]

获取指定路径应激活的所有 Skills。

```typescript
const results = agent.getActiveSkills('/path/to/file.pdf')

results.forEach((result) => {
  console.log(result.skill.name) // Skill 名称
  console.log(result.matchedBy) // 'path' | 'fileType' | 'agent' | 'default'
  console.log(result.matchedPattern) // 匹配的模式
})
```

#### isSkillActive(skillName: string, filePath: string): boolean

检查指定 Skill 是否应激活。

```typescript
if (agent.isSkillActive('patent-analysis', '/path/to/file.pdf')) {
  // 使用 patent-analysis
}
```

#### callActiveSkill(filePath, args): Promise<Result | null>

自动激活并调用第一个匹配的 Skill。

```typescript
const result = await agent.callActiveSkill('/path/to/file.pdf', {
  analysis_depth: 2,
})

if (result) {
  console.log(`使用 ${result.skillName} 处理`)
}
```

---

## 🎯 最佳实践

### 1. 使用明确的路径模式

```yaml
# ✅ 好的做法
paths: ["src/components/**/*.tsx"]

# ❌ 避免过于宽泛
paths: ["**/*"]
```

### 2. 优先使用 file-types

```yaml
# ✅ 更快
file-types: ['.pdf']

# ❌ 较慢（但更灵活）
paths: ['**/*.pdf']
```

### 3. 为 Skills 设置合理的作用域

```yaml
# ✅ 专用技能
paths: ['patents/**/*.pdf']
agent: ['PatentAnalyzer']

# ✅ 通用技能
# 不设置任何条件
```

### 4. 在文档中说明用途

```yaml
---
when_to_use: |
  - 分析 PDF 格式的专利文件
  - 需要在 PatentAnalyzer Agent 中使用
---
```

---

## 🧪 测试条件激活

```typescript
// 测试 Skill 是否正确配置
describe('My Skills', () => {
  it('should activate for PDF files', () => {
    const isActive = agent.isSkillActive('patent-analysis', '/path/to/patent.pdf')
    expect(isActive).toBe(true)
  })

  it('should not activate for non-PDF files', () => {
    const isActive = agent.isSkillActive('patent-analysis', '/path/to/file.md')
    expect(isActive).toBe(false)
  })
})
```

---

## ⚠️ 注意事项

1. **路径分隔符**: 无论在 Windows、macOS 还是 Linux 上，都使用 `/`
2. **大小写**: 默认不区分大小写（可通过 `PathMatcherConfig` 配置）
3. **性能**: 使用 `file-types` 比 `paths` 更快
4. **优先级**: 多个 Skills 匹配时，按优先级排序返回

---

## 📚 相关资源

- [Glob 语法指南](<https://en.wikipedia.org/wiki/Glob_(programming)>)
- [minimatch 文档](https://github.com/isaacs/minimatch)
- [阶段三总结](../reports/2026-05/phase-3-summary.md)

---

**最后更新**: 2026-05-05
