# YunPat 变更日志

**项目**: YunPat - 知识产权全生命周期智能体平台
**版本**: v0.1.0 (开发中)

---

## [Unreleased]

### 当前状态 (2026-05-08)

**总体完成度**: ~77%

**项目规模**: 20 个顶层包 + 30 个 Agent 子包，489 个 TS 源文件，237 个测试文件，核心包约 63,000 行代码，知识库 4,382 个 Markdown 文件，文档 371 个文件。

#### 核心框架 (packages/core) - 95% 完成

- Agent 基类：`plan/act/reflect/before/init/after` 完整生命周期（2 个泛型）
- EventBus：发布订阅 + RPC 请求响应（53 个测试用例）
- LLM 适配器：NativeLLMAdapter（DeepSeek/Qwen/Ollama）+ LangChain 兼容层（含 Embedding）
- 推理层：ReActLoop、PlanAndSolveStrategy、TreeOfThoughtsStrategy（100% 完成）
- 幻觉检测与目标分解模块（100% 完成）
- 记忆层：EnhancedMemoryStore（含长期记忆倒排索引搜索）、CheckpointManager、ResumeManager
- 工具层：EnhancedToolRegistry、ToolSelectionOptimizer、中间件管道
- 知识库：KnowledgeBase、KnowledgeCard、CardPipeline，ObsidianKnowledgeBridge（100% 完成）
- 可观测性：TelemetryCollector、告警
- 结果验证：ResultValidator 与修正策略
- 成本优化：SemanticCache、TaskRouter、AdaptiveTemperatureController、BatchProcessor
- Gateway 认证：BasicAuthProvider（salt+SHA256）、JWT Token、Session 管理（95% 完成）
- WebSocket 审批服务器：原生 WebSocket 协议，支持 CLI/HTTP/WS 三种审批模式（90% 完成）
- ApprovalFlow：集成 PromptTemplate 反馈学习，自动分析修正模式
- 238 个源文件，82 个测试文件，356+ 导出模块

#### 编排器 (packages/orchestrator) - 85% 完成

- 17 个源文件
- 意图识别（Intent Recognition）
- 任务规划与路由（Planning/Routing）
- 异常处理（Exception Handling）

#### 监控系统 - 100% 完成

- Prometheus + Grafana 集成
- 3 个预配置仪表盘
- 20+ 监控指标

#### Docker 部署 - 90% 完成

- 完整容器化方案
- docker-compose 编排

#### Rust 工具链 - 85% 完成

- FFI 边界加固
- 空指针验证
- tools-service 替代 Python 实现

#### 专利智能体 - 完成度详列

- **PatentSearchAgentV3** (100%)：真实数据库集成，双数据源（PatentDB + Google Patents），覆盖 7500 万中国专利
- **PatentAnalyzerAgentV2** (100%)：4 个分析方法（价值/趋势/竞品/全景），真实数据库集成
- **PatentResponderAgentV5** (100%)：OA 分析 + 答复书生成，真实数据库集成
- **PatentWriterAgent** (85%)：知识库 + 模板 + Rust 桥接层集成，权利要求/说明书/摘要生成，7 维质量评估
- **MinimumTechUnitAgent** (90%)：最小技术单元提取，五步识别法，支持 6 种专利场景，9 个测试通过
- **PatentManagerAgent** (40%)：框架完成，待实现数据库后端
- **专利数据库** (100%)：双数据源（PatentDB + Google Patents），7500 万中国专利
- **发明理解智能体** (80%)：术语映射提取（括号标注、中英对应、箭头映射等）
- **技术图纸智能体** (60%)：电气符号识别（15 种符号），OCR 文字提取

#### 工具包

- `@yunpat/patent-tools`：专利专用工具集
- `@yunpat/builtin-tools`：文件/搜索/网络/浏览器工具
- `@yunpat/document-tools`：PDF/DOCX/Excel/OCR/音频/PPTX 工具
- `@yunpat/grpc-server`：gRPC 服务器

#### 前端与接口

- **CLI 工具** (85%)：真实 Agent 集成
- **MCP 服务器** (85%)：真实 Agent 集成
- **TUI 终端界面** (80%)：Claude Code 风格，React/Ink 实现，多模型配置
- **Prompt 模板** (85%)：懒加载策略

#### 文档与测试

- **文档** (95%)：371 个文档文件
- **测试覆盖** (90%)：236 个测试文件，迁移到真实 LLM 测试

---

## 已完成里程碑

### TODO 清单实现与智能体增强 (2026-05-08)

- feat: 实现 Gateway Basic 认证（BasicAuthProvider，salt+SHA256 安全存储）
- feat: 实现 WebSocket 审批服务器（原生 WebSocket 协议，CLI/HTTP/WS 三种模式）
- feat: 实现 ApprovalFlow PromptTemplate 反馈学习（自动分析修正模式，模板版本更新）
- feat: 实现 LangChainAdapter embed 方法（OpenAIEmbeddings 集成）
- feat: 实现 EnhancedMemoryStore 长期记忆搜索（倒排索引 + TF 评分 + 模糊匹配）
- feat: 实现 IncrementalPlanner 添加逻辑与关键路径检查
- feat: 实现 InventionAgent 术语映射提取（多模式正则匹配）
- feat: 实现 TechnicalDrawingAgent 电气符号识别与 OCR
- feat: 新增 @yunpat/agent-tech-unit 最小技术单元提取智能体（五步识别法，6 种场景，9 个测试）
- fix: 修复 BasicAuthProvider 和 IncrementalPlanner 类型错误

### 架构演进 - 第七阶段：TUI 与真实 LLM 测试 (2026-05)

- 添加 Claude Code 风格 TUI 终端界面（React/Ink）
- TUI 启动支持和多模型配置
- 迁移到真实 LLM 测试
- 添加 TUI 实现文档和 HITL 测试
- 打通 Agent 调用链路和 HITL 闭环，修复三个致命架构问题
- 修复 IncrementalPlanner 测试
- 修复 3 个既有 flaky test 断言过于严格的问题

### 架构演进 - 第六阶段：系统集成与部署 (2026-05)

- Docker 容器化方案完成
- Prometheus + Grafana 监控系统（3 仪表盘，20+ 指标）
- 真实 LLM 测试基础设施
- CI/CD 修复：构建顺序、依赖缺失、source map、exports 字段

### 架构演进 - 第五阶段：专业 Agent 重构 (2026-05)

- ProfessionalAgent 基类抽取
- 4 个专利智能体重构（Search/Analyzer/Responder/Writer）
- 真实专利数据库 API 集成（PatentDB + Google Patents）
- Rust tools-service 替代 Python 实现
- 全面修复工具库完整性问题

### 架构演进 - 第四阶段：HITL 人机协作 (2026-05)

- Human-in-the-Loop（HITL）框架实现
- Agent 调用链路打通
- HITL 闭环验证

### 架构演进 - 第三阶段：意图识别与任务规划 (2026-05)

- IntentRouter 意图路由
- IncrementalPlanner 增量规划
- 任务依赖图管理

### 架构演进 - 第二阶段：推理层增强 (2026-04)

- ReAct 推理循环
- PlanAndSolve 策略
- TreeOfThoughts 思维树
- 幻觉检测模块
- 目标分解模块

### 代码质量修复 (2026-05)

- 全面修复代码质量问题（安全、稳定性、代码质量）
- 修复知识图谱包构建缺失
- 添加 React/Ink 依赖到 esbuild external 列表
- 归档过时的 test/ 目录到 \_archive/

### Athena 资产集成 (2026-04-29)

- patent-core 算法库集成（IPC 分类、质量评估、特征提取、OA 解析）
- Prompt 模板系统（1821 行模板代码，懒加载策略）
- PatentCoreBridge（TypeScript -> Rust 桥接层）

### OpenClaw 资产引入 (2026-04-29)

- 完整专利智能体工具集
- 核心工具系统增强

### 目录结构重构 (2026-04-29)

- 删除空目录（apps/、services/、infrastructure/），一级目录从 19 减少到 11（降 42%）
- 合并重复目录：prompts/ -> patents/prompts/templates/
- 重命名：ai/ -> patents/（专利专用业务逻辑）
- 统一多语言代码：rust/ -> packages/rust-tools/，yunpat_python/ -> packages/python-tools/

### 代码质量优化 - 第二轮 (2026-04-28)

- ESLint + Prettier 配置，修复所有 ESLint 错误
- Agent 基类简化：5 个泛型 -> 2 个泛型
- 合并重复代码：删除 EnhancedPatentWriterAgent.ts（426 行）
- EventBus Bug 修复 + 53 个测试用例
- CI/CD：GitHub Actions（Node 18/20 矩阵，测试+类型检查+构建）

### 代码清理 - 第一轮 (2026-04-28)

- 删除过度设计模块（约 3,118 行）：ModelVoting、PromptOptimizer、ResilientLLMAdapter、TransactionManager
- 清理硬编码 Mock 数据（12 个函数）

### 架构演进 - 第一阶段：基础 Agent 框架 (2026-04-25)

- YunPat AI 智能体框架初始化
- 五层架构实现
- Agent 基类完整生命周期
- Wiki 卡片知识库（1139 个文件）

---

## 下一步计划

### 短期（P0）

- [ ] PatentManagerAgent 数据库后端实现（当前 40%）
- [ ] TUI 功能完善（当前 80%）
- [ ] PatentWriterAgent 端到端验证（当前 85%）
- [ ] 生产级部署配置

### 中期（P1）

- [ ] Agent 子包全部达到 85%+ 完成度
- [ ] 测试覆盖率提升到 95%
- [ ] 性能优化与压力测试
- [ ] 安全审计

### 长期（P2）

- [ ] 应用层开发
- [ ] 服务层开发
- [ ] Beta 测试
- [ ] v1.0.0 发布

---

## 版本对比

### v0.1.0 (当前)

- 定位：知识产权全生命周期智能体平台（开发中）
- 完成度：约 77%
- 核心可用：框架层 + 知识库 + 3 个完整专利智能体 + 监控 + Docker
- 代码规模：489 源文件，237 测试文件，约 63,000 行核心代码

### v1.0.0 (目标)

- 完成度：100%（MVP）
- 所有智能体可用
- TUI/CLI/MCP 真实逻辑
- 生产级部署与监控
- 测试覆盖率 95%+
