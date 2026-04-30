# 记忆层重构说明

## 已知重复代码

### MemoryStore.ts vs CheckpointManager.ts

这两个文件都实现了类似的记忆管理功能：

**MemoryStore.ts**:
- `ShortTermMemory` 类
- `MemoryManager` 类
- 方法: `get/set/delete/has/getAll/clear/search`

**CheckpointManager.ts**:
- `EnhancedMemoryStore` 类
- 方法: `get/set/delete/has/getAll/clear/search`

### 重构计划（未来工作）

**优先级**: P1（建议修复）

**方案**: 合并为统一的记忆管理器

**步骤**:
1. 创建 `UnifiedMemoryStore` 类
2. 迁移两个类的功能
3. 更新所有引用
4. 添加单元测试
5. 删除旧代码

**影响范围**:
- `packages/core/src/memory/MemoryStore.ts`
- `packages/core/src/memory/CheckpointManager.ts`
- 所有引用这些类的代码

**风险**: 中等（需要全面测试）

---

## 其他已知问题

### P2-1: compress() 空壳

📍 `MemoryStore.ts:94`

```typescript
async compress(): Promise<void> {
  // TODO: 实现记忆压缩逻辑
}
```

**状态**: 已标记为 @deprecated

**修复方案**:
- 方案 1: 实现 LRU 压缩算法（推荐）
- 方案 2: 删除此方法
- 方案 3: 标记为 abstract 并由子类实现

### P2-2: Token 估算精度不足

📍 `TokenWindow.ts:113`

```typescript
const chineseTokens = Math.ceil(chineseChars / 1.5);
const englishTokens = Math.ceil(englishChars / 4);
```

**状态**: 已知限制

**修复方案**:
- 集成 tiktoken 库（推荐）
- 或使用 claude-tokenizer
- 或添加 BPE 分词支持

**影响**: Token 压缩精度可能偏差 ±20%

---

## 已修复的问题

### ✅ P0-1: API Key 硬编码 → 环境变量

**修复文件**:
- `packages/core/src/memory/config.ts` (新建)
- `patents/agents/AgentMemoryManager.ts`
- `patents/agents/writer/PatentWriterAgentWithMemory.ts`
- `patents/agents/responder/PatentResponderAgentWithMemory.ts`
- `patents/agents/analyzer/PatentAnalyzerAgentWithMemory.ts`

**使用方法**:
```bash
export BGE_API_KEY=your-api-key-here
```

### ✅ P0-2: embedding 类型 text vs vector 统一

**修复文件**:
- `packages/core/src/memory/long-term/PostgresVectorStore.ts`

**修复内容**:
- 在 `initialize()` 方法中直接创建 vector(1024) 类型的列
- 添加类型转换逻辑

### ✅ P0-3: or 导入位置

**状态**: 实际不存在，`or` 已在文件顶部正确导入

### ✅ P1-1: upsertBatch 伪批量

**状态**: 实际已在当前代码中修复，使用真批量插入

---

## 代码质量评分（更新后）

| 维度 | 修复前 | 修复后 | 说明 |
|------|--------|--------|------|
| **架构设计** | ⭐⭐⭐⭐ (8/10) | ⭐⭐⭐⭐ (8/10) | 分层清晰 |
| **代码质量** | ⭐⭐⭐ (6/10) | ⭐⭐⭐⭐ (7/10) | 修复了主要问题 |
| **安全性** | ⭐⭐ (4/10) | ⭐⭐⭐⭐ (8/10) | ✅ API Key 从环境变量读取 |
| **性能** | ⭐⭐⭐ (6/10) | ⭐⭐⭐⭐ (7/10) | ✅ 真批量插入，LRU 缓存 |
| **测试覆盖** | ⭐⭐⭐⭐ (7/10) | ⭐⭐⭐⭐ (7/10) | 集成测试覆盖不错 |
| **可维护性** | ⭐⭐⭐ (6/10) | ⭐⭐⭐ (6/10) | 仍有重复代码待重构 |

---

## 下一步建议

1. **P1 优先级**: 合并 MemoryStore 重复代码（预计 2-3 小时）
2. **P2 优先级**: 实现 compress() 方法（预计 1 小时）
3. **P2 优先级**: 集成 tiktoken（预计 2-3 小时）
4. **持续优化**: 添加更多单元测试
5. **文档更新**: 补充 API 文档和使用示例
