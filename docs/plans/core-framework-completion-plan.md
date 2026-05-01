# 核心框架完成计划 - P1-P3 阶段

**项目**: YunPat 核心框架 (packages/core)
**当前完成度**: 85% → 目标: 98%
**计划周期**: 4-6 周
**创建时间**: 2026-05-01

---

## 📋 任务概览

| 阶段 | 任务数 | 预估工时 | 优先级 | 并行度 |
|------|--------|----------|--------|--------|
| P1: 核心功能补全 | 3 | 2-3 周 | 🔴 高 | 2 并行 |
| P2: 安全验证增强 | 2 | 1-2 周 | 🟡 中 | 2 并行 |
| P3: 优化完善 | 2 | 1 周 | 🟢 低 | 串行 |
| 测试与审查 | 2 | 1 周 | 🔴 高 | 并行 |

---

## 🔴 P1 阶段: 核心功能补全 (2-3 周)

### P1-1: LLM 嵌入功能实现

**负责人**: Agent-Embedding
**预估工时**: 5-7 天
**依赖**: 无
**并行**: ✅ 可与 P1-2 并行

#### 任务拆解

**1.1 设计嵌入接口**
- [ ] 定义统一的 `EmbeddingAdapter` 接口
- [ ] 支持批量嵌入（batch_size 优化）
- [ ] 定义嵌入模型配置（BGE-M3, M3E-base 等）
- [ ] 设计降级策略（主备模型切换）

**1.2 实现 NativeLLMAdapter 嵌入功能**
- [ ] 集成 BGE-M3 嵌入模型（推荐）
- [ ] 实现 `embed()` 单文本嵌入
- [ ] 实现 `embedBatch()` 批量嵌入
- [ ] 添加缓存机制（避免重复计算）
- [ ] 错误处理和重试逻辑

**1.3 实现 OMXLAdapter 嵌入功能**
- [ ] 集成 OMML 嵌入端点
- [ ] 实现异步嵌入调用
- [ ] 流式嵌入支持（大文本分段）

**1.4 测试**
- [ ] 单元测试：嵌入维度验证
- [ ] 单元测试：批量嵌入性能
- [ ] 集成测试：实际 API 调用
- [ ] 性能测试：1000 文本嵌入基准

#### 交付物

- [ ] `packages/core/src/llm/EmbeddingAdapter.ts` (完整实现)
- [ ] `packages/core/src/llm/NativeLLMAdapter.ts` (嵌入方法)
- [ ] `packages/core/src/llm/OMXLAdapter.ts` (嵌入方法)
- [ ] `packages/core/test/embedding.integration.test.ts`
- [ ] 嵌入性能基准报告

#### 审查清单

**代码质量**:
- [ ] TypeScript 严格模式通过
- [ ] 无 ESLint 错误
- [ ] 代码覆盖率 > 85%
- [ ] 所有导出函数有 JSDoc 注释

**功能验证**:
- [ ] 嵌入向量维度正确（BGE-M3: 1024 维）
- [ ] 相似文本向量距离 < 0.3
- [ ] 批量嵌入性能 > 100 docs/s
- [ ] 缓存命中率 > 30%

**安全性**:
- [ ] API Key 加密存储
- [ ] 请求速率限制
- [ ] 敏感数据脱敏日志

---

### P1-2: 记忆层向量存储集成

**负责人**: Agent-Memory
**预估工时**: 7-10 天
**依赖**: 无
**并行**: ✅ 可与 P1-1 并行

#### 任务拆解

**2.1 PostgreSQL + pgvector 集成**
- [ ] 安装配置 pgvector 扩展
- [ ] 创建向量表结构（memories, entities, relations）
- [ ] 实现连接池管理
- [ ] 数据库迁移脚本

**2.2 向量存储实现**
- [ ] `PostgresVectorStore` 类实现
  - [ ] `upsert()` 单条插入
  - [ ] `upsertBatch()` 批量插入
  - [ ] `search()` 向量相似度搜索（HNSW 索引）
  - [ ] `delete()` 删除操作
  - [ ] `get()` 查询单条
- [ ] 索引优化（HNSW 参数调优）
- [ ] 查询性能优化（分页、过滤）

**2.3 图存储实现**
- [ ] `PostgresGraphStore` 类实现
  - [ ] `createEntity()` 创建节点
  - [ ] `createRelation()` 创建边
  - [ ] `findShortestPath()` 最短路径
  - [ ] `getNeighbors()` 邻居查询
- [ ] 图查询优化（递归 CTE）

**2.4 MemoryLayer 统一接口**
- [ ] 整合向量存储和图存储
- [ ] 实现事务管理
- [ ] 添加备份恢复机制

**2.5 测试**
- [ ] 单元测试：CRUD 操作
- [ ] 集成测试：PostgreSQL 连接
- [ ] 性能测试：10 万向量搜索基准
- [ ] 并发测试：多线程写入

#### 交付物

- [ ] `packages/core/src/memory/long-term/PostgresVectorStore.ts`
- [ ] `packages/core/src/memory/long-term/PostgresGraphStore.ts`
- [ ] `packages/core/src/memory/long-term/schema.sql`
- [ ] `packages/core/test/postgres-store.integration.test.ts`
- [ ] 性能基准报告（搜索延迟、吞吐量）

#### 审查清单

**代码质量**:
- [ ] SQL 注入防护（参数化查询）
- [ ] 连接池泄漏检测
- [ ] 事务完整性验证
- [ ] 代码覆盖率 > 80%

**功能验证**:
- [ ] 10 万向量搜索 < 50ms
- [ ] 批量插入 > 1000 vectors/s
- [ ] HNSW 索引召回率 > 95%
- [ ] 图查询支持 1000+ 节点

**可靠性**:
- [ ] 数据库连接断开自动重连
- [ ] 事务回滚机制
- [ ] 备份恢复脚本测试通过

---

### P1-3: 实体关系自动抽取

**负责人**: Agent-EntityExtraction
**预估工时**: 5-7 天
**依赖**: P1-2 完成
**并行**: ❌ 串行（依赖向量存储）

#### 任务拆解

**3.1 NLP 工具选型**
- [ ] 评估中文 NLP 库（HanLP, jieba, spacy）
- [ ] 选择实体识别方案（NER 模型）
- [ ] 选择关系抽取方案（规则/模型）

**3.2 实体抽取实现**
- [ ] `EntityExtractor` 类
  - [ ] `extractEntities()` 实体识别
  - [ ] 支持专利实体：申请人、发明人、分类号、日期
  - [ ] 实体归一化（同义词合并）
- [ ] 自定义词典支持

**3.3 关系抽取实现**
- [ ] `RelationExtractor` 类
  - [ ] `extractRelations()` 关系识别
  - [ ] 支持专利关系：申请人-发明人、引用、优先权
  - [ ] 关系权重计算

**3.4 MemoryLayer 集成**
- [ ] 在 `addMemory()` 自动调用抽取
- [ ] 实体关系自动写入图存储
- [ ] 增量更新机制

**3.5 测试**
- [ ] 单元测试：抽取准确率
- [ ] 集成测试：端到端流程
- [ ] 准确率测试：专利文档抽取

#### 交付物

- [ ] `packages/core/src/memory/long-term/EntityExtractor.ts`
- [ ] `packages/core/src/memory/long-term/RelationExtractor.ts`
- [ ] `packages/core/src/memory/long-term/MemoryLayer.ts` (完整版)
- [ ] `packages/core/test/entity-extraction.test.ts`
- [ ] 抽取准确率报告

#### 审查清单

**功能验证**:
- [ ] 实体抽取 F1-score > 0.85
- [ ] 关系抽取 F1-score > 0.75
- [ ] 处理速度 > 10 docs/s
- [ ] 支持增量更新

**质量保证**:
- [ ] 误报率 < 10%
- [ ] 实体归一化准确率 > 90%
- [ ] 边界案例处理（空文档、超长文档）

---

## 🟡 P2 阶段: 安全与验证增强 (1-2 周)

### P2-1: OAuth 2.0 认证实现

**负责人**: Agent-Auth
**预估工时**: 5-7 天
**依赖**: 无
**并行**: ✅ 可与 P2-2 并行

#### 任务拆解

**2.1-1 OAuth 2.0 框架搭建**
- [ ] 选择 OAuth 库（openid-client 或自实现）
- [ ] 定义 OAuth 配置接口
- [ ] 支持 Grant Types: Authorization Code, Client Credentials

**2.1-2 提供商集成**
- [ ] Google OAuth 2.0
- [ ] GitHub OAuth 2.0
- [ ] 通用 OAuth 2.0 提供商接口

**2.1-3 Gateway 集成**
- [ ] `OAuthManager` 类实现
- [ ] 认证流程端点（/auth/login, /auth/callback）
- [ ] Token 刷新机制
- [ ] Session 关联

**2.1-4 测试**
- [ ] 单元测试：各流程步骤
- [ ] 集成测试：真实提供商测试
- [ ] 安全测试：CSRF、重定向攻击

#### 交付物

- [ ] `packages/core/src/gateway/auth/OAuthManager.ts`
- [ ] `packages/core/src/gateway/auth/providers/GoogleOAuth.ts`
- [ ] `packages/core/src/gateway/auth/providers/GitHubOAuth.ts`
- [ ] `packages/core/test/oauth.integration.test.ts`

#### 审查清单

**安全性**:
- [ ] PKCE 流程实现
- [ ] State 参数防 CSRF
- [ ] Token 加密存储
- [ ] 安全审计通过

**功能验证**:
- [ ] 登录流程端到端测试通过
- [ ] Token 自动刷新
- [ ] 多提供商切换

---

### P2-2: 外部事实验证集成

**负责人**: Agent-FactCheck
**预估工时**: 4-5 天
**依赖**: 无
**并行**: ✅ 可与 P2-1 并行

#### 任务拆解

**2.2-1 事实验证 API 集成**
- [ ] 调研 Google Fact Check Tools API
- [ ] 集成其他事实验证源（如 Snopes, PolitiFact）
- [ ] API 客户端封装

**2.2-2 FactChecker 扩展**
- [ ] 实现 `verifyWithExternalAPI()` 方法
- [ ] 多源交叉验证逻辑
- [ ] 置信度聚合算法

**2.2-3 缓存优化**
- [ ] 事实验证结果缓存
- [ ] 定期刷新机制

**2.2-4 测试**
- [ ] 单元测试：API 调用
- [ ] 集成测试：真实 API 测试
- [ ] 准确率评估

#### 交付物

- [ ] `packages/core/src/validation/ExternalFactChecker.ts`
- [ ] `packages/core/src/validation/FactChecker.ts` (扩展版)
- [ ] `packages/core/test/external-factcheck.test.ts`

#### 审查清单

**功能验证**:
- [ ] API 调用成功率 > 95%
- [ ] 响应时间 < 3s
- [ ] 缓存命中率 > 40%

**可靠性**:
- [ ] API 失败降级处理
- [ ] 速率限制遵守
- [ ] 错误日志完善

---

## 🟢 P3 阶段: 优化与完善 (1 周)

### P3-1: 增量规划器完善

**负责人**: Agent-Planner
**预估工时**: 3-4 天
**依赖**: 无
**并行**: ❌ 串行

#### 任务拆解

**3.1-1 任务添加逻辑**
- [ ] 实现 `addTask()` 方法
- [ ] 任务依赖验证
- [ ] 资源冲突检测

**3.1-2 依赖关系重新计算**
- [ ] 实现 `recalculateDependencies()` 方法
- [ ] 关键路径更新
- [ ] 影响分析

**3.1-3 测试**
- [ ] 单元测试：各方法功能
- [ ] 集成测试：复杂场景

#### 交付物

- [ ] `packages/core/src/replanning/IncrementalPlanner.ts` (完整版)
- [ ] `packages/core/test/incremental-planner.test.ts`

#### 审查清单

**功能验证**:
- [ ] 任务添加正确性
- [ ] 依赖计算准确性
- [ ] 关键路径更新及时

---

### P3-2: 批处理器优化

**负责人**: Agent-Optimizer
**预估工时**: 2-3 天
**依赖**: 无
**并行**: ❌ 串行

#### 任务拆解

**3.2-1 Token 估算优化**
- [ ] 实现基于模型的 Token 估算
- [ ] 支持不同模型的 Token 计算
- [ ] 动态调整 batch_size

**3.2-2 性能测试**
- [ ] 估算准确率评估
- [ ] 性能基准测试

#### 交付物

- [ ] `packages/core/src/reasoning/ReasoningBatchProcessor.ts` (优化版)
- [ ] `packages/core/test/batch-processor.test.ts`

#### 审查清单

**性能验证**:
- [ ] Token 估算误差 < 10%
- [ ] 批处理性能提升 > 20%

---

## 🧪 测试与审查阶段 (1 周)

### 测试任务清单

**负责人**: Agent-Tester
**并行**: ✅ 与代码审查并行

#### 任务拆解

- [ ] 编写集成测试（端到端场景）
- [ ] 性能基准测试（所有模块）
- [ ] 安全性测试（注入、XSS 等）
- [ ] 压力测试（并发、大数据量）
- [ ] 测试覆盖率提升到 > 85%

#### 交付物

- [ ] `packages/core/test/integration/` 目录
- [ ] 性能基准报告
- [ ] 安全审计报告
- [ ] 测试覆盖率报告

---

### 代码审查任务清单

**负责人**: Agent-Reviewer (code-reviewer)
**并行**: ✅ 与测试并行

#### 审查维度

**代码质量**:
- [ ] TypeScript 严格模式
- [ ] ESLint + Prettier 规范
- [ ] 代码重复率 < 5%
- [ ] 圈复杂度 < 15

**架构一致性**:
- [ ] 遵循五层架构
- [ ] 接口设计一致性
- [ ] 依赖方向正确（单向）

**文档完整性**:
- [ ] 所有公共 API 有 JSDoc
- [ ] 复杂逻辑有注释
- [ ] README 更新

**性能优化**:
- [ ] 无明显性能瓶颈
- [ ] 内存泄漏检测
- [ ] 查询优化（SQL）

#### 交付物

- [ ] 代码审查报告
- [ ] 改进建议清单
- [ ] 性能优化报告

---

## 👥 智能体团队配置

### 团队结构

```
TeamLead (Plan Agent)
    ├── Agent-Embedding (P1-1) - 并行
    ├── Agent-Memory (P1-2) - 并行
    │   └── Agent-EntityExtraction (P1-3) - 串行
    ├── Agent-Auth (P2-1) - 并行
    ├── Agent-FactCheck (P2-2) - 并行
    ├── Agent-Planner (P3-1) - 串行
    ├── Agent-Optimizer (P3-2) - 串行
    ├── Agent-Tester - 并行
    └── Agent-Reviewer - 并行
```

### 执行时序

```
Week 1-2 (P1 阶段):
├── Agent-Embedding    ████████████ (并行)
├── Agent-Memory       ████████████████████ (并行)
└── Agent-Entity       ████████ (串行，依赖 Memory)

Week 3 (P2 阶段):
├── Agent-Auth         ████████████ (并行)
└── Agent-FactCheck    ████████ (并行)

Week 4 (P3 + 测试阶段):
├── Agent-Planner      ████ (串行)
├── Agent-Optimizer    ███ (串行)
├── Agent-Tester       ██████ (并行)
└── Agent-Reviewer     ██████ (并行)
```

---

## 📊 进度跟踪

### 里程碑

- [ ] **M1**: P1 阶段完成（Week 2）
- [ ] **M2**: P2 阶段完成（Week 3）
- [ ] **M3**: P3 阶段完成（Week 4）
- [ ] **M4**: 测试与审查完成（Week 4-5）
- [ ] **M5**: 发布 v0.3.0（Week 5-6）

### 每日站会检查项

- [ ] 昨日完成的任务
- [ ] 今日计划任务
- [ ] 阻塞问题
- [ ] 风险预警

---

## 🎯 验收标准

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

## 📝 附录

### A. 技术栈

- **嵌入模型**: BGE-M3 (1024 维), M3E-base
- **向量数据库**: PostgreSQL + pgvector
- **NLP 工具**: HanLP (中文实体识别)
- **OAuth 库**: openid-client
- **测试框架**: Vitest

### B. 参考文档

- [BGE-M3 模型文档](https://baai.ir/BGE-M3)
- [pgvector 官方文档](https://github.com/pgvector/pgvector)
- [OAuth 2.0 规范](https://oauth.net/2/)
- [HanLP 文档](https://hanlp.hankcs.com/)

### C. 风险管理

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| BGE-M3 API 限流 | 高 | 中 | 实现本地模型备份 |
| PostgreSQL 性能瓶颈 | 中 | 低 | HNSW 索引优化 |
| NLP 抽取准确率低 | 中 | 中 | 人工标注数据集微调 |
| OAuth 提供商变更 | 低 | 低 | 通用接口设计 |

---

**最后更新**: 2026-05-01
**维护者**: TeamLead Agent
**状态**: 🚀 Ready to Start
