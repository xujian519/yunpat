# 核心框架完成项目 - 执行指南

## 📋 项目概览

**项目名称**: 核心框架完成项目 (Core Framework Completion)
**团队**: core-framework-completion
**目标**: 将核心框架完成度从 85% 提升到 98%
**周期**: 4-6 周 (2026-05-01 至 2026-06-15)

---

## 🎯 P1-P3 阶段任务总览

### 🔴 P1 阶段: 核心功能补全 (2-3 周)
- ✅ **P1-1**: LLM 嵌入功能实现 (5-7 天) - **进行中**
- ✅ **P1-2**: PostgreSQL 向量存储集成 (7-10 天) - **进行中**
- ⏸️ **P1-3**: 实体关系自动抽取 (5-7 天) - 等待 P1-2

### 🟡 P2 阶段: 安全与验证增强 (1-2 周)
- ⏸️ **P2-1**: OAuth 2.0 认证 (5-7 天)
- ⏸️ **P2-2**: 外部事实验证 (4-5 天)

### 🟢 P3 阶段: 优化与完善 (1 周)
- ⏸️ **P3-1**: 增量规划器完善 (3-4 天)
- ⏸️ **P3-2**: 批处理器优化 (2-3 天)

### 🧪 QA 阶段: 测试与审查 (1 周)
- ⏸️ 集成测试和性能测试
- ⏸️ 代码审查和质量检查

---

## 👥 智能体团队配置

### 已启动智能体 (2 个)

#### 1. embedding-implementer 🟢
**任务**: P1-1 LLM 嵌入功能实现
**Agent ID**: embedding-implementer@core-framework-completion
**状态**: 运行中
**预计完成**: 2026-05-08

#### 2. memory-integrator 🟢
**任务**: P1-2 PostgreSQL 向量存储集成
**Agent ID**: memory-integrator@core-framework-completion
**状态**: 运行中
**预计完成**: 2026-05-11

### 待启动智能体 (7 个)

3. **entity-extraction-specialist** - P1-3 实体关系抽取
4. **oauth-implementer** - P2-1 OAuth 认证
5. **fact-check-integrator** - P2-2 事实验证
6. **incremental-planner** - P3-1 增量规划器
7. **batch-optimizer** - P3-2 批处理器优化
8. **test-specialist** - QA 测试
9. **code-reviewer** - QA 代码审查

---

## 📂 项目文档

### 核心文档

1. **[详细计划文档](./core-framework-completion-plan.md)**
   - 完整的任务拆解
   - 审查清单
   - 技术栈说明
   - 风险管理

2. **[智能体任务分配](./agent-tasks-assignment.md)**
   - 智能体职责说明
   - 执行时序图
   - 沟通机制

3. **[进度跟踪](./progress-tracker.md)**
   - 实时进度更新
   - 每日站会记录
   - 里程碑跟踪
   - 风险问题

---

## 🔧 如何监控进度

### 方式 1: 查看进度文档
```bash
# 查看最新进度
cat docs/plans/progress-tracker.md
```

### 方式 2: 检查智能体状态
```bash
# 列出所有智能体
ls -la ~/.claude/teams/core-framework-completion/

# 查看团队配置
cat ~/.claude/teams/core-framework-completion/config.json
```

### 方式 3: 检查任务完成情况
```bash
# 查看已实现的文件
ls -la packages/core/src/llm/EmbeddingAdapter.ts
ls -la packages/core/src/memory/long-term/PostgresVectorStore.ts
```

---

## 🚀 启动后续任务

### 启动 P1-3 (实体关系抽取)
**条件**: 等待 memory-integrator 完成

```bash
# 通过 Claude Code 启动
Agent({
  subagent_type: "general-purpose",
  name: "entity-extraction-specialist",
  team_name: "core-framework-completion",
  prompt: "你是 entity-extraction-specialist，负责实现 P1-3 阶段的实体关系自动抽取..."
})
```

### 启动 P2 阶段任务
**条件**: P1 阶段全部完成

参考 [agent-tasks-assignment.md](./agent-tasks-assignment.md) 中的任务描述。

---

## 📊 验收标准

### 功能完整性
- [ ] 所有 P1-P3 功能实现完成
- [ ] 单元测试覆盖率 > 85%
- [ ] 集成测试全部通过
- [ ] 无关键 Bug

### 性能指标
- [ ] 嵌入性能 > 100 docs/s
- [ ] 向量搜索延迟 < 50ms
- [ ] 实体抽取 F1 > 0.85
- [ ] Token 估算误差 < 10%

### 质量标准
- [ ] TypeScript 严格模式 0 错误
- [ ] ESLint 0 错误
- [ ] 安全审计通过
- [ ] 代码审查通过

---

## 🔄 每日工作流

### Team Lead 日常
1. **晨会检查** - 查看进度文档，更新状态
2. **智能体同步** - 读取智能体消息，处理阻塞
3. **风险监控** - 评估风险，调整计划
4. **文档更新** - 更新 progress-tracker.md

### 智能体日常
1. **任务执行** - 按计划实现功能
2. **进度报告** - 完成任务后向 Team Lead 报告
3. **问题反馈** - 遇到阻塞及时通知

---

## 📞 联系方式

### Team Lead
- **Agent ID**: team-lead@core-framework-completion
- **职责**: 协调团队、监控进度、解决问题

### 智能体通信
智能体之间通过 EventBus 通信，不直接调用：

```typescript
// 发送消息给其他智能体
await this.send('target-agent', { data: 'message' });

// 监听事件
this.on('agent:completed', async (event) => { ... });
```

---

## 🎉 里程碑

- [ ] **M1**: P1 阶段完成 (2026-05-18)
- [ ] **M2**: P2 阶段完成 (2026-05-25)
- [ ] **M3**: P3 阶段完成 (2026-06-01)
- [ ] **M4**: 测试审查完成 (2026-06-15)
- [ ] **M5**: 发布 v0.3.0 (2026-06-15)

---

## 📚 参考资源

### 技术文档
- [BGE-M3 嵌入模型](https://baai.ir/BGE-M3)
- [pgvector 官方文档](https://github.com/pgvector/pgvector)
- [OAuth 2.0 规范](https://oauth.net/2/)
- [HanLP 文档](https://hanlp.hankcs.com/)

### 项目文档
- [CLAUDE.md](../../CLAUDE.md) - 项目开发指南
- [README.md](../../README.md) - 项目概述
- [docs/](../../docs/) - 完整文档目录

---

**创建时间**: 2026-05-01
**维护者**: Team Lead
**状态**: 🚀 执行中
