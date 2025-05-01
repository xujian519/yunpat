# YunPat 提示词系统优化实施计划

**版本**: v1.0
**制定日期**: 2026-05-05
**计划周期**: 6-8周
**负责人**: 开发团队

---

## 一、执行摘要

### 背景

基于对 YunPat 与 claude-code 提示词系统的深度对比分析，发现当前系统存在以下核心问题：

1. **硬编码问题**：提示词分散在 Agent 类中，修改需要重编译
2. **缺乏元数据**：无使用时机、工具限制、条件激活等
3. **知识库脱节**：丰富的 Obsidian 知识库与提示词系统未深度集成
4. **无动态能力**：无法运行时发现、加载、激活提示词

### 目标

实施 **Skills 系统**，实现：

- ✅ 提示词与 Agent 代码完全解耦
- ✅ 丰富的元数据支持（frontmatter）
- ✅ 基于知识库的动态提示词增强
- ✅ 条件激活机制
- ✅ Shell 命令注入（可选）

### 预期收益

| 指标         | 当前          | 目标     | 提升  |
| ------------ | ------------- | -------- | ----- |
| 开发效率     | 10分钟/次     | 1分钟/次 | +900% |
| 可维护性     | 分散在20+文件 | 集中管理 | +70%  |
| 知识库利用率 | ~30%          | ~80%     | +167% |
| 用户体验     | 手动选择      | 自动激活 | +40%  |
| API成本      | 基准          | 分层缓存 | -30%  |

---

## 二、现状分析

### 2.1 当前提示词系统架构

```
┌─────────────────────────────────────┐
│  PatentWriterAgent                   │
│  ┌───────────────────────────────┐  │
│  │ PromptBuilder (硬编码)        │  │
│  │ - buildSystemPrompt()         │  │
│  │ - buildUserPrompt()           │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ PromptTemplateManager         │  │
│  │ - loadTemplate(name)          │  │
│  │ - render(name, vars)          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**问题点**：

- ❌ `PromptBuilder` 硬编码在 Agent 类中
- ❌ 提示词修改需要重新编译
- ❌ 无元数据系统（无 `when_to_use`、`allowed_tools` 等）
- ❌ 无法条件激活
- ❌ 知识库集成浅层（仅简单的文本插入）

### 2.2 知识库资源盘点

#### 2.2.1 知识库结构

```
knowledge-base/
├── cards/                          # 134+ 知识卡片
│   ├── 20260429-三步法-*.md
│   ├── 20260429-创造性-*.md
│   └── ...
├── 专利实务/                       # 31个子目录
│   ├── 创造性/                    # 30个页面
│   ├── 说明书/                    # 24个页面
│   ├── 权利要求/                  # 14个页面
│   ├── 侵权/                      # 46个页面
│   └── CLAUDE.md                  # 知识库编译规则
├── Concept-Index.md               # 100个核心概念索引
└── 法律法规/                      # 法规库
```

#### 2.2.2 知识库内容统计

| 类别         | 数量 | 说明                      |
| ------------ | ---- | ------------------------- |
| 知识卡片     | 134+ | 基于 LLM 生成的结构化知识 |
| 专利实务页面 | 500+ | 按主题组织的 wiki 页面    |
| 核心概念     | 100  | 带反向索引的概念库        |
| 法规文件     | 20+  | 专利法、审查指南等        |

**当前利用率**：~30%（仅用于简单文本插入）

**潜力**：可作为提示词动态增强的核心数据源

### 2.3 现有 Agent 包分析

| 包名               | 状态 | 提示词方式           | 优先级 |
| ------------------ | ---- | -------------------- | ------ |
| `patent-writer`    | 成熟 | PromptBuilder 硬编码 | 🔴 高  |
| `patent-analyzer`  | 成熟 | PromptBuilder 硬编码 | 🔴 高  |
| `patent-responder` | 成熟 | PromptBuilder 硬编码 | 🔴 高  |
| `invention`        | 中等 | PromptBuilder 硬编码 | 🟡 中  |
| `quality`          | 中等 | PromptBuilder 硬编码 | 🟡 中  |
| 其余 20+           | 早期 | 无提示词系统         | 🟢 低  |

---

## 三、优化方案设计

### 3.1 Skills 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     YunPat Skills System                    │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   system   │  │    user    │  │   project  │           │
│  │  skills/   │  │ ~/.yunpat/ │  │ .yunpat/   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│         ↓                ↓                ↓                 │
│  ┌───────────────────────────────────────────────────┐     │
│  │         SkillLoader (加载器)                      │     │
│  │  - parseFrontmatter()                            │     │
│  │  - createSkillCommand()                          │     │
│  │  - deduplicateByPath()                           │     │
│  └───────────────────────────────────────────────────┘     │
│         ↓                                                  │
│  ┌───────────────────────────────────────────────────┐     │
│  │      KnowledgeBridge (知识库桥接)                 │     │
│  │  - queryByConcept(概念)                          │     │
│  │  - readWikiPage(页面)                            │     │
│  │  - getRelatedCards(卡片)                         │     │
│  └───────────────────────────────────────────────────┘     │
│         ↓                                                  │
│  ┌───────────────────────────────────────────────────┐     │
│  │    ConditionalActivator (条件激活)                │     │
│  │  - paths: ["**/*.pdf"]                           │     │
│  │  - activateForPaths(filePaths)                   │     │
│  └───────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Skill Frontmatter 规范

```yaml
---
# 基本信息
name: patent-analyzer
description: 深度分析专利文件，提取技术要点
version: 1.0.0

# 可见性控制
user-invocable: true # 用户可直接调用

# 使用时机
when_to_use: |
  - 分析专利申请文件时
  - 评估专利技术方案时
  - 对比多个专利时

# 工具限制
allowed-tools:
  - Read
  - Bash(yunpat patent status:*)
  - Bash(yunpat search:*)

# 模型配置
model: claude-sonnet-4-6
temperature: 0.3

# 条件激活
paths:
  - '**/*.pdf'
  - '**/*.patent'
  - '**/technical-disclosure.md'

# 知识库增强
knowledge:
  concepts:
    - 三步法
    - 创造性
    - 权利要求解释
  wiki_pages:
    - '专利实务/创造性/创造性-概述与三步法框架.md'
    - '专利实务/权利要求/权利要求-保护范围的确定.md'
  cards:
    - '20260429-三步法-专利创造性判断的三步法框架*.md'

# 参数定义
arguments: [file_path, analysis_depth]
argument-hint: '(可选) 文件路径和分析深度'

# Hooks（生命周期钩子）
hooks:
  before:
    - type: log
      message: '开始分析专利文件...'
  after:
    - type: save_to_knowledge
      dir: 'analysis-results'
---
```

### 3.3 知识库动态增强

```markdown
## 角色定义

你是一位资深的专利代理人，具有以下专长：

### 领域知识（来自知识库）

{{#knowledge.concepts}}
**三步法**：

- 确定区别特征
- 认定技术问题
- 判断技术启示

{{/knowledge.concepts}}

### 相关案例（来自知识库）

{{#knowledge.cards}}

- 案例：20260429-三步法-专利创造性判断的三步法框架
  - 争议焦点：如何确定"最接近的现有技术"
  - 决定要点：应从技术领域、技术问题、技术效果三方面综合判断
    {{/knowledge.cards}}

---

## 当前任务

分析以下专利文件：
!`cat {{file_path}}`

### 参考标准（来自知识库）

{{#knowledge.wiki_pages}}
参见：专利实务/创造性/创造性-概述与三步法框架.md
{{/knowledge.wiki_pages}}
```

---

## 四、实施计划

### 阶段一：基础 Skills 系统（Week 1-2）🔴 高优先级

#### 目标

实现基本的模块化提示词系统，支持 Markdown + Frontmatter 格式

#### 任务清单

##### Week 1: 核心框架

**Day 1-2: Skills 目录结构**

- [ ] 创建 `.yunpat/skills/` 目录规范
- [ ] 设计 SKILL.md 模板（包含 frontmatter 示例）
- [ ] 编写 Skills 开发指南（docs/guides/skills-development.md）

**Day 3-4: SkillLoader 实现**

- [ ] 实现 `packages/skills/src/SkillLoader.ts`
  - [ ] `loadSkillsFromDir(dir: string): Promise<Skill[]>`
  - [ ] `parseFrontmatter(content: string): Frontmatter`
  - [ ] `createSkillCommand(frontmatter, content): Skill`
- [ ] 编写单元测试（`packages/skills/test/SkillLoader.test.ts`）

**Day 5: Skill 渲染器**

- [ ] 实现 `getPromptForCommand(args, context): Promise<Prompt>`
- [ ] 支持变量替换（`{{variable}}`）
- [ ] 支持嵌套变量（`{{user.name}}`）
- [ ] 编写渲染器测试

##### Week 2: Agent 集成

**Day 1-3: ProfessionalAgent 增强**

- [ ] 扩展 `ProfessionalAgent` 基类
  - [ ] 添加 `callSkill(skillName, args): Promise<Result>`
  - [ ] 添加 `loadSkills(skillsDir): Promise<void>`
  - [ ] 添加 `getSkill(name): Skill | undefined`
- [ ] 更新 `PatentWriterAgent` 使用 Skills
- [ ] 更新 `PatentAnalyzerAgent` 使用 Skills

**Day 4-5: 示例 Skills**

创建第一批示例 Skills：

- [ ] `.yunpat/skills/invention-understanding/SKILL.md`
- [ ] `.yunpat/skills/claims-drafting/SKILL.md`
- [ ] `.yunpat/skills/specification-drafting/SKILL.md`
- [ ] `.yunpat/skills/patent-analysis/SKILL.md`

**验收标准**：

- ✅ 可从 `.yunpat/skills/` 加载技能
- ✅ 支持 Markdown + Frontmatter 格式
- ✅ 可在 Agent 中调用技能
- ✅ 变量替换正确工作
- ✅ 单元测试覆盖率 > 80%

---

### 阶段二：知识库深度集成（Week 3-4）🔴 高优先级

#### 目标

将 Obsidian 知识库与 Skills 系统深度集成，实现动态提示词增强

#### 任务清单

##### Week 3: KnowledgeBridge

**Day 1-2: Obsidian 知识库适配器**

- [ ] 实现 `packages/patent-knowledge/src/ObsidianKnowledgeBridge.ts`
  - [ ] `queryByConcept(concept: string): Promise<WikiPage[]>`
  - [ ] `readWikiPage(pageName: string): Promise<string>`
  - [ ] `getRelatedCards(concept: string): Promise<KnowledgeCard[]>`
  - [ ] `searchCards(query: string): Promise<KnowledgeCard[]>`

**Day 3-4: 知识库标签语法**

- [ ] 设计知识库标签语法（类似 Handlebars）
  - [ ] `{{#knowledge.concepts}}...{{/knowledge.concepts}}`
  - [ ] `{{#knowledge.wiki_pages}}...{{/knowledge.wiki_pages}}`
  - [ ] `{{#knowledge.cards}}...{{/knowledge.cards}}`
- [ ] 实现标签解析器
- [ ] 实现标签渲染器

**Day 5: 知识库索引优化**

- [ ] 实现 `ConceptIndex` 加载器
- [ ] 实现反向索引查询
- [ ] 添加缓存机制（LRU Cache）

##### Week 4: Skill 知识库增强

**Day 1-3: 增强 Skill 渲染器**

- [ ] 扩展 `getPromptForCommand()` 支持知识库标签
- [ ] 实现知识库数据注入
- [ ] 添加知识库查询日志

**Day 4-5: 知识库增强示例**

更新现有 Skills，集成知识库：

- [ ] 更新 `invention-understanding/SKILL.md`
  - [ ] 添加 `knowledge.concepts: [三步法, 创造性]`
  - [ ] 添加知识库标签
- [ ] 更新 `patent-analysis/SKILL.md`
  - [ ] 添加 `knowledge.wiki_pages` 引用
  - [ ] 添加案例卡片引用

**验收标准**：

- ✅ 可从 Skill 中查询知识库
- ✅ 知识库标签正确渲染
- ✅ 知识库查询有缓存
- ✅ 至少 2 个 Skill 使用知识库增强

---

### 阶段三：条件激活机制（Week 5）🔴 高优先级

#### 目标

实现基于文件路径的条件激活机制

#### 任务清单

**Day 1-2: 路径匹配引擎**

- [ ] 实现 `packages/skills/src/PathMatcher.ts`
  - [ ] 使用 `ignore` 库实现 gitignore 风格匹配
  - [ ] 支持通配符（`**/*.pdf`）
  - [ ] 支持多模式匹配

**Day 3-4: 条件激活器**

- [ ] 实现 `ConditionalActivator` 类
  - [ ] `activateForPaths(filePaths: string[]): string[]`
  - [ ] `deactivate(skillName: string): void`
  - [ ] `getActiveSkills(): Skill[]`
- [ ] 集成到文件操作工具（Read/Write/Edit）

**Day 5: Agent 自动激活**

- [ ] 扩展 `ProfessionalAgent`
  - [ ] 添加 `onFileOperation(filePath: string)` 钩子
  - [ ] 自动激活匹配的 Skills
  - [ ] 自动停用不匹配的 Skills

**验收标准**：

- ✅ 操作 PDF 文件时自动激活 `patent-analyzer`
- ✅ 操作交底书时自动激活 `invention-understanding`
- ✅ 支持多模式匹配
- ✅ 激活状态正确切换

---

### 阶段四：Shell 命令注入（Week 6）⚠️ 中优先级

#### 目标

支持 `!command`` 语法，实现动态命令执行

#### 任务清单

**Day 1-2: 命令注入解析器**

- [ ] 实现 `packages/skills/src/ShellInjector.ts`
  - [ ] 正则匹配 `!command`` 语法
  - [ ] 提取命令和参数
  - [ ] 支持嵌套命令

**Day 3-4: 安全执行器**

- [ ] 实现命令白名单机制
  - [ ] 默认白名单：`git status`, `yunpat *`, `cat`, `head`, `ls`
  - [ ] 支持自定义白名单（frontmatter 中配置）
- [ ] 实现沙箱执行
  - [ ] 限制文件系统访问
  - [ ] 超时控制（5 秒）
- [ ] 实现错误处理
  - [ ] 命令失败时返回错误信息
  - [ ] 超时时返回超时提示

**Day 5: 示例更新**

更新 Skills，使用 Shell 注入：

- [ ] 更新 `patent-analysis/SKILL.md`
  - [ ] 添加 `!`yunpat patent status --format table``
- [ ] 更新 `invention-understanding/SKILL.md`
  - [ ] 添加 `!`cat {{technical_disclosure_path}} | head -50``

**验收标准**：

- ✅ 可在提示词中使用 `!command`` 语法
- ✅ 命令输出正确插入提示词
- ✅ 命令白名单正确工作
- ✅ 错误被优雅处理
- ✅ 超时机制正确工作

---

### 阶段五：分层缓存优化（Week 7）⚠️ 中优先级

#### 目标

实现提示词分层缓存，降低 API 成本

#### 任务清单

**Day 1-2: 边界标记机制**

- [ ] 设计 `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 标记
- [ ] 识别静态内容（角色定义、核心原则）
- [ ] 识别动态内容（环境信息、用户输入）

**Day 3-4: 缓存实现**

- [ ] 实现 `packages/skills/src/PromptCache.ts`
  - [ ] `getStaticPrefix(skill: Skill): string`
  - [ ] `getDynamicSuffix(skill: Skill, context): string`
  - [ ] `getCachedPrompt(skill: Skill, context): Prompt`
- [ ] 实现缓存失效策略
  - [ ] Skill 文件修改时失效
  - [ ] 知识库更新时失效
  - [ ] 会话开始时失效

**Day 5: 监控与优化**

- [ ] 添加缓存命中率监控
- [ ] 添加提示词 Token 统计
- [ ] 优化缓存键生成
- [ ] 编写缓存测试

**验收标准**：

- ✅ 静态内容使用全局缓存
- ✅ 动态内容每会话重新计算
- ✅ 缓存命中率 > 80%
- ✅ Token 数减少 20-30%

---

### 阶段六：迁移与文档（Week 8）⚠️ 中优先级

#### 目标

迁移现有 Agent 到 Skills 系统，完善文档

#### 任务清单

**Day 1-3: Agent 迁移**

- [ ] 迁移 `PatentWriterAgent` → Skills
  - [ ] 创建 `patent-drafting/SKILL.md`
  - [ ] 创建 `claims-generation/SKILL.md`
  - [ ] 创建 `specification-drafting/SKILL.md`
- [ ] 迁移 `PatentAnalyzerAgent` → Skills
  - [ ] 创建 `patent-analysis/SKILL.md`
  - [ ] 创建 `novelty-assessment/SKILL.md`
  - [ ] 创建 `inventive-step-assessment/SKILL.md`
- [ ] 迁移 `PatentResponderAgent` → Skills
  - [ ] 创建 `oa-response/SKILL.md`
  - [ ] 创建 `argument-drafting/SKILL.md`

**Day 4-5: 文档完善**

- [ ] 编写 Skills 用户指南
  - [ ] 如何创建 Skill
  - [ ] Frontmatter 字段说明
  - [ ] 知识库集成指南
  - [ ] 条件激活配置
- [ ] 编写 Skills API 文档
  - [ ] `callSkill()` API
  - [ ] 知识库标签语法
  - [ ] Shell 注入语法
- [ ] 编写迁移指南
  - [ ] 从 PromptBuilder 迁移到 Skills
  - [ ] 最佳实践
  - [ ] 常见问题

**验收标准**：

- ✅ 至少 3 个核心 Agent 迁移完成
- ✅ 所有文档齐全
- ✅ 迁移指南清晰
- ✅ 示例完整

---

## 五、风险管理

### 5.1 技术风险

| 风险               | 影响 | 概率 | 缓解措施                         |
| ------------------ | ---- | ---- | -------------------------------- |
| Shell 注入安全漏洞 | 高   | 中   | 严格的白名单；沙箱执行；代码审查 |
| 知识库性能问题     | 中   | 中   | LRU 缓存；索引优化；异步加载     |
| 向后兼容性         | 高   | 低   | 保留旧 API；渐进式迁移；并行运行 |
| 条件激活误判       | 中   | 低   | 测试覆盖；日志记录；手动覆盖     |

### 5.2 项目风险

| 风险           | 影响 | 概率 | 缓解措施                             |
| -------------- | ---- | ---- | ------------------------------------ |
| 进度延期       | 中   | 中   | 分阶段交付；关键路径管理；预留缓冲   |
| 资源不足       | 高   | 低   | 优先级排序；外部支持；降低非关键需求 |
| 知识库数据质量 | 中   | 中   | 数据清洗；质量检查；人工审核         |

---

## 六、成功指标

### 6.1 开发效率

- **提示词修改时间**：从 10 分钟降至 1 分钟（-90%）
- **新增技能时间**：从 2 小时降至 10 分钟（-92%）
- **编译次数**：减少 80%（提示词修改无需重编译）

### 6.2 可维护性

- **提示词集中度**：从分散在 20+ 文件到集中管理（+100%）
- **版本控制可见性**：提示词变更可在 Git diff 中查看（+100%）
- **代码行数**：Agent 代码减少 30%（提示词移至外部文件）

### 6.3 用户体验

- **自动激活率**：> 80% 的技能操作无需手动选择
- **发现新技能时间**：< 5 秒（条件激活）
- **知识库利用率**：从 30% 提升到 80%（+167%）

### 6.4 API 成本

- **缓存命中率**：> 80%
- **提示词 Token 数**：减少 20-30%
- **API 调用次数**：减少 15%（缓存命中）

---

## 七、资源需求

### 7.1 人力资源

| 角色         | 人数 | 工作量 | 职责                     |
| ------------ | ---- | ------ | ------------------------ |
| 后端开发     | 2    | 8周    | 核心框架开发、Agent 集成 |
| 知识库工程师 | 1    | 4周    | 知识库适配、索引优化     |
| 测试工程师   | 1    | 6周    | 单元测试、集成测试       |
| 技术写作     | 1    | 2周    | 文档编写、示例制作       |

### 7.2 技术资源

| 类别     | 需求                            | 说明         |
| -------- | ------------------------------- | ------------ |
| 开发环境 | Node.js 18+, pnpm 8+            | 现有环境满足 |
| 依赖库   | ignore, gray-matter, handlebars | 需新增       |
| 知识库   | Obsidian 知识库                 | 现有资源     |
| 测试环境 | Vitest, TypeScript              | 现有环境满足 |

### 7.3 时间安排

| 阶段   | 工作量 | 依赖关系  |
| ------ | ------ | --------- |
| 阶段一 | 2周    | 无        |
| 阶段二 | 2周    | 阶段一    |
| 阶段三 | 1周    | 阶段一    |
| 阶段四 | 1周    | 阶段一    |
| 阶段五 | 1周    | 阶段一    |
| 阶段六 | 1周    | 阶段一-五 |

**总计**：8周（可并行缩短至 6周）

---

## 八、下一步行动

### 立即行动（本周）

1. ✅ **审批本计划**：获得团队批准和资源承诺
2. ✅ **创建任务看板**：在 GitHub Projects 或 Jira 中创建任务卡片
3. ✅ **搭建开发环境**：安装依赖，配置开发工具
4. ✅ **启动阶段一**：开始 Skills 目录结构设计

### 短期行动（2周内）

1. ✅ 完成 SkillLoader 实现
2. ✅ 创建第一批示例 Skills
3. ✅ 编写 Skills 开发指南
4. ✅ 完成 ProfessionalAgent 集成

### 中期行动（4周内）

1. ✅ 完成知识库深度集成
2. ✅ 实现条件激活机制
3. ✅ 迁移核心 Agent
4. ✅ 编写完整文档

### 长期行动（8周内）

1. ✅ 完成所有 Agent 迁移
2. ✅ 实现分层缓存优化
3. ✅ 完成性能优化
4. ✅ 发布 v1.0

---

## 九、附录

### 附录 A：Skill Frontmatter 完整规范

```yaml
---
# ============ 基本信息 ============
name: skill-name # 技能名称（必填）
description: 技能描述 # 技能描述（必填）
version: 1.0.0 # 版本号（可选）

# ============ 可见性控制 ============
user-invocable: true # 用户是否可直接调用（默认 true）
hidden: false # 是否隐藏（默认 false）

# ============ 使用指导 ============
when_to_use: | # 何时使用此技能（可选）
  - 场景一
  - 场景二

# ============ 工具限制 ============
allowed-tools: # 允许使用的工具列表（可选）
  - Read
  - Bash(git status:*)
  - Bash(yunpat patent:*)

# ============ 模型配置 ============
model: claude-sonnet-4-6 # 指定模型（可选）
temperature: 0.3 # 温度参数（可选）
max-tokens: 4000 # 最大 Token 数（可选）

# ============ 条件激活 ============
paths: # 文件路径模式（可选）
  - '**/*.pdf'
  - '**/*.patent'
  - '**/technical-disclosure.md'

file-types: # 文件类型（可选）
  - pdf
  - patent
  - markdown

# ============ 知识库增强 ============
knowledge: # 知识库配置（可选）
  concepts: # 相关概念
    - 三步法
    - 创造性
  wiki_pages: # Wiki 页面
    - '专利实务/创造性/创造性-概述与三步法框架.md'
  cards: # 知识卡片（支持通配符）
    - '20260429-三步法-*.md'
  max_items: 5 # 最大返回数量（默认 5）

# ============ 参数定义 ============
arguments: [file_path, depth] # 参数名列表（可选）
argument-hint: '(可选) 文件路径和分析深度' # 参数提示（可选）

# ============ 执行上下文 ============
context: inline # 执行模式：inline | fork（默认 inline）
agent: patent-expert # 指定执行的 Agent（可选）

# ============ 努力程度 ============
effort: low # 努力程度：low | medium | high | number（可选）

# ============ Hooks ============
hooks: # 生命周期钩子（可选）
  before: # 执行前钩子
    - type: log
      message: '开始分析...'
    - type: command
      command: 'git status'
  after: # 执行后钩子
    - type: save
      dir: 'results'
    - type: notify
      message: '分析完成'

# ============ Shell 执行 ============
shell: bash # Shell 类型：bash | node（可选）
shell-timeout: 5000 # Shell 超时（毫秒，可选）

# ============ 命令白名单 ============
allowed-commands: # 允许的命令（可选）
  - git status
  - git diff
  - yunpat patent status
  - cat
  - head

# ============ 其他 ============
tags: # 标签（可选）
  - patent
  - analysis
  - v1

deprecated: false # 是否弃用（默认 false）
deprecated-by: new-skill-name # 替代技能（可选）
migration-guide: | # 迁移指南（可选）
  请使用 new-skill-name 替代本技能
---
```

### 附录 B：知识库标签语法

#### 基础标签

```markdown
{{#knowledge.concepts}}

- **三步法**
- **创造性**
  {{/knowledge.concepts}}
```

#### 循环标签

```markdown
{{#knowledge.wiki_pages}}

### {{title}}

{{content}}
{{/knowledge.wiki_pages}}
```

#### 条件标签

```markdown
{{#if knowledge.cards}}
**相关案例**：
{{#knowledge.cards}}

- {{title}}
  {{/knowledge.cards}}
  {{/if}}
```

#### 嵌套标签

```markdown
{{#knowledge.concepts}}

### {{name}}

**相关页面**：
{{#related_pages}}

- [[{{page_name}}]]
  {{/related_pages}}
  {{/knowledge.concepts}}
```

### 附录 C：Shell 注入语法

#### 基础命令

```markdown
## 当前状态

!`git status --short`
```

#### 管道命令

```markdown
## 文件预览

!`cat {{file_path}} | head -50`
```

#### 嵌套变量

```markdown
## 专利信息

!`yunpat patent info --format json --file {{patent_file}} | jq '.title'`
```

#### 错误处理

```markdown
{{#capture shell_result}}
!`git status`
{{/capture}}

{{#if shell_result.error}}
**Git 错误**：{{shell_result.error}}
{{else}}
{{shell_result.stdout}}
{{/if}}
```

---

_优化计划结束_
