# 阶段一：基础 Skills 系统 - 详细实施计划

**周期**: Week 1-2
**目标**: 实现基本的模块化提示词系统
**优先级**: 🔴 高
**负责人**: 开发团队

---

## 一、任务分解

### Week 1: 核心框架开发

#### Day 1-2: 基础设施（并行任务组 A）

**任务组 A1: 目录结构与规范设计**

- [ ] 创建 `.yunpat/skills/` 目录规范文档
- [ ] 设计 SKILL.md 模板（包含 frontmatter 示例）
- [ ] 定义 Skills 命名规范
- [ ] 定义 Skills 文件组织结构

**任务组 A2: 包结构创建**

- [ ] 创建 `packages/skills` 包
- [ ] 创建 `packages/skills/src/` 目录
- [ ] 创建 `packages/skills/test/` 目录
- [ ] 配置 `package.json`
- [ ] 配置 `tsconfig.json`

**任务组 A3: 类型定义**

- [ ] 定义 `Skill` 接口
- [ ] 定义 `SkillFrontmatter` 接口
- [ ] 定义 `SkillLoader` 接口
- [ ] 定义 `SkillRenderer` 接口

#### Day 3-4: 核心实现（并行任务组 B）

**任务组 B1: Frontmatter 解析器**

- [ ] 实现 `parseFrontmatter(content: string): Frontmatter`
- [ ] 支持基础字段（name, description, version）
- [ ] 支持元数据字段（when_to_use, allowed-tools, paths）
- [ ] 支持知识库字段（knowledge）
- [ ] 编写单元测试

**任务组 B2: Skill 加载器**

- [ ] 实现 `loadSkillsFromDir(dir: string): Promise<Skill[]>`
- [ ] 实现递归目录扫描
- [ ] 实现 SKILL.md 文件识别
- [ ] 实现 frontmatter 解析
- [ ] 实现 Skill 对象创建
- [ ] 编写单元测试

**任务组 B3: 去重机制**

- [ ] 实现 `deduplicateByPath(skills: Skill[]): Skill[]`
- [ ] 使用 `realpath` 解析符号链接
- [ ] 处理重复技能（保留优先级高的）
- [ ] 编写单元测试

#### Day 5: 渲染器（并行任务组 C）

**任务组 C1: 变量替换**

- [ ] 实现 `replaceVariables(template: string, vars: Record): string`
- [ ] 支持简单变量：`{{variable}}`
- [ ] 支持嵌套变量：`{{user.name}}`
- [ ] 支持条件变量：`{{#if condition}}`
- [ ] 编写单元测试

**任务组 C2: 提示词渲染**

- [ ] 实现 `getPromptForCommand(args, context): Promise<Prompt>`
- [ ] 实现变量注入
- [ ] 实现环境变量替换
- [ ] 编写单元测试

**任务组 C3: 错误处理**

- [ ] 实现变量缺失错误处理
- [ ] 实现循环引用检测
- [ ] 实现类型错误处理
- [ ] 编写错误处理测试

### Week 2: Agent 集成

#### Day 1-3: ProfessionalAgent 增强（并行任务组 D）

**任务组 D1: 基类扩展**

- [ ] 扩展 `ProfessionalAgent` 基类
- [ ] 添加 `skills: Map<string, Skill>` 字段
- [ ] 添加 `loadSkills(skillsDir): Promise<void>` 方法
- [ ] 添加 `getSkill(name): Skill | undefined` 方法
- [ ] 添加 `callSkill(name, args): Promise<Result>` 方法
- [ ] 编写集成测试

**任务组 D2: SkillLoader 集成**

- [ ] 集成 `SkillLoader` 到 `ProfessionalAgent`
- [ ] 实现自动加载 `.yunpat/skills/`
- [ ] 实现技能热重载（开发模式）
- [ ] 编写集成测试

**任务组 D3: 上下文传递**

- [ ] 实现 `SkillContext` 接口
- [ ] 传递 Agent 上下文到 Skill
- [ ] 传递工具注册表到 Skill
- [ ] 传递知识库到 Skill
- [ ] 编写集成测试

#### Day 4-5: 示例 Skills（并行任务组 E）

**任务组 E1: 基础 Skills**

- [ ] 创建 `invention-understanding/SKILL.md`
  - [ ] 编写 frontmatter
  - [ ] 编写提示词内容
  - [ ] 测试调用
- [ ] 创建 `claims-drafting/SKILL.md`
  - [ ] 编写 frontmatter
  - [ ] 编写提示词内容
  - [ ] 测试调用

**任务组 E2: 高级 Skills**

- [ ] 创建 `specification-drafting/SKILL.md`
  - [ ] 编写 frontmatter
  - [ ] 编写提示词内容
  - [ ] 测试调用
- [ ] 创建 `patent-analysis/SKILL.md`
  - [ ] 编写 frontmatter
  - [ ] 编写提示词内容
  - [ ] 测试调用

**任务组 E3: Agent 迁移**

- [ ] 更新 `PatentWriterAgent` 使用 Skills
  - [ ] 移除硬编码提示词
  - [ ] 集成 Skills 调用
  - [ ] 测试功能
- [ ] 更新 `PatentAnalyzerAgent` 使用 Skills
  - [ ] 移除硬编码提示词
  - [ ] 集成 Skills 调用
  - [ ] 测试功能

---

## 二、详细设计

### 2.1 目录结构

```
packages/skills/
├── src/
│   ├── types/
│   │   ├── Skill.ts              # Skill 接口定义
│   │   ├── SkillFrontmatter.ts   # Frontmatter 接口定义
│   │   ├── SkillContext.ts       # Skill 上下文接口
│   │   └── SkillRenderer.ts      # 渲染器接口
│   ├── loader/
│   │   ├── SkillLoader.ts        # 加载器实现
│   │   ├── FrontmatterParser.ts  # Frontmatter 解析器
│   │   └── SkillDeduplicator.ts  # 去重器
│   ├── renderer/
│   │   ├── VariableReplacer.ts   # 变量替换器
│   │   ├── PromptRenderer.ts     # 提示词渲染器
│   │   └── ErrorHandler.ts       # 错误处理器
│   └── index.ts                  # 包入口
├── test/
│   ├── loader/
│   │   ├── SkillLoader.test.ts
│   │   ├── FrontmatterParser.test.ts
│   │   └── SkillDeduplicator.test.ts
│   ├── renderer/
│   │   ├── VariableReplacer.test.ts
│   │   ├── PromptRenderer.test.ts
│   │   └── ErrorHandler.test.ts
│   └── integration/
│       ├── ProfessionalAgent.test.ts
│       └── SkillsIntegration.test.ts
├── package.json
├── tsconfig.json
└── README.md

.yunpat/skills/
├── invention-understanding/
│   └── SKILL.md
├── claims-drafting/
│   └── SKILL.md
├── specification-drafting/
│   └── SKILL.md
└── patent-analysis/
    └── SKILL.md
```

### 2.2 核心接口设计

#### Skill 接口

```typescript
export interface Skill {
  // 基本信息
  name: string
  description: string
  version?: string

  // 元数据
  frontmatter: SkillFrontmatter

  // 提示词内容
  content: string

  // 渲染方法
  getPromptForCommand(args: Record<string, any>, context: SkillContext): Promise<SkillPrompt>

  // 元数据
  loadedAt: Date
  source: SkillSource
}

export interface SkillPrompt {
  system: string
  user: string
  metadata: {
    tokenCount: number
    hasKnowledge: boolean
    hasVariables: boolean
  }
}

export enum SkillSource {
  SYSTEM = 'system',
  USER = 'user',
  PROJECT = 'project',
}
```

#### SkillFrontmatter 接口

```typescript
export interface SkillFrontmatter {
  // 基本信息
  name?: string
  description?: string
  version?: string

  // 可见性控制
  'user-invocable'?: boolean
  hidden?: boolean

  // 使用指导
  when_to_use?: string | string[]

  // 工具限制
  'allowed-tools'?: string[]

  // 模型配置
  model?: string
  temperature?: number
  'max-tokens'?: number

  // 条件激活
  paths?: string[]
  'file-types'?: string[]

  // 知识库增强
  knowledge?: KnowledgeConfig

  // 参数定义
  arguments?: string[]
  'argument-hint'?: string

  // 执行上下文
  context?: 'inline' | 'fork'
  agent?: string

  // 努力程度
  effort?: 'low' | 'medium' | 'high' | number

  // Hooks
  hooks?: SkillHooks

  // Shell 执行
  shell?: 'bash' | 'node'
  'shell-timeout'?: number
  'allowed-commands'?: string[]

  // 其他
  tags?: string[]
  deprecated?: boolean
  'deprecated-by'?: string
  'migration-guide'?: string

  // 调试
  debug?: boolean
  'log-level'?: 'silent' | 'error' | 'warn' | 'info' | 'debug'
}

export interface KnowledgeConfig {
  concepts?: string[]
  wiki_pages?: string[]
  cards?: string[]
  max_items?: number
  cache_ttl?: number
  preload?: boolean
}

export interface SkillHooks {
  before?: SkillHook[]
  after?: SkillHook[]
}

export interface SkillHook {
  type: 'log' | 'command' | 'validate' | 'save' | 'notify'
  level?: string
  message?: string
  command?: string
  save_as?: string
  check?: string
  param?: string
  dir?: string
  format?: string
}
```

#### SkillContext 接口

```typescript
export interface SkillContext {
  // Agent 上下文
  agentName: string
  agentDescription: string

  // 工具上下文
  tools: Record<string, any>
  'allowed-tools': string[]

  // 知识库上下文
  knowledge?: {
    concepts: ConceptEntry[]
    wiki_pages: WikiPageEntry[]
    cards: CardEntry[]
  }

  // 环境上下文
  env: {
    cwd: string
    home: string
    sessionId: string
  }

  // 用户上下文
  user?: {
    name: string
    email: string
    preferences: Record<string, any>
  }

  // 调用上下文
  call: {
    skillName: string
    args: Record<string, any>
    timestamp: Date
  }
}
```

### 2.3 实现要点

#### Frontmatter 解析

```typescript
import { parse } from 'gray-matter'

export function parseFrontmatter(
  content: string,
  filePath: string
): { frontmatter: SkillFrontmatter; content: string } {
  const { data, content: markdownContent } = parse(content)

  // 验证必填字段
  if (!data.name && !data.description) {
    throw new Error(`Skill must have either 'name' or 'description' in frontmatter: ${filePath}`)
  }

  // 标准化字段
  const frontmatter: SkillFrontmatter = {
    name: data.name,
    description: data.description || data.name || 'Unnamed skill',
    version: data.version,
    'user-invocable': data['user-invocable'] ?? true,
    hidden: data.hidden ?? false,
    when_to_use: data.when_to_use,
    'allowed-tools': data['allowed-tools'],
    model: data.model,
    temperature: data.temperature,
    'max-tokens': data['max-tokens'],
    paths: data.paths,
    'file-types': data['file-types'],
    knowledge: data.knowledge,
    arguments: data.arguments,
    'argument-hint': data['argument-hint'],
    context: data.context,
    agent: data.agent,
    effort: data.effort,
    hooks: data.hooks,
    shell: data.shell,
    'shell-timeout': data['shell-timeout'],
    'allowed-commands': data['allowed-commands'],
    tags: data.tags,
    deprecated: data.deprecated,
    'deprecated-by': data['deprecated-by'],
    'migration-guide': data['migration-guide'],
    debug: data.debug,
    'log-level': data['log-level'],
  }

  return { frontmatter, content: markdownContent }
}
```

#### Skill 加载

```typescript
import { readFile } from 'fs/promises'
import { join } from 'path'
import { readdir } from 'fs/promises'

export async function loadSkillsFromDir(dir: string, source: SkillSource): Promise<Skill[]> {
  const skills: Skill[] = []

  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillDir = join(dir, entry.name)
      const skillFile = join(skillDir, 'SKILL.md')

      try {
        const content = await readFile(skillFile, 'utf-8')
        const { frontmatter, content: markdownContent } = parseFrontmatter(content, skillFile)

        const skill: Skill = {
          name: frontmatter.name || entry.name,
          description: frontmatter.description || entry.name,
          version: frontmatter.version,
          frontmatter,
          content: markdownContent,
          getPromptForCommand: async (args, context) => {
            return renderSkillPrompt(skill, args, context)
          },
          loadedAt: new Date(),
          source,
        }

        skills.push(skill)
      } catch (error) {
        console.warn(`Failed to load skill from ${skillDir}:`, error)
      }
    }
  } catch (error) {
    console.warn(`Failed to read skills directory ${dir}:`, error)
  }

  return skills
}
```

#### 变量替换

```typescript
export function replaceVariables(template: string, vars: Record<string, any>): string {
  let result = template

  // 1. 简单变量 {{variable}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  })

  // 2. 嵌套变量 {{user.name}}
  result = result.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const keys = path.split('.')
    let value: any = vars

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key]
      } else {
        return `{{${path}}}`
      }
    }

    return value !== undefined ? String(value) : `{{${path}}}`
  })

  // 3. 条件变量 {{#if condition}}
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, condition, content) => {
    return vars[condition] ? content : ''
  })

  return result
}
```

---

## 三、并行执行策略

### Week 1 并行任务

```mermaid
graph TD
    A[Day 1-2] --> B[Day 3-4]
    A --> C[Day 5]

    subgraph [Day 1-2 并行组]
        A1[目录结构设计]
        A2[包结构创建]
        A3[类型定义]
    end

    subgraph [Day 3-4 并行组]
        B1[Frontmatter 解析器]
        B2[Skill 加载器]
        B3[去重机制]
    end

    subgraph [Day 5 并行组]
        C1[变量替换]
        C2[提示词渲染]
        C3[错误处理]
    end
```

### Week 2 并行任务

```mermaid
graph TD
    D[Day 1-3] --> E[Day 4-5]

    subgraph [Day 1-3 并行组]
        D1[基类扩展]
        D2[SkillLoader 集成]
        D3[上下文传递]
    end

    subgraph [Day 4-5 并行组]
        E1[基础 Skills]
        E2[高级 Skills]
        E3[Agent 迁移]
    end
```

---

## 四、验收标准

### 功能验收

- [ ] 可从 `.yunpat/skills/` 加载技能
- [ ] 支持 Markdown + Frontmatter 格式
- [ ] 可在 Agent 中调用技能
- [ ] 变量替换正确工作
- [ ] 支持嵌套变量
- [ ] 支持条件变量
- [ ] 错误被正确处理

### 质量验收

- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] 代码审查通过
- [ ] 性能测试通过（加载时间 < 100ms）

### 文档验收

- [ ] Skills 开发指南完整
- [ ] API 文档完整
- [ ] 示例 Skills 完整
- [ ] 迁移指南完整

---

## 五、风险与缓解

### 技术风险

| 风险                 | 影响 | 缓解措施                  |
| -------------------- | ---- | ------------------------- |
| Frontmatter 解析失败 | 高   | 使用成熟的 gray-matter 库 |
| 变量替换性能问题     | 中   | 优化正则表达式，使用缓存  |
| 类型定义不完整       | 中   | 逐步完善，保持向后兼容    |

### 进度风险

| 风险     | 影响 | 缓解措施                   |
| -------- | ---- | -------------------------- |
| 任务延期 | 中   | 并行执行，预留缓冲         |
| 依赖阻塞 | 中   | 明确依赖关系，调整任务顺序 |

---

## 六、下一步

### 立即行动

1. ✅ 创建 GitHub Projects 看板
2. ✅ 创建 `packages/skills` 包
3. ✅ 开始 Day 1-2 并行任务

### 本周完成

1. ✅ 完成基础设施（Day 1-2）
2. ✅ 完成核心实现（Day 3-4）
3. ✅ 完成渲染器（Day 5）

### 下周完成

1. ✅ 完成 Agent 集成
2. ✅ 完成示例 Skills
3. ✅ 通过所有验收标准

---

_阶段一详细计划结束_
