# YunPat 变更日志

**项目**: YunPat - 知识产权全生命周期智能体平台
**版本**: v0.1.0 (开发中)

---

## [Unreleased]

### 当前状态 (2026-04-30)

**总体完成度**: ~30%（基于实际代码审计）

#### 核心框架 (packages/core) - ~85% 完成

- Agent 基类：`plan/act/reflect/before/init/after` 完整生命周期（2 个泛型）
- EventBus：发布订阅 + RPC 请求响应（53 个测试用例）
- LLM 适配器：NativeLLMAdapter（DeepSeek/Qwen/Ollama）+ LangChain 兼容层
- 推理层：ReActLoop、PlanAndSolveStrategy、TreeOfThoughtsStrategy
- 记忆层：EnhancedMemoryStore、CheckpointManager、ResumeManager
- 工具层：EnhancedToolRegistry、ToolSelectionOptimizer、中间件管道
- 知识库：KnowledgeBase、KnowledgeCard、CardPipeline
- 可观测性：TelemetryCollector、告警
- 结果验证：ResultValidator 与修正策略
- 成本优化：SemanticCache、TaskRouter、AdaptiveTemperatureController、BatchProcessor
- 356+ 导出模块

#### 专利智能体 - 完成度不等

- **PatentWriterAgent** (~80%)：集成 ObsidianKnowledgeBridge + PromptTemplateManager + PatentCoreBridge，权利要求/说明书/摘要生成，7 维质量评估
- **PatentResponderAgent** (~50%)：OA 分析 + patent-core 策略推荐 + 答复书生成，缺真实先验检索
- **PatentAnalyzerAgent** (~50%)：4 个分析方法（价值/趋势/竞品/全景），返回 LLM 生成数据
- **PatentManagerAgent** (~20%)：骨架代码，无数据库后端

#### 工具包

- `@yunpat/patent-tools` (~70%)：5 个专利工具
- `@yunpat/builtin-tools` (~60%)：文件/搜索/网络/浏览器工具
- `@yunpat/document-tools` (~75%)：PDF/DOCX/Excel/OCR/音频/PPTX 工具
- `@yunpat/grpc-server` (~50%)：gRPC 服务器

#### 待修复问题

- Rust 工具链：25 个编译错误，无法构建
- CLI 工具：所有方法返回 TODO
- MCP 服务器：4 个工具返回硬编码数据
- 测试覆盖：仅 EventBus 有可靠测试（~5%）

---

## 已完成里程碑

### 目录结构重构 (2026-04-29)

- 删除空目录（apps/、services/、infrastructure/），一级目录从 19 减少到 11（↓42%）
- 合并重复目录：prompts/ → patents/prompts/templates/
- 重命名：ai/ → patents/（专利专用业务逻辑）
- 统一多语言代码：rust/ → packages/rust-tools/，yunpat_python/ → packages/python-tools/

### 代码质量优化 - 第二轮 (2026-04-28)

- ESLint + Prettier 配置，修复所有 ESLint 错误
- Agent 基类简化：5 个泛型 → 2 个泛型
- 合并重复代码：删除 EnhancedPatentWriterAgent.ts（426 行）
- EventBus Bug 修复 + 53 个测试用例
- CI/CD：GitHub Actions（Node 18/20 矩阵，测试+类型检查+构建）

### 代码清理 - 第一轮 (2026-04-28)

- 删除过度设计模块（~3,118 行）：ModelVoting、PromptOptimizer、ResilientLLMAdapter、TransactionManager
- 清理硬编码 Mock 数据（12 个函数）

### Athena 资产集成 (2026-04-29)

- patent-core 算法库集成（IPC 分类、质量评估、特征提取、OA 解析）
- Prompt 模板系统（1821 行模板代码，懒加载策略）
- PatentCoreBridge（TypeScript → Rust 桥接层）

### OpenClaw 资产引入 (2026-04-29)

- 完整专利智能体工具集
- 核心工具系统增强

### 框架初始化 (2026-04-25)

- YunPat AI 智能体框架初始化
- 五层架构实现
- Wiki 卡片知识库（1139 个文件）

---

## 下一步计划

### 短期（P0）

- [ ] 修复 Rust 编译错误（25 个）
- [ ] 实现 CLI 工具的真实逻辑
- [ ] MCP 服务器调用真实逻辑
- [ ] PatentWriterAgent 端到端验证

### 中期（P1）

- [ ] 实现其余 3 个智能体的核心逻辑
- [ ] 补充测试覆盖率（目标 40%）
- [ ] 真实专利数据库 API 集成
- [ ] 生产级 MCP 服务器

### 长期（P2）

- [ ] 应用层开发
- [ ] 服务层开发
- [ ] 基础设施搭建
- [ ] Beta 测试

---

## 版本对比

### v0.1.0 (当前)

- 定位：知识产权全生命周期智能体平台（开发中）
- 完成度：~30%
- 核心可用：框架层 + PatentWriterAgent + 知识库

### v1.0.0 (目标)

- 完成度：100%（MVP）
- 所有智能体可用
- CLI/MCP 真实逻辑
- 测试覆盖率 70%+
