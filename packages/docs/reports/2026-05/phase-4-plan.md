# 阶段四实施计划 - 知识库深度集成

**开始日期**: 2026-05-05
**预计完成**: Week 4
**优先级**: 🔴 高

---

## 🎯 目标

深度集成 Obsidian 知识库，实现智能知识检索和上下文增强。

---

## 📋 核心功能

### 1. ObsidianKnowledgeBridge（知识库桥接器）

**功能**：

- ✅ 连接 Obsidian vault（知识库目录）
- ✅ 读取 Markdown 文件
- ✅ 解析 WikiLinks `[[链接]]`
- ✅ 解析 Tags `#标签`
- ✅ 提取元数据（YAML frontmatter）
- ✅ 全文搜索

**性能要求**：

- 增量索引（仅索引变更的文件）
- 内存高效（大型知识库）
- 快速检索（< 100ms）

### 2. 知识库标签解析器

**功能**：

- ✅ 解析 `knowledge.concepts` 引用
- ✅ 解析 `knowledge.wiki_pages` 引用
- ✅ 智能内容检索
- ✅ 相关性排序

**支持的知识类型**：

```typescript
interface KnowledgeQuery {
  concepts?: string[] // 概念列表
  wikiPages?: string[] // Wiki 页面路径
  maxItems?: number // 最大返回数量
}
```

### 3. Skills 集成

**更新现有 Skills**：

- ✅ `invention-understanding` - 集成三步法、创造性知识
- ✅ `claims-drafting` - 集成权利要求规范
- ✅ `specification-drafting` - 集成说明书规范
- ✅ `patent-analysis` - 集成分析标准

---

## 🏗️ 架构设计

### 模块结构

```
packages/skills/src/
├── knowledge/
│   ├── ObsidianBridge.ts        # 知识库桥接器
│   ├── KnowledgeIndexer.ts      # 知识索引器
│   ├── KnowledgeRetriever.ts    # 知识检索器
│   ├── TagParser.ts             # 标签解析器
│   └── types.ts                 # 知识库相关类型
└── index.ts
```

### 类型定义

```typescript
// 知识库配置
interface KnowledgeConfig {
  vaultPath: string // Obsidian vault 路径
  indexEnabled?: boolean // 是否启用索引
  searchEnabled?: boolean // 是否启用搜索
}

// 知识条目
interface KnowledgeEntry {
  type: 'concept' | 'wiki' | 'card'
  title: string
  content: string
  path: string
  metadata?: Record<string, unknown>
}

// 检索结果
interface KnowledgeResult {
  entries: KnowledgeEntry[]
  totalCount: number
  queryTime: number
}
```

---

## 📝 实施步骤

### Step 1: ObsidianBridge 实现

**文件**: `packages/skills/src/knowledge/ObsidianBridge.ts`

**核心功能**：

1. 连接和读取 vault
2. 解析 Markdown 文件
3. 提取 WikiLinks 和 Tags
4. 构建知识图谱

**依赖**：

- `gray-matter` (已有)
- `ignore` (已有)
- `fast-glob` (文件搜索)

### Step 2: KnowledgeIndexer 实现

**文件**: `packages/skills/src/knowledge/KnowledgeIndexer.ts`

**核心功能**：

1. 增量索引
2. 全文搜索
3. 标签索引
4. 链接关系图

### Step 3: KnowledgeRetriever 实现

**文件**: `packages/skills/src/knowledge/KnowledgeRetriever.ts`

**核心功能**：

1. 按概念检索
2. 按 Wiki 页面检索
3. 相关性排序
4. 结果缓存

### Step 4: TagParser 实现

**文件**: `packages/skills/src/knowledge/TagParser.ts`

**核心功能**：

1. 解析 Skill frontmatter 中的 knowledge 字段
2. 查询知识库
3. 格式化返回结果

### Step 5: Skills 集成

**更新文件**：

- `.yunpat/skills/invention-understanding/SKILL.md`
- `.yunpat/skills/claims-drafting/SKILL.md`
- `.yunpat/skills/specification-drafting/SKILL.md`
- `.yunpat/skills/patent-analysis/SKILL.md`

---

## 🧪 测试计划

### 单元测试

**ObsidianBridge.test.ts** (12 个测试)

- ✅ 读取 vault
- ✅ 解析 Markdown
- ✅ 提取 WikiLinks
- ✅ 提取 Tags

**KnowledgeIndexer.test.ts** (10 个测试)

- ✅ 索引构建
- ✅ 增量更新
- ✅ 搜索功能

**KnowledgeRetriever.test.ts** (8 个测试)

- ✅ 概念检索
- ✅ 页面检索
- ✅ 相关性排序

### 集成测试

**KnowledgeIntegration.test.ts** (6 个测试)

- ✅ Skill 知识集成
- ✅ 上下文增强
- ✅ 端到端测试

---

## 📊 验收标准

### 功能验收

- [ ] 能读取 Obsidian vault
- [ ] 能解析 WikiLinks 和 Tags
- [ ] 能按概念检索
- [ ] 能按 Wiki 页面检索
- [ ] Skills 能正确集成知识库

### 性能验收

- [ ] 索引 1000 个文件 < 5 秒
- [ ] 检索查询 < 100ms
- [ ] 内存占用 < 200MB (1000 文件)

### 质量验收

- [ ] 单元测试覆盖率 > 85%
- [ ] 集成测试通过
- [ ] 文档完整

---

## ⏱️ 时间估算

| 任务                    | 预计时间      | 优先级 |
| ----------------------- | ------------- | ------ |
| ObsidianBridge 实现     | 2.5 小时      | P0     |
| KnowledgeIndexer 实现   | 2 小时        | P0     |
| KnowledgeRetriever 实现 | 1.5 小时      | P0     |
| TagParser 实现          | 1 小时        | P0     |
| Skills 集成             | 1.5 小时      | P0     |
| 测试编写                | 2 小时        | P0     |
| 文档更新                | 1 小时        | P1     |
| **总计**                | **11.5 小时** | -      |

---

## 🔗 依赖关系

```
ObsidianBridge (独立)
    ↓
KnowledgeIndexer (依赖 ObsidianBridge)
    ↓
KnowledgeRetriever (依赖 KnowledgeIndexer)
    ↓
TagParser (依赖 KnowledgeRetriever)
    ↓
Skills Integration (依赖所有模块)
```

---

## 🚀 开始实施

**当前状态**: Step 1 - ObsidianBridge 实现

**下一步**: 创建知识库模块并实现核心功能

---

_阶段四计划完成 - 2026-05-05_
