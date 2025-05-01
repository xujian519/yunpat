# 阶段三实施计划 - 条件激活机制

**开始日期**: 2026-05-05
**预计完成**: Week 3
**优先级**: 🔴 高

---

## 🎯 目标

基于文件路径和条件自动激活相关 Skills，实现智能上下文感知。

---

## 📋 核心功能

### 1. 路径匹配引擎（PathMatcher）

**功能**：

- ✅ Glob 模式匹配（`**/*.pdf`, `src/**/*.ts`）
- ✅ 文件扩展名匹配（`.pdf`, `.md`）
- ✅ 正则表达式匹配
- ✅ 路径前缀匹配

**性能要求**：

- 编译并缓存 glob 模式
- O(1) 查找复杂度
- 支持批量匹配

### 2. 条件激活器（ConditionalActivator）

**功能**：

- ✅ 评估 Skill frontmatter 中的条件
- ✅ 支持 `paths` 字段（glob 模式数组）
- ✅ 支持 `file-types` 字段（扩展名数组）
- ✅ 返回匹配的 Skills 列表

**评估逻辑**：

```typescript
interface ActivationCondition {
  paths?: string[] // glob 模式
  fileTypes?: string[] // 文件扩展名
  agent?: string[] // 适用的 Agent
}

// 满足任一条件即激活
```

### 3. Agent 集成

**API**：

```typescript
class SkillsProfessionalAgent {
  // 获取当前路径应激活的 Skills
  getActiveSkills(filePath: string): Skill[]

  // 检查 Skill 是否应激活
  isSkillActive(skillName: string, filePath: string): boolean

  // 自动激活并调用 Skill
  async callActiveSkill(filePath: string, args?: any): Promise<Result>
}
```

---

## 🏗️ 架构设计

### 模块结构

```
packages/skills/src/
├── activation/
│   ├── PathMatcher.ts          # 路径匹配引擎
│   ├── ConditionalActivator.ts # 条件激活器
│   └── types.ts                # 激活相关类型
└── index.ts                    # 导出
```

### 类型定义

```typescript
// 激活条件
interface ActivationCondition {
  paths?: string[] // Glob 模式数组
  fileTypes?: string[] // 文件扩展名数组
  agent?: string[] // 适用的 Agent 名称
}

// 激活结果
interface ActivationResult {
  skill: Skill
  matchedBy: 'path' | 'fileType' | 'agent'
  matchedPattern: string
}

// 匹配器配置
interface PathMatcherConfig {
  caseSensitive?: boolean
  cacheEnabled?: boolean
}
```

---

## 📝 实施步骤

### Step 1: 路径匹配引擎（PathMatcher）

**文件**: `packages/skills/src/activation/PathMatcher.ts`

**核心功能**：

1. Glob 模式编译和缓存
2. 路径匹配算法
3. 批量匹配优化

**依赖**：

- `minimatch` 或 `fast-glob` 库

**测试**：

- Glob 模式匹配测试
- 边界情况测试
- 性能基准测试

### Step 2: 条件激活器（ConditionalActivator）

**文件**: `packages/skills/src/activation/ConditionalActivator.ts`

**核心功能**：

1. 解析 Skill frontmatter 中的条件
2. 评估路径匹配
3. 评估文件类型匹配
4. 返回激活的 Skills

**测试**：

- 单条件测试
- 多条件组合测试
- 无条件 Skills 测试

### Step 3: Agent 集成

**文件**: `packages/agents/base/src/SkillsProfessionalAgent.ts`

**新增方法**：

1. `getActiveSkills(filePath: string): Skill[]`
2. `isSkillActive(skillName: string, filePath: string): boolean`
3. `autoActivateForFile(filePath: string): Promise<Skill[]>`

**测试**：

- 集成测试
- 真实场景测试

### Step 4: 示例和文档

**内容**：

1. 更新现有 Skills 的 frontmatter
2. 创建条件激活示例
3. 编写使用文档

---

## 🧪 测试计划

### 单元测试

**PathMatcher.test.ts** (15 个测试)

- ✅ 基本 glob 匹配
- ✅ 双星号匹配
- ✅ 扩展名匹配
- ✅ 大小写敏感/不敏感
- ✅ 缓存功能

**ConditionalActivator.test.ts** (12 个测试)

- ✅ 路径条件评估
- ✅ 文件类型条件评估
- ✅ 多条件组合
- ✅ 无条件默认激活

### 集成测试

**ConditionalActivation.test.ts** (8 个测试)

- ✅ 文件操作自动激活
- ✅ 多 Skills 激活
- ✅ 优先级处理

---

## 📊 验收标准

### 功能验收

- [ ] Glob 模式匹配正确
- [ ] 文件类型匹配正确
- [ ] Agent 集成完整
- [ ] 自动激活工作正常

### 性能验收

- [ ] 单次匹配 < 1ms
- [ ] 批量匹配（100 Skills）< 10ms
- [ ] 缓存命中率 > 80%

### 质量验收

- [ ] 单元测试覆盖率 > 90%
- [ ] 集成测试通过
- [ ] 文档完整

---

## ⏱️ 时间估算

| 任务                      | 预计时间     | 优先级 |
| ------------------------- | ------------ | ------ |
| PathMatcher 实现          | 2 小时       | P0     |
| ConditionalActivator 实现 | 2 小时       | P0     |
| Agent 集成                | 1.5 小时     | P0     |
| 测试编写                  | 2 小时       | P0     |
| 文档更新                  | 1 小时       | P1     |
| **总计**                  | **8.5 小时** | -      |

---

## 🔗 依赖关系

```
PathMatcher (独立)
    ↓
ConditionalActivator (依赖 PathMatcher)
    ↓
Agent Integration (依赖 ConditionalActivator)
    ↓
Tests & Docs (依赖所有模块)
```

---

## 🚀 开始实施

**当前状态**: Step 1 - PathMatcher 实现

**下一步**: 创建 PathMatcher.ts 文件并实现核心功能

---

_阶段三计划完成 - 2026-05-05_
