# 提示词系统架构对比图

## YunPat 当前架构 vs claude-code Skills 架构

```
╔════════════════════════════════════════════════════════════════════════════╗
║                        YunPat 当前架构（硬编码模式）                       ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────┐
│                         PatentWriterAgent                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    PromptBuilder (类内硬编码)                    │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │  buildSystemPrompt():                                     │  │    │
│  │  │    return `## 角色定义                                     │  │    │
│  │  │             你是一位专利代理人...`                          │  │    │
│  │  │                                                           │  │    │
│  │  │  buildUserPrompt(input):                                  │  │    │
│  │  │    return `## 发明信息                                     │  │    │
│  │  │             ${input.title}...`                             │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                 PromptTemplateManager                           │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │  loadTemplate(name)                                       │  │    │
│  │  │    → readFileSync(`${name}.md`)                           │  │    │
│  │  │                                                           │  │    │
│  │  │  render(name, vars)                                       │  │    │
│  │  │    → replace(/\{\{(\w+)\}\}/g, vars)                      │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 加载
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│              ./prompts/patent-drafting/*.md (静态模板)                   │
│  ├── 01-claims-generation.md                                            │
│  ├── 02-specification-drafting.md                                       │
│  └── 03-creativity-analysis.md                                          │
└─────────────────────────────────────────────────────────────────────────┘

特点：
✓ 支持外部模板文件
✓ 懒加载机制
✗ Agent 与提示词紧耦合
✗ 无元数据系统
✗ 无动态发现
✗ 无条件激活
```

```
╔════════════════════════════════════════════════════════════════════════════╗
║                    claude-code Skills 架构（模块化）                      ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────┐
│                           Skills System                                  │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   managed   │  │    user     │  │   project   │  │   bundled   │    │
│  │  skills/    │  │ ~/.claude/  │  │  .claude/   │  │  built-in   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│         ↓                ↓                ↓                ↓             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    loadSkillsDir.ts                              │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │  1. parseFrontmatter()                                     │  │   │
│  │  │     → 提取 name, description, when_to_use, paths, etc      │  │   │
│  │  │                                                           │  │   │
│  │  │  2. createSkillCommand()                                  │  │   │
│  │  │     → 创建 Command 对象（含 getPromptForCommand）         │  │   │
│  │  │                                                           │  │   │
│  │  │  3. deduplicateByPath()                                   │  │   │
│  │  │     → 通过 realpath 去重（避免符号链接重复）              │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│         ↓                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Conditional Skills (条件激活)                       │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │  paths: ["src/**/*.ts", "packages/**/*.ts"]               │  │   │
│  │  │                                                           │  │   │
│  │  │  activateConditionalSkillsForPaths(filePaths)             │  │   │
│  │  │    → 匹配文件路径，激活对应技能                           │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│         ↓                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                Dynamic Skills (动态发现)                         │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │  discoverSkillDirsForPaths(filePaths)                     │  │   │
│  │  │    → 从文件路径向上遍历，查找 .claude/skills 目录          │  │   │
│  │  │                                                           │  │   │
│  │  │  addSkillDirectories(dirs)                                │  │   │
│  │  │    → 动态加载新发现的技能                                   │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 调用 /skill-name
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                  getPromptForCommand(args, context)                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  处理流程：                                                       │  │
│  │                                                                   │  │
│  │  1. 替换变量 {{args}}                                            │  │
│  │     → {{technical_disclosure_path}} → 实际路径                   │  │
│  │                                                                   │  │
│  │  2. Shell 注入 !`command``                                       │  │
│  │     → !`git status` → 实际执行结果                                │  │
│  │     → !`cat file.md | head -20` → 文件内容                      │  │
│  │                                                                   │  │
│  │  3. 替换环境变量                                                  │  │
│  │     → ${CLAUDE_SKILL_DIR} → 技能目录路径                         │  │
│  │     → ${CLAUDE_SESSION_ID} → 会话 ID                             │  │
│  │                                                                   │  │
│  │  4. 返回最终提示词                                                │  │
│  │     → [{ type: 'text', text: finalContent }]                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

特点：
✓ 完全解耦：Skills 独立于 Agent
✓ 丰富的元数据：frontmatter 支持 10+ 字段
✓ 条件激活：基于文件路径自动激活
✓ 动态发现：运行时自动发现新技能
✓ Shell 注入：!command`` 语法支持动态命令
✓ 去重机制：避免重复加载
✓ 多源加载：5 个来源（managed/user/project/bundled/MCP）
```

---

## 关键流程对比

### 提示词加载流程

```
YunPat 流程：
┌──────────────┐
│ Agent 启动   │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ 静态导入     │ → PromptBuilder.buildSystemPrompt()
│ PromptBuilder│ → PromptTemplateManager.loadTemplate()
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ 硬编码提示词 │
│ 或模板文件   │
└──────────────┘

claude-code 流程：
┌──────────────┐
│ 系统启动     │
└──────┬───────┘
       │
       ↓
┌──────────────────────────────────────┐
│ 并行加载 5 个源                      │
│ ├─ managed skills/                   │
│ ├─ user ~/.claude/skills/            │
│ ├─ project .claude/skills/           │
│ ├─ additional dirs (--add-dir)       │
│ └─ legacy commands/                  │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ 解析 Frontmatter                     │
│ ├─ name, description                 │
│ ├─ when_to_use, allowed_tools        │
│ ├─ paths (条件激活)                  │
│ └─ model, effort, hooks              │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ 去重（realpath 解析符号链接）        │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ 分离条件技能                         │
│ ├─ 无 paths → 立即激活              │
│ └─ 有 paths → 等待文件操作时激活    │
└──────────────────────────────────────┘
```

### Shell 注入执行流程

```
YunPat（不支持）：
┌──────────────┐
│ Agent 需要动态内容│
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ 在 Agent 代码中│ → await this.callTool('bash', { command: 'git status' })
│ 调用 Bash 工具│
└──────────────┘

claude-code（!command`` 语法）：
┌──────────────────────────────────────┐
│ 提示词包含 !`command``               │
│ "当前状态：!`git status`"            │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ executeShellCommandsInPrompt()      │
│ 1. 正则匹配 !`([^`]+)`               │
│ 2. 提取命令：git status              │
│ 3. 调用 Bash 工具执行                │
│ 4. 替换为输出结果                    │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ 最终提示词：                         │
│ "当前状态：                           │
│ On branch main                        │
│ Your branch is up to date..."        │
└──────────────────────────────────────┘
```

---

## 文件结构对比

```
YunPat 当前结构：
packages/
├── agents/
│   ├── invention/
│   │   ├── src/
│   │   │   ├── PromptBuilder.ts        ← 硬编码提示词
│   │   │   └── InventionUnderstandingAgent.ts
│   │   └── package.json
│   └── patent-writer/
│       ├── src/
│       │   └── PatentWriterAgent.ts    ← 内嵌提示词
│       └── package.json
└── patent-prompts/                     ← 简单模板管理
    ├── src/
    │   └── PromptTemplateManager.ts
    └── prompts/
        └── patent-drafting/
            ├── 01-claims-generation.md
            ├── 02-specification-drafting.md
            └── 03-creativity-analysis.md

claude-code 结构：
src/
├── skills/
│   ├── loadSkillsDir.ts               ← 核心：技能加载器
│   ├── bundledSkills.ts               ← 内置技能注册
│   └── mcpSkillBuilders.ts            ← MCP 技能构建
├── commands/
│   ├── commit.ts                      ← 内置命令（也是技能）
│   ├── review.ts
│   └── ...
└── constants/
    └── prompts.ts                     ← 系统提示词

.claude/
└── skills/                            ← 项目级技能（动态发现）
    ├── my-skill/
    │   └── SKILL.md
    └── another-skill/
        └── SKILL.md

~/.claude/
└── skills/                            ← 用户级技能
    └── user-skill/
        └── SKILL.md
```

---

## 元数据示例对比

### YunPat（无元数据）

```typescript
// PatentWriterAgent.ts
class PatentWriterAgent {
  name = 'patent-writer'
  description = '专利撰写智能体'
  // 无其他元数据
}
```

### claude-code（丰富元数据）

```yaml
---
# 基本信息元数据
name: commit
description: Create a git commit
version: 1.0.0

# 可见性控制
user-invocable: true # 用户可调用

# 使用指导
when_to_use: After making code changes you want to commit

# 工具限制
allowed-tools:
  - Bash(git add:*)
  - Bash(git status:*)
  - Bash(git commit:*)

# 模型配置
model: claude-sonnet-4-6

# 执行模式
context: inline # 或 fork（后台执行）

# 条件激活
paths:
  - packages/**/*.ts
  - src/**/*.ts

# Agent 指定
agent: git-expert

# 努力程度
effort: low

# 参数定义
arguments: [message]
argument-hint: '(optional) commit message'

# Hooks（生命周期钩子）
hooks:
  before:
    - run: git status
  after:
    - run: git log -1

# Shell 执行器
shell: bash
---
## Context
...
```

---

_架构对比结束_
