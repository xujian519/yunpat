# Skills 系统快速开始指南

**目标**: 30 分钟掌握 YunPat Skills 系统，创建你的第一个 Skill

---

## 前置准备

### 1. 确认环境

```bash
# 确认 Node.js 版本
node --version  # 应该 >= 18.0.0

# 确认 pnpm 版本
pnpm --version  # 应该 >= 8.0.0

# 确认项目依赖已安装
pnpm install
```

### 2. 创建 Skills 目录

```bash
# 在项目根目录创建
mkdir -p .yunpat/skills
```

---

## 5 分钟：创建第一个 Skill

### Step 1: 创建 Skill 目录

```bash
mkdir -p .yunpat/skills/hello-world
```

### Step 2: 编写 SKILL.md

```bash
cat > .yunpat/skills/hello-world/SKILL.md << 'EOF'
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
EOF
```

### Step 3: 在 Agent 中调用

```typescript
import { ProfessionalAgent } from '@yunpat/agent-base'

class MyAgent extends ProfessionalAgent {
  async act(input: any) {
    // 调用 Skill
    const result = await this.callSkill('hello-world', {})

    return {
      success: true,
      data: result,
    }
  }
}
```

**恭喜！** 你已经创建了第一个 Skill 🎉

---

## 15 分钟：创建实用 Skill

### 场景：专利文件分析

#### Step 1: 创建 Skill 目录

```bash
mkdir -p .yunpat/skills/patent-analyzer
```

#### Step 2: 编写 SKILL.md

```bash
cat > .yunpat/skills/patent-analyzer/SKILL.md << 'EOF'
---
name: patent-analyzer
description: 深度分析专利文件，提取技术要点
user-invocable: true
when_to_use: |
  - 分析专利申请文件时
  - 评估专利技术方案时
  - 对比多个专利时
allowed-tools:
  - Read
  - Bash(yunpat patent status:*)
model: claude-sonnet-4-6
temperature: 0.3

# 条件激活：操作 PDF 文件时自动激活
paths:
  - "**/*.pdf"
  - "**/*.patent"

# 知识库增强
knowledge:
  concepts:
    - 三步法
    - 创造性
    - 权利要求解释
  wiki_pages:
    - "专利实务/创造性/创造性-概述与三步法框架.md"
  max_items: 3
---

## 角色定义

你是一位资深的专利代理人，具有以下专长：

### 领域知识

{{#knowledge.concepts}}
**{{name}}**：
{{description}}
{{/knowledge.concepts}}

### 分析方法

1. **三步法框架**
   - 确定最接近的现有技术
   - 确定区别特征
   - 判断是否显而易见

2. **创造性判断**
   - 技术问题：要解决的具体问题
   - 技术特征：核心创新点
   - 技术效果：与现有技术的对比

---

## 分析任务

请分析以下专利文件：

### 文件信息

- **文件路径**：{{file_path}}
- **文件类型**：{{file_type}}

### 文件内容

!`cat {{file_path}}`

---

## 输出要求

请按以下格式输出分析结果：

### 1. 基本信息

- **发明名称**：
- **申请号**：
- **申请人**：
- **发明人**：

### 2. 技术方案

- **技术领域**：
- **技术问题**：
- **技术方案**：
- **技术效果**：

### 3. 三步法分析

#### 最接近的现有技术
- 现有技术1：
- 现有技术2：

#### 区别特征
- 特征1：
- 特征2：

#### 技术启示
- 是否显而易见：
- 理由：

### 4. 参考案例

{{#knowledge.wiki_pages}}
参见：{{title}}
{{/knowledge.wiki_pages}}
EOF
```

#### Step 3: 测试 Skill

```typescript
// 在测试文件中
const analyzer = new PatentAnalyzerAgent({
  name: 'test-analyzer',
  llm: yourLLM,
  // ... 其他配置
})

const result = await analyzer.callSkill('patent-analyzer', {
  file_path: '/path/to/patent.pdf',
  file_type: 'pdf',
})

console.log(result.data)
```

---

## 30 分钟：进阶功能

### 1. 知识库增强

#### 添加概念引用

```yaml
---
knowledge:
  concepts:
    - 三步法
    - 创造性
    - 权利要求解释
---
```

在提示词中使用：

```markdown
{{#knowledge.concepts}}

### {{name}}

{{description}}

**相关页面**：
{{#related_pages}}

- [[{{page_name}}]]
  {{/related_pages}}
  {{/knowledge.concepts}}
```

#### 添加 Wiki 页面引用

```yaml
---
knowledge:
  wiki_pages:
    - '专利实务/创造性/创造性-概述与三步法框架.md'
    - '专利实务/权利要求/权利要求-保护范围的确定.md'
---
```

在提示词中使用：

```markdown
{{#knowledge.wiki_pages}}

## {{title}}

{{content}}

---

{{/knowledge.wiki_pages}}
```

#### 添加知识卡片引用

```yaml
---
knowledge:
  cards:
    - '20260429-三步法-*.md'
    - '20260429-创造性-*.md'
  max_items: 5
---
```

在提示词中使用：

```markdown
{{#knowledge.cards}}

### {{title}}

**争议焦点**：{{focus}}
**决定要点**：{{decision}}

---

{{/knowledge.cards}}
```

### 2. 条件激活

#### 配置路径模式

```yaml
---
paths:
  - '**/*.pdf' # 所有 PDF 文件
  - '**/*.patent' # 所有 .patent 文件
  - '**/交底书.md' # 所有名为"交底书.md"的文件
---
```

#### 配置文件类型

```yaml
---
file-types:
  - pdf
  - patent
  - markdown
---
```

**效果**：当用户操作匹配的文件时，Skill 自动激活

### 3. Shell 命令注入

#### 基础用法

```markdown
## 当前 Git 状态

!`git status --short`
```

#### 管道命令

```markdown
## 文件预览

!`cat {{file_path}} | head -50`
```

#### 变量嵌套

```markdown
## 专利信息

!`yunpat patent info --file {{patent_file}} | jq '.title'`
```

#### 错误处理

```markdown
{{#capture shell_result}}
!`git status`
{{/capture}}

{{#if shell_result.error}}
**错误**：{{shell_result.error}}
{{else}}
{{shell_result.stdout}}
{{/if}}
```

**注意**：默认只允许安全命令，需在 frontmatter 中配置白名单：

```yaml
---
allowed-commands:
  - git status
  - git diff
  - yunpat patent info
  - cat
  - head
---
```

### 4. Hooks（生命周期钩子）

#### 执行前钩子

```yaml
---
hooks:
  before:
    - type: log
      level: info
      message: '开始分析专利文件...'

    - type: command
      command: 'git status'
      save_as: 'git_status_before'

    - type: validate
      check: 'file_exists'
      param: '{{file_path}}'
---
```

#### 执行后钩子

```yaml
---
hooks:
  after:
    - type: log
      level: info
      message: '分析完成'

    - type: save
      dir: 'analysis-results'
      format: 'json'

    - type: notify
      message: '专利分析已完成'
---
```

---

## 常见问题

### Q1: 如何调试 Skill？

**A**: 添加日志和测试模式

```yaml
---
debug: true
log-level: verbose
---
```

在提示词中：

```markdown
{{#if debug}}
**调试信息**：

- 文件路径：{{file_path}}
- 文件类型：{{file_type}}
- 知识库查询：{{knowledge.concepts.length}} 个概念
  {{/if}}
```

### Q2: 如何处理变量缺失？

**A**: 使用条件标签

```markdown
{{#if file_path}}
**文件**：{{file_path}}
{{else}}
请提供文件路径
{{/if}}
```

### Q3: 如何复用现有 Skill？

**A**: 使用 `extends` 字段

```yaml
---
extends: patent-analyzer
name: my-patent-analyzer
description: 我的定制分析器

# 覆盖配置
temperature: 0.5
knowledge:
  concepts:
    - 三步法
    - 创造性
    - 等同侵权 # 新增概念
---
```

### Q4: 如何限制工具使用？

**A**: 使用 `allowed-tools` 字段

```yaml
---
allowed-tools:
  - Read
  - Bash(git status:*)
  - Bash(git diff:*)
  - Bash(yunpat patent info:*)
---
```

只允许指定的工具，其他工具将被拒绝。

### Q5: 如何提高知识库查询速度？

**A**: 使用缓存和限制数量

```yaml
---
knowledge:
  max_items: 3 # 限制返回数量
  cache_ttl: 3600 # 缓存时间（秒）
  preload: true # 预加载
---
```

---

## 最佳实践

### 1. 命名规范

- **Skill 名称**：小写，连字符分隔（`patent-analyzer`）
- **目录名称**：与 Skill 名称一致
- **文件名称**：固定为 `SKILL.md`

### 2. 描述规范

```yaml
---
description: |
  深度分析专利文件，提取技术要点。

  支持的文件格式：
  - PDF 专利文件
  - Markdown 技术交底书
  - JSON 专利数据

  输出内容：
  - 基本信息
  - 技术方案
  - 三步法分析
---
```

### 3. 知识库引用

- **优先使用概念**：`concepts` 最快
- **按需使用页面**：`wiki_pages` 次之
- **谨慎使用卡片**：`cards` 最慢，需通配符

### 4. 条件激活

- **路径模式精确**：避免 `**` 过于宽泛
- **多模式组合**：`paths` 和 `file-types` 配合使用
- **测试激活**：确认不会误触发

### 5. 安全第一

- **Shell 白名单**：只允许必要的命令
- **沙箱执行**：限制文件系统访问
- **超时控制**：避免长时间运行

---

## 下一步

### 学习资源

- [完整优化计划](./prompt-system-optimization-plan.md) - 详细的实施计划
- [提示词系统对比分析](../analysis/prompt-system-key-insights.md) - 核心差异分析
- [Skills API 文档](../guides/skills-api.md) - API 参考（待创建）

### 实践项目

1. **基础**：创建 `hello-world` Skill ✅
2. **进阶**：创建 `patent-analyzer` Skill
3. **高级**：创建带知识库增强的 `invention-understanding` Skill
4. **专家**：创建带条件激活的 `patent-reviewer` Skill

### 获取帮助

- GitHub Issues：[xujian519/yunpat](https://github.com/xujian519/yunpat/issues)
- 文档：[docs/](../README.md)
- 示例：[examples/skills/](../../examples/skills/)

---

**祝你使用愉快！** 🚀

_快速开始指南结束_
