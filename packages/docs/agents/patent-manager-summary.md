# PatentManagerAgent 定位说明

**更新时间**: 2026-05-05
**优先级**: 中期目标（Phase 7-8）
**当前完成度**: 40%

---

## 是的，PatentManagerAgent 是专利管理智能体！

### 功能定位

**专利全生命周期管理智能体**，提供：

1. **专利申请管理** - 创建、更新、删除专利记录
2. **期限管理与提醒** - 法定期限跟踪、到期预警
3. **费用管理与监控** - 申请费、年费等费用记录和统计
4. **状态跟踪与报告** - 专利状态跟踪、历史记录、报表生成
5. **工作流程协调** - 协调各个专利智能体，任务分配和进度跟踪

---

## 当前状态

### ✅ 已完成（40%）

- 核心框架（PatentManagerAgent 基类）
- 状态机（PatentStateMachine）
- 通知服务（NotificationService）
- 完整的 TypeScript 类型定义
- 数据库 Schema 设计（Drizzle ORM）

### ⏳ 待完成（60%）

**数据库后端**（优先级：高）

- SQLite 数据库实现
- 数据库迁移脚本
- CRUD 操作完整实现

**管理功能**

- 专利申请 CRUD
- 期限管理和提醒
- 费用管理和统计
- 状态跟踪和历史

**集成功能**

- 与其他专利智能体集成
- 工作流协调
- 报表生成

---

## 数据库演进策略

### 📦 当前：SQLite（开发阶段）

**为什么选择 SQLite？**

- ✅ 零配置，开箱即用
- ✅ 单文件数据库，易于备份
- ✅ 适合中小规模（< 1000 件专利）
- ✅ 快速开发和测试

**技术栈**:

```json
{
  "database": "better-sqlite3",
  "orm": "drizzle-orm",
  "driver": "drizzle-orm/better-sqlite3"
}
```

**实现时间**: 1-2 周

---

### 🚀 未来：PostgreSQL（生产阶段）

**为什么选择 PostgreSQL？**

- ✅ 支持大规模数据（> 10000 件专利）
- ✅ 并发性能优秀
- ✅ 支持复杂查询和分析
- ✅ 企业级可靠性

**技术栈**:

```json
{
  "database": "postgresql",
  "orm": "drizzle-orm",
  "driver": "drizzle-orm/postgres-js"
}
```

**实现时间**: 2-3 个月（根据需求）

---

### 🔄 平滑迁移路径

**设计原则**: SQLite 和 PostgreSQL 使用相同的 Schema 定义

**迁移工具**: 提供一键迁移脚本

```bash
# 从 SQLite 迁移到 PostgreSQL
yunpat migrate --from sqlite --to postgresql
```

---

## 开发优先级

### Phase 1: SQLite 实现（1-2 周）

**Week 1: 数据库层**

- [ ] SQLite 数据库实现
- [ ] Schema 定义和迁移
- [ ] CRUD 操作
- [ ] 数据验证

**Week 2: 业务逻辑层**

- [ ] 专利申请管理
- [ ] 期限管理
- [ ] 基本查询功能
- [ ] 单元测试

### Phase 2: 功能完善（2-3 周）

**Week 3-4: 高级功能**

- [ ] 费用管理
- [ ] 状态跟踪
- [ ] 通知提醒
- [ ] 报表生成

**Week 5: 集成和测试**

- [ ] 与其他智能体集成
- [ ] 端到端测试
- [ ] 性能优化
- [ ] 文档编写

### Phase 3: PostgreSQL 支持（2-3 个月）

**Month 1: PostgreSQL 实现**

- [ ] PostgreSQL 数据库实现
- [ ] 性能优化
- [ ] 并发控制
- [ ] 数据迁移工具

**Month 2-3: 企业级功能**

- [ ] 多用户支持
- [ ] 权限管理
- [ ] 审计日志
- [ ] 备份恢复

---

## 使用示例（未来）

### 创建专利申请

```typescript
await patentManager.createPatent({
  applicationNumber: 'CN202310000000',
  title: '一种图像识别方法',
  applicant: '某某公司',
  inventors: ['张三', '李四'],
  status: 'pending',
})
```

### 查询专利

```typescript
const patents = await patentManager.queryPatents({
  status: 'pending',
  applicant: '某某公司',
})
```

### 添加期限提醒

```typescript
await patentManager.addDeadline({
  patentId: 1,
  type: 'office_action_response',
  date: '2024-06-01',
  reminderDays: 7,
})
```

### 生成报告

```typescript
const report = await patentManager.generateReport({
  type: 'portfolio',
  period: '2024-01-01:2024-12-31',
})
```

---

## 相关文档

- [详细开发路线图](./patent-manager-roadmap.md)
- [数据库 Schema 设计](../packages/agents/patent-manager/src/database/schema.ts)
- [类型定义](../packages/agents/patent-manager/src/types/PatentTypes.ts)

---

**总结**: PatentManagerAgent 是中期目标，当前使用 SQLite 快速开发，未来迁移到 PostgreSQL 支持企业级部署。

**文档更新时间**: 2026-05-05
**优先级**: 中期目标（Phase 7-8）
**状态**: 规划阶段（40% 完成）
