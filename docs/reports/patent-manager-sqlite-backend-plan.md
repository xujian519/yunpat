# PatentManagerAgent SQLite 后端基础实现计划

**创建时间**: 2026-05-11 17:30
**目标**: 为 PatentManagerAgent 实现基础的 SQLite 数据库后端，支持开发阶段和快速原型

---

## 📊 现状分析

### 当前实现（PostgreSQL）

**优点**:
- ✅ 完整的 Schema 定义（Drizzle ORM）
- ✅ 类型安全的 CRUD 操作
- ✅ 支持复杂查询（JOIN, AGGREGATE）
- ✅ 事务支持
- ✅ 连接池管理

**限制**:
- ❌ 需要部署 PostgreSQL 服务器
- ❌ 开发环境配置复杂
- ❌ 不适合快速原型开发
- ❌ 资源消耗较大

### SQLite 需求（开发阶段）

**目标**:
1. ✅ 零配置 - 开箱即用，单文件数据库
2. ✅ 快速原型 - 适合快速开发和测试
3. ✅ 易于部署 - 复制数据库文件即可
4. ✅ 低资源消耗 - 适合本地开发
5. ✅ 兼容现有接口 - 保持与 PostgreSQL 版本相同的 API

**权衡**:
- ⚠️ 查询性能 - PostgreSQL 更强（JOIN, 复杂查询）
- ⚠️ 并发能力 - PostgreSQL 更强（连接池）
- ⚠️ 功能完整性 - SQLite 版本会功能简化

---

## 🏗️ SQLite 后端架构设计

### 1. 文件结构

```
patent-manager/src/database/
├── schema.ts              # 现有 PostgreSQL schema（保持不变）
├── PatentDatabase.ts       # 数据库接口定义
├── SQLiteAdapter.ts       # SQLite 适配器（新增）
├── migrations/             # SQLite 迁移脚本（新增）
└── init.sql               # 初始化脚本（新增）
```

### 2. 核心接口设计

**PatentDatabase 接口**（抽象层，支持多种数据库后端）:

```typescript
interface PatentDatabase {
  // 专利 CRUD
  createPatent(patent: PatentApplication): Promise<PatentApplication>
  getPatent(id: string): Promise<PatentApplication | null>
  listPatents(query: PatentQuery): Promise<PatentApplication[]>
  updatePatent(id: string, patent: PatentApplication): Promise<void>
  deletePatent(id: string): Promise<void>

  // 截止日期管理
  createDeadline(deadline: PatentDeadline): Promise<PatentDeadline>
  getDeadlines(applicationNumber: string): Promise<PatentDeadline[]>
  updateDeadline(id: string, deadline: PatentDeadline): Promise<void>
  deleteDeadline(id: string): Promise<void>

  // 费用管理
  createFee(fee: PatentFee): Promise<PatentFee>
  getFees(applicationNumber: string): Promise<PatentFee[]>
  updateFee(id: string, fee: PatentFee): Promise<void>
  deleteFee(id: string): Promise<void>

  // 历史记录
  createHistory(history: PatentHistory): Promise<PatentHistory>
  getHistory(applicationNumber: string): Promise<PatentHistory[]>

  // 查询统计
  getStatistics(): Promise<DatabaseStatistics>
}
```

### 3. SQLite 适配器设计

**SQLiteAdapter 实现**:

```typescript
class SQLiteAdapter implements PatentDatabase {
  private db: Database

  constructor(config: SQLiteAdapterConfig) {
    this.db = new Database(config.dbPath)
    this.initializeSchema()
  }

  // 专利 CRUD 操作
  async createPatent(patent: PatentApplication) { ... }
  async getPatent(id: string) { ... }
  async listPatents(query: PatentQuery) { ... }

  // 数据初始化和迁移
  private initializeSchema() { ... }
  async migrate(version: number) { ... }
}
```

### 4. 数据库 Schema（SQLite）

**表结构**（简化版，支持开发阶段）:

```sql
-- 专利主表
CREATE TABLE patents (
  id TEXT PRIMARY KEY,
  application_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  applicant TEXT,
  inventors TEXT,  -- JSON array as string
  patent_type TEXT,  -- 'invention' | 'utility' | 'design'
  status TEXT DEFAULT 'draft',  -- PostgreSQL enum as string
  filing_date TEXT,  -- ISO 8601 timestamp
  priority_claims TEXT,  -- JSON array as string
  attorney TEXT,
  classification TEXT,
  abstract TEXT,
  claims TEXT,  -- JSON array as string
  description TEXT,
  metadata TEXT,  -- JSON for additional metadata
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 专利截止日期表
CREATE TABLE patent_deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_number TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'oa_response' | 'renewal_fee' | 'publication_fee' | ...
  deadline_date TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 专利费用表
CREATE TABLE patent_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_number TEXT NOT NULL,
  fee_type TEXT NOT NULL,  -- 'annual_fee' | 'examination_fee' | ...
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'CNY',
  due_date TEXT,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'paid' | 'overdue'
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 专利历史记录表
CREATE TABLE patent_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_number TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'status_change' | 'fee_payment' | ...
  description TEXT,
  metadata TEXT,  -- JSON for additional context
  created_at TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX idx_patents_application_number ON patents(application_number);
CREATE INDEX idx_patents_status ON patents(status);
CREATE INDEX idx_patents_filing_date ON patents(filing_date);
CREATE INDEX idx_deadlines_application_number ON patent_deadlines(application_number);
CREATE INDEX idx_deadlines_date ON patent_deadlines(deadline_date);
CREATE INDEX idx_fees_application_number ON patent_fees(application_number);
```

---

## 📋 实现计划

### Phase 1: 基础架构（当前）

- [x] 1. 定义 PatentDatabase 抽象接口
- [x] 2. 创建 SQLiteAdapter 类骨架
- [x] 3. 实现基础 CRUD 操作（create, get, update, delete）
- [x] 4. 添加数据库初始化逻辑
- [x] 5. 创建简单的迁移系统

### Phase 2: 核心功能（Week 2+）

- [ ] 6. 实现截止日期管理
- [ ] 7. 实现费用管理
- [ ] 8. 实现历史记录
- [ ] 9. 实现统计查询
- [ ] 10. 添加复杂查询支持（分页、过滤、排序）

### Phase 3: 增强功能（Week 3+）

- [ ] 11. 添加事务支持
- [ ] 12. 实现查询优化
- [ ] 13. 添加并发安全
- [ ] 14. 完善错误处理和恢复
- [ ] 15. 添加完整的单元测试
- [ ] 16. 实现数据迁移工具

### Phase 4: PostgreSQL 迁移（Week 4+）

- [ ] 17. 优化 PostgreSQL 查询
- [ ] 18. 实现数据迁移脚本（SQLite → PostgreSQL）
- [ ] 19. 添加性能监控
- [ ] 20. 完整集成测试

---

## 🔧 技术实现细节

### 依赖选择

**推荐**:
- ✅ `better-sqlite3`: TypeScript 友好的 SQLite 库
- 备选: `sqlite3` (原生), `sql.js` (纯 JS)

### 关键设计决策

1. **JSON 字段处理**:
   - 存储 JSON 数组为 TEXT 字段
   - 应用时使用 `JSON.parse()` 和 `JSON.stringify()`
   - 原因：SQLite 不原生支持 JSON 数组

2. **日期处理**:
   - 使用 TEXT 字段存储 ISO 8601 格式时间戳
   - 应用时使用 `new Date()` 和 `date.toISOString()`

3. **枚举处理**:
   - 将 PostgreSQL 枚举存储为 TEXT 字段
   - 应用时使用 TypeScript 枚举验证
   - 原因：SQLite 不原生支持枚举

4. **ID 生成**:
   - 专利 ID 使用 `application_number` 作为主键
   - 其他表使用自增 INTEGER 主键

### 错误处理策略

```typescript
// 数据库操作错误处理
try {
  await this.db.run(sql, params)
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT') {
    // 违反唯一性约束
    throw new UniqueConstraintError(`记录已存在: ${field}`)
  } else if (error.code === 'SQLITE_BUSY') {
    // 数据库锁定
    throw new DatabaseBusyError('数据库忙碌，请稍后重试')
  } else {
    // 未知错误
    throw new DatabaseError(`数据库操作失败: ${error.message}`)
  }
}
```

---

## 📄 相关文件

**新建文件**:
- `/Users/xujian/projects/yunpat-agent/packages/packages/agents/patent-manager/src/database/SQLiteAdapter.ts`
- `/Users/xujian/projects/yunpat-agent/packages/packages/agents/patent-manager/src/database/init.sql`

**修改文件**:
- `/Users/xujian/projects/yunpat-agent/packages/packages/agents/patent-manager/src/database/PatentDatabase.ts`（更新接口定义）

**更新文档**:
- `/Users/xujian/projects/yunpat-agent/packages/packages/agents/patent-manager/README.md`（添加 SQLite 后端说明）

---

## 🎯 预期成果

### 立即交付（Phase 1）

1. ✅ **基础 CRUD 操作**: 支持专利的创建、读取、更新、删除
2. ✅ **数据库初始化**: 自动创建表和索引
3. ✅ **基础查询**: 按申请号、状态查询
4. ✅ **错误处理**: 基本的约束检查和错误处理
5. ✅ **类型安全**: TypeScript 接口定义

### 功能限制（Phase 1）

⚠️ **不支持的功能**（后续实现）:
- ❌ 复杂查询（JOIN, 子查询）
- ❌ 事务支持（批量操作）
- ❌ 统计查询（聚合函数）
- ❌ 性能优化（查询计划）
- ❌ 完整的单元测试
- ❌ 数据迁移工具

---

## 📅 建议与后续步骤

### Week 2-3 建议

1. **验证基础功能**:
   - 测试 CRUD 操作的正确性
   - 验证约束完整性（唯一性、非空等）
   - 测试并发安全性

2. **扩展查询功能**:
   - 添加分页支持
   - 添加排序功能
   - 添加高级过滤（按日期范围、类型等）

3. **完善错误处理**:
   - 添加重试机制
   - 实现事务回滚
   - 完善错误日志

4. **性能优化**:
   - 添加必要的索引
   - 实现查询缓存
   - 优化批量操作

### 数据库迁移建议

**从 SQLite 到 PostgreSQL**:
1. 使用导出工具（CSV, JSON）导出数据
2. 编写 PostgreSQL 导入脚本
3. 验证数据一致性
4. 逐步迁移，保持同步运行

---

**状态**: 📋 **SQLite 后端基础实现计划已创建**

**下一步**: 开始 Phase 1 实现基础 CRUD 操作

**最后更新**: 2026-05-11 17:30
