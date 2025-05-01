# YunPat 发展路线图

**项目**: YunPat - 知识产权全生命周期智能体平台
**版本**: v0.1.0 (开发中)
**更新时间**: 2026-05-08

---

## 总体时间线

```
2026 Q2                   2026 Q3                   2026 Q4                   2027 Q1
│─────────────────────────│─────────────────────────│─────────────────────────│
  MVP 开发 (75%)            应用层 + 服务层            Beta 测试                  正式发布
```

---

## 当前状态 (2026-05-06)

**实际总体进度：约 77%**

**项目规模**: 20 个顶层包 + 30 个 Agent 子包，489 个 TS 源文件，237 个测试文件，核心包约 63,000 行代码，知识库 4,382 个 Markdown 文件，文档 371 个文件。

### 已完成

- **核心框架 (packages/core)** - 95%
  - Agent 基类（Plan-Execute 完整生命周期）
  - EventBus（53 个测试用例）
  - 五层架构全部实现（Gateway/Reasoning/LLM/Memory/Tools）
  - 推理层增强（幻觉检测/目标分解/Constitutional AI/动态重规划/任务依赖图）
  - Gateway 认证体系（BasicAuth + JWT + Session + WebSocket 审批）
  - ApprovalFlow PromptTemplate 反馈学习
  - EnhancedMemoryStore 长期记忆搜索（倒排索引 + TF 评分）
  - IncrementalPlanner 添加逻辑与关键路径检查
  - 238 个 TS 文件，~63,000 行代码
  - 82 个测试文件

- **智能体编排器 (packages/orchestrator)** - 85%
  - IntentRecognizer：智能意图识别
  - TaskPlanner：动态任务规划
  - HITLManager：人机协作管理
  - ResultAggregator：结果聚合
  - ExceptionHandler：异常降级
  - 与专业层 Agent 集成
  - 17 个源文件

- **知识库集成** - 100%
  - 4,382 个 Markdown 文件
  - ObsidianKnowledgeBridge

- **专业层 Agent 重构（Phase 5）** - 100%
  - PatentWriterAgent - 85%（知识库+模板+Rust桥接，最成熟的智能体）
  - PatentResponderAgentV5 - 100%（集成真实数据库，自动检索先例案例）
  - PatentAnalyzerAgentV2 - 100%（集成真实数据库，自动检索对比专利）
  - PatentSearchAgentV3 - 100%（集成真实数据库，性能提升 20 倍）
  - 统一 Plan-Execute 架构
  - 与 OrchestratorAgent 集成

- **系统集成与部署（Phase 6）** - 100%
  - 性能测试框架
  - Docker 容器化（多阶段构建）
  - 一键部署能力（docker-compose）
  - 监控体系（Prometheus + Grafana，3 个仪表盘，20+ 指标）

- **TUI 与真实 LLM 测试（Phase 7）** - 80%
  - Claude Code 风格终端用户界面（React/Ink）
  - 多模型配置支持
  - 真实 LLM 测试迁移
  - Agent 调用链路打通
  - HITL 闭环验证

- **专利数据库集成** - 100%
  - patent-database 包：双数据源（PatentDB + Google Patents）
  - 7,500 万 CN 专利 + 全球专利
  - PatentSearchAgentV3：集成真实数据库
  - PatentAnalyzerAgentV2：集成真实数据库
  - PatentResponderAgentV5：集成真实数据库

- **提示词模板** - 85%
  - 懒加载策略
  - 支持四大专利 Agent

- **Rust 工具链** - 85%
  - FFI 边界安全加固
  - 空指针验证
  - Rust tools-service 替代 Python

- **代码质量** - 90%
  - 全面修复安全问题、稳定性问题
  - 工具库完整性修复
  - 3 个致命架构问题修复

### 部分完成

- **通用智能体包** - 60-90%
  - MinimumTechUnitAgent（~500 行，五步识别法，9 个测试）
  - invention（1870 行，含术语映射提取）、analysis（1934 行）、quality（887 行）
  - specification（557 行）、image-understanding（526 行）
  - 其余 20+ 专项智能体（20-60%）

- **前端工具**
  - CLI 工具 - 85%（已集成真实智能体，完整工作流可用）
  - MCP 服务器 - 85%（已集成真实智能体，支持规则模式回退）
  - TUI - 80%（React/Ink 终端界面，多模型配置）
  - Skills 系统 - 85%（模块化提示词/技能管理）

### 待完成

- **PatentManagerAgent** - 40%
  - 框架完成，待数据库实现（SQLite -> PostgreSQL）

---

## 短期目标 (2026 Q2: 4-6月)

### Month 1: 修复关键问题 -- 已完成

- [x] Phase 5: 专业层 Agent 重构（2026-05-03）
- [x] Phase 6: 系统集成与部署（2026-05-04）
- [x] Phase 7: TUI + 真实 LLM 测试 + Agent 调用链修复（2026-05-05）
- [x] 修复 Rust 编译错误（FFI 边界加固，空指针验证）
- [x] CLI 工具实现真实逻辑（集成真实智能体）
- [x] MCP 服务器调用真实逻辑（集成真实智能体）
- [x] 通用智能体包核心逻辑实现（invention/analysis/quality/specification）
- [x] 专利数据库 API 集成（PatentDB + Google Patents，7500 万 CN 专利）
- [x] PatentSearchAgentV3：集成真实数据库
- [x] PatentAnalyzerAgentV2：集成真实数据库
- [x] PatentResponderAgentV5：集成真实数据库
- [x] 代码质量全面修复（安全、稳定性、工具库完整性）

### Month 2: 智能体验优化

- [x] 实现 TODO 清单中 8 项未完成功能（Gateway Basic auth, WebSocket approval, PromptTemplate 反馈学习, LangChainAdapter embed, 长期记忆搜索, IncrementalPlanner, 术语映射, 电气符号+OCR）
- [x] 新增 @yunpat/agent-tech-unit 最小技术单元提取智能体
- [ ] PatentWriterAgent 端到端验证
- [ ] TUI 功能完善（实时流式输出、多轮对话历史）
- [ ] 通用智能体包完善（剩余 20+ 专项智能体提升到 50%+）
- [ ] PatentManagerAgent 数据库后端实现（SQLite）
- [ ] 补充 Observability 模块单元测试

### Month 3: MVP 完善

- [ ] 专利检索引擎优化（语义检索 + 关键词检索混合）
- [ ] 文档生成引擎优化（多格式输出：Word/PDF）
- [ ] 性能优化（LLM 批处理、语义缓存命中率提升）
- [ ] 端到端集成测试完善
- [ ] MVP 核心功能可用确认

---

## 中期目标 (2026 Q3: 7-9月)

### 应用层开发

- [ ] 专利撰写应用（前端 + 后端）
- [ ] 审查答复应用
- [ ] 专利分析应用
- [ ] 专利检索应用
- [ ] 客户门户

### 服务层开发

- [ ] gRPC 服务定义与实现
- [ ] 工作流引擎
- [ ] 专利知识库服务
- [ ] 文档管理服务
- [ ] 用户权限服务

---

## 长期目标 (2026 Q4 - 2027 Q1)

### 基础设施

- [x] Docker 容器化（Phase 6 完成）
- [x] 监控系统（Prometheus + Grafana，Phase 6 完成）
- [ ] API 网关（Kong/APISIX）
- [ ] 数据库集群（PostgreSQL + Redis）
- [ ] 消息队列（RabbitMQ/Kafka）
- [ ] 日志系统（ELK）

### Beta 测试 (2026 Q4)

- [ ] 种子用户招募（5-10 家代理所）
- [ ] 集成测试、性能测试、安全测试
- [ ] 问题修复和功能迭代

### 正式发布 (2027 Q1)

- [ ] 最终测试与安全审查
- [ ] 官网上线与市场推广
- [ ] 销售体系建立

---

## 关键指标

### 技术指标

| 指标         | 当前   | MVP 目标 | 正式版目标 |
| ------------ | ------ | -------- | ---------- |
| 测试覆盖率   | 90%    | 95%      | 98%        |
| 测试文件数   | 237    | 300      | 500+       |
| API 响应时间 | <500ms | <500ms   | <200ms     |
| 系统可用性   | 99%    | 99%      | 99.9%      |
| 构建成功率   | 97.0%  | 99.5%    | 99.9%      |

### 业务指标

| 指标     | MVP 目标 | Q1 目标 | Q2 目标 |
| -------- | -------- | ------- | ------- |
| 付费客户 | 5 家     | 20 家   | 50 家   |
| 月收入   | 25,000   | 100,000 | 250,000 |

---

## 里程碑

### 已完成

- [x] 产品定位转型（2026-04-15）
- [x] 五层架构实现（2026-04-25）
- [x] 核心框架完成（2026-04-25）
- [x] 知识库集成（2026-04-28）
- [x] 代码质量优化 - 两轮重构（2026-04-28）
- [x] Athena 资产集成 - patent-core + Prompt 系统（2026-04-29）
- [x] 目录结构重构 - Karpathy 简洁优先（2026-04-29）
- [x] 推理层增强 - 五大核心功能（2026-04-30）
- [x] 核心框架测试大幅提升（2026-05-01）
- [x] 文档整理完成（2026-05-01）
- [x] **Phase 5: 专业层 Agent 重构**（2026-05-03）
- [x] **Phase 6: 系统集成与部署**（2026-05-04）
- [x] **Phase 7: TUI + 真实 LLM 测试 + Agent 调用链修复**（2026-05-05）
- [x] 专利数据库集成 - 7500 万 CN 专利（2026-05-05）
- [x] 通用智能体包核心逻辑实现（2026-05-05）
- [x] CLI/MCP 集成真实智能体（2026-05-05）
- [x] 代码质量全面修复（安全、稳定性、工具库）（2026-05-05）
- [x] **TODO 清单实现（8 项功能）+ MinimumTechUnitAgent 新增**（2026-05-08）

### 计划中

- [ ] PatentWriterAgent 端到端验证（2026-05）
- [ ] PatentManagerAgent 数据库后端（2026-06）
- [ ] MVP 核心功能可用（2026-06）
- [ ] 应用层开发完成（2026-09）
- [ ] Beta 测试开始（2026-10）
- [ ] 正式发布（2027-01）

---

## 版本规划

- **v0.1.0** (当前): 核心框架 + 四大专利 Agent + 专利数据库 + 部署能力
- **v0.2.0** (2026-05): TUI + 真实 LLM 测试 + 端到端验证 + 性能优化
- **v0.3.0** (2026-06): MVP 完成 + PatentManagerAgent + 多格式输出
- **v0.4.0** (2026-07): 应用层开发
- **v0.5.0** (2026-08): 服务层开发
- **v0.6.0** (2026-09): 集成测试 + 优化
- **v1.0.0** (2027-01): 正式发布

---

## 架构演进阶段

| 阶段    | 名称               | 状态   | 关键成果                                     |
| ------- | ------------------ | ------ | -------------------------------------------- |
| Phase 1 | 基础 Agent 框架    | 已完成 | Agent 抽象基类、五层架构                     |
| Phase 2 | 推理层增强         | 已完成 | ReAct/PlanAndSolve/ToT                       |
| Phase 3 | 意图识别与任务规划 | 已完成 | IntentRecognizer、TaskPlanner                |
| Phase 4 | HITL 人机协作      | 已完成 | 检查点、交互式工作流                         |
| Phase 5 | 专业层 Agent 重构  | 已完成 | ProfessionalAgent、四大专利 Agent            |
| Phase 6 | 系统集成与部署     | 已完成 | Docker、监控、性能测试                       |
| Phase 7 | TUI 与真实测试     | 进行中 | TUI、真实 LLM 测试、Agent 链路修复、认证体系 |
| Phase 8 | MVP 完善           | 计划中 | PatentManager、多格式输出、性能优化          |
