# PatentManagerAgent 开发路线图

**智能体定位**: 专利全生命周期管理智能体
**优先级**: 中期目标（Phase 7-8）
**当前状态**: 40% - 框架完成，无数据库后端
**数据库策略**: SQLite (当前) → PostgreSQL (未来)

---

## 功能定位

PatentManagerAgent 是专利全生命周期管理智能体，提供：

### 1. 专利申请管理

- 创建、更新、删除专利申请记录
- 专利信息管理（申请人、发明人、代理机构等）
- 附件管理（交底书、申请文件、OA 等）

### 2. 期限管理与提醒

- 法定期限跟踪（申请、实审、年费等）
- 自定义期限提醒
- 到期预警通知

### 3. 费用管理与监控

- 申请费、实质审查费、年费等费用记录
- 费用到期提醒
- 费用统计分析

### 4. 状态跟踪与报告

- 专利状态跟踪（申请、实审、授权、驳回等）
- 状态流转历史
- 专利组合报告

### 5. 工作流程协调

- 协调各个专利智能体（Writer、Search、Analyzer、Responder）
- 任务分配和进度跟踪
- 工作流自动化

---

## 当前实现状态

### 已完成（40%）

✅ **核心框架**

- PatentManagerAgent 基类
- 状态机（PatentStateMachine）
- 通知服务（NotificationService）

✅ **类型定义**

- 完整的 TypeScript 接口定义
- 数据模型（PatentApplication、PatentStatus、PatentDeadline 等）

✅ **数据库 Schema 设计**

- Drizzle ORM Schema 定义
- 表结构设计（patents、deadlines、fees、history 等）

### 待完成（60%）

⏳ **数据库后端**

- [ ] SQLite 数据库实现（优先级：高）
- [ ] 数据库迁移脚本
- [ ] CRUD 操作完整实现
- [ ] 数据验证和约束

⏳ **管理功能**

- [ ] 专利申请 CRUD
- [ ] 期限管理和提醒
- [ ] 费用管理和统计
- [ ] 状态跟踪和历史

⏳ **集成功能**

- [ ] 与其他专利智能体集成
- [ ] 工作流协调
- [ ] 报表生成

⏳ **测试**

- [ ] 单元测试
- [ ] 集成测试
- [ ] 端到端测试

---

## 数据库演进策略

### Phase 1: SQLite（当前 - 开发阶段）

**定位**: 快速原型开发和小规模部署

**优势**:

- ✅ 零配置，开箱即用
- ✅ 单文件数据库，易于备份和迁移
- ✅ 适合中小规模（< 1000 件专利）
- ✅ 低资源消耗

**适用场景**:

- 个人用户或小团队（< 10 人）
- 专利数量 < 1000 件
- 单机部署
- 开发和测试环境

**实现计划**:

```typescript
// 使用 better-sqlite3 + Drizzle ORM
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'

const sqlite = new Database('yunpat.db')
const db = drizzle(sqlite, { schema })
```

**时间表**: 1-2 周

---

### Phase 2: PostgreSQL（未来 - 生产阶段）

**定位**: 企业级生产部署

**优势**:

- ✅ 支持大规模数据（> 10000 件专利）
- ✅ 并发性能优秀
- ✅ 支持复杂查询和分析
- ✅ 数据完整性和可靠性高
- ✅ 支持多用户并发访问

**适用场景**:

- 企业用户或代理机构（> 10 人）
- 专利数量 > 1000 件
- 多用户协作
- 生产环境

**实现计划**:

```typescript
// 使用 postgres-js + Drizzle ORM
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL)
const db = drizzle(client, { schema })
```

**时间表**: 2-3 个月（根据需求）

---

## 数据库迁移策略

### 1. Schema 兼容性设计

**原则**: SQLite 和 PostgreSQL 使用相同的 Schema 定义

```typescript
// schema.ts - 两种数据库共享
import { sqliteTable, pgTable, text, integer } from 'drizzle-orm'

// SQLite Schema
export const patents = sqliteTable('patents', {
  id: integer('id').primaryKey(),
  applicationNumber: text('application_number').notNull(),
  // ...
})

// PostgreSQL Schema
export const patents = pgTable('patents', {
  id: serial('id').primaryKey(),
  applicationNumber: text('application_number').notNull(),
  // ...
})
```

### 2. 数据迁移工具

**SQLite → PostgreSQL 迁移脚本**:

```typescript
// migration/sqlite-to-postgres.ts
export async function migrateSQLiteToPostgres(
  sqliteDb: Database,
  postgresDb: ReturnType<typeof drizzle>
) {
  // 1. 导出 SQLite 数据
  const patents = await sqliteDb.select().from(patentsTable)

  // 2. 导入到 PostgreSQL
  await postgresDb.insert(patentsTable).values(patents)

  // 3. 验证数据完整性
  // ...
}
```

### 3. 配置切换

**环境变量控制**:

```bash
# .env - SQLite
DATABASE_TYPE=sqlite
DATABASE_PATH=./yunpat.db

# .env - PostgreSQL
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:pass@localhost:5432/yunpat
```

**代码适配**:

```typescript
// 根据环境变量创建数据库实例
const db =
  process.env.DATABASE_TYPE === 'postgresql' ? createPostgresDatabase() : createSQLiteDatabase()
```

---

## 开发优先级

### Phase 1: SQLite 实现（1-2 周）

**目标**: 实现基础的专利管理功能

1. **Week 1: 数据库层**
   - [ ] SQLite 数据库实现
   - [ ] Schema 定义和迁移
   - [ ] CRUD 操作
   - [ ] 数据验证

2. **Week 2: 业务逻辑层**
   - [ ] 专利申请管理
   - [ ] 期限管理
   - [ ] 基本查询功能
   - [ ] 单元测试

### Phase 2: 功能完善（2-3 周）

**目标**: 实现完整的管理功能

3. **Week 3-4: 高级功能**
   - [ ] 费用管理
   - [ ] 状态跟踪
   - [ ] 通知提醒
   - [ ] 报表生成

4. **Week 5: 集成和测试**
   - [ ] 与其他智能体集成
   - [ ] 端到端测试
   - [ ] 性能优化
   - [ ] 文档编写

### Phase 3: PostgreSQL 支持（2-3 个月）

**目标**: 支持企业级部署

5. **Month 1: PostgreSQL 实现**
   - [ ] PostgreSQL 数据库实现
   - [ ] 性能优化
   - [ ] 并发控制
   - [ ] 数据迁移工具

6. **Month 2-3: 企业级功能**
   - [ ] 多用户支持
   - [ ] 权限管理
   - [ ] 审计日志
   - [ ] 备份恢复

---

## 技术栈

### 当前（SQLite）

```json
{
  "database": "better-sqlite3",
  "orm": "drizzle-orm",
  "driver": "drizzle-orm/better-sqlite3"
}
```

### 未来（PostgreSQL）

```json
{
  "database": "postgresql",
  "orm": "drizzle-orm",
  "driver": "drizzle-orm/postgres-js"
}
```

---

## 数据模型

### 核心表结构

```sql
-- 专利申请表
CREATE TABLE patents (
  id INTEGER PRIMARY KEY,
  application_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  applicant TEXT NOT NULL,
  inventors TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 期限表
CREATE TABLE patent_deadlines (
  id INTEGER PRIMARY KEY,
  patent_id INTEGER NOT NULL,
  deadline_type TEXT NOT NULL,
  deadline_date DATE NOT NULL,
  reminder_days INTEGER,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (patent_id) REFERENCES patents(id)
);

-- 费用表
CREATE TABLE patent_fees (
  id INTEGER PRIMARY KEY,
  patent_id INTEGER NOT NULL,
  fee_type TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'unpaid',
  FOREIGN KEY (patent_id) REFERENCES patents(id)
);

-- 历史表
CREATE TABLE patent_history (
  id INTEGER PRIMARY KEY,
  patent_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patent_id) REFERENCES patents(id)
);
```

---

## API 设计

### 专利管理 API

```typescript
// 创建专利申请
await patentManager.createPatent({
  applicationNumber: 'CN202310000000',
  title: '一种图像识别方法',
  applicant: '某某公司',
  inventors: ['张三', '李四'],
  status: 'pending',
})

// 查询专利
const patents = await patentManager.queryPatents({
  status: 'pending',
  applicant: '某某公司',
})

// 更新专利状态
await patentManager.updateStatus('CN202310000000', 'under_examination')

// 添加期限提醒
await patentManager.addDeadline({
  patentId: 1,
  type: 'office_action_response',
  date: '2024-06-01',
  reminderDays: 7,
})

// 生成报告
const report = await patentManager.generateReport({
  type: 'portfolio',
  period: '2024-01-01:2024-12-31',
})
```

---

## 总结

### 当前状态

- ✅ 框架完成（40%）
- ⏳ 数据库后端待实现
- 📋 定位：中期开发目标

### 数据库策略

- 📦 **当前**: SQLite（快速开发，小规模部署）
- 🚀 **未来**: PostgreSQL（企业级，大规模部署）
- 🔄 **迁移**: 提供平滑迁移路径

### 开发计划

- ⏰ **Phase 1** (1-2 周): SQLite 实现
- ⏰ **Phase 2** (2-3 周): 功能完善
- ⏰ **Phase 3** (2-3 月): PostgreSQL 支持

---

**文档更新时间**: 2026-05-05
**优先级**: 中期目标（Phase 7-8）
**状态**: 规划阶段
