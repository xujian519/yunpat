# YunPat 项目结构

**版本**: v0.1.0 (开发中)
**更新时间**: 2026-05-08
**重要更新**: 新增 MinimumTechUnitAgent 智能体，完成 Gateway 认证体系和 WebSocket 审批服务器，实现 TODO 清单 8 项功能

---

## 完整目录结构

```
yunpat/
│
├── packages/                          # 核心框架与通用包（pnpm workspace）
│   ├── core/                          # 核心框架（95%完成）
│   │   └── src/
│   │       ├── agent/                 # Agent抽象基类（Plan-Execute架构）
│   │       ├── gateway/               # 交互层（多模态、HITL、安全网关）
│   │       ├── reasoning/             # 推理层（ReAct/PlanAndSolve/ToT）
│   │       ├── llm/                   # LLM适配器（DeepSeek/Qwen/Ollama）
│   │       ├── memory/                # 记忆层（检查点、时间旅行）
│   │       ├── tools/                 # 工具层（注册表、中间件）
│   │       ├── eventbus/              # 事件总线（53个测试用例）
│   │       ├── knowledge/             # 知识库系统
│   │       ├── validation/            # 结果验证与修正
│   │       ├── observability/         # 可观测性（遥测、告警）
│   │       └── config/                # 配置管理
│   │
│   ├── orchestrator/                  # 智能体编排器（80%完成）
│   │   └── src/
│   │       ├── OrchestratorAgent.ts   # 核心编排Agent
│   │       ├── intent/                # 意图识别
│   │       ├── planning/              # 任务规划
│   │       ├── routing/               # 智能路由
│   │       └── exception/             # 异常处理
│   │
│   ├── orchestrator-adapter/          # Rust网关与Node.js桥接层（4个源文件）
│   │   └── src/                       # Rust gateway <-> Node.js 通信适配
│   │
│   ├── tui/                           # Claude Code风格TUI界面（17个源文件）
│   │   └── src/                       # React/Ink终端界面，交互式工作流
│   │
│   ├── skills/                        # 模块化技能管理系统（20个源文件）
│   │   └── src/                       # 可插拔技能注册与执行框架
│   │
│   ├── agents/                        # 专业智能体集合（25个子包）
│   │   │
│   │   ├── -- 基础设施层（2个） --
│   │   ├── base/                      # Agent基类和接口定义
│   │   └── integration-tests/         # 集成测试框架
│   │   │
│   │   ├── -- 内容生成类（9个） --
│   │   ├── writer/                    # 通用写作助手（60%，911行）
│   │   ├── researcher/                # 研究分析助手（40%，409行）
│   │   ├── invention/                 # 发明理解智能体（80%，1972行，含测试）
│   │   ├── analysis/                  # 专利分析智能体（75%，1932行，含测试）
│   │   ├── patent-responder/          # 专利答复智能体（V5，真实DB，95%，8383行）
│   │   ├── patent-analyzer/           # 专利分析智能体（V2，真实DB，90%，5415行）
│   │   ├── abstract-drafter/          # 摘要起草智能体（45%，340行）
│   │   ├── specification-drafter/     # 说明书起草智能体（70%，1802行，含测试）
│   │   ├── claim-generator/           # 权利要求生成器（60%，689行，含测试）
│   │   └── comparison-report-generator/ # 对比报告生成器（60%，680行，含测试）
│   │   │
│   │   ├── -- 检查验证类（5个） --
│   │   ├── quality/                   # 质量评估智能体（70%，980行，含测试）
│   │   ├── quality-checker/           # 质量检查智能体（75%，1597行，含测试）
│   │   ├── spec-formality-checker/    # 说明书格式检查（70%，632行，含测试）
│   │   ├── subject-matter-checker/    # 主题检查智能体（70%，697行，含测试）
│   │   └── unity-checker/             # 一致性检查智能体（70%，687行，含测试）
│   │   │
│   │   ├── -- 检索管理类（3个） --
│   │   ├── search/                    # 通用检索智能体（V3，真实DB，95%，1714行）
│   │   ├── prior-art-search/          # 先前技术检索（60%，762行，含测试）
│   │   └── patent-manager/            # 专利管理智能体（70%，3277行，含DB+状态机）
│   │   │
│   │   ├── -- 技术工具类（4个） --
│   │   ├── tech-unit/                 # 最小技术单元提取（90%，~500行，五步识别法，9个测试）
│   │   ├── technical-drawing/         # 技术图纸识别（60%，含电气符号+OCR）
│   │   ├── format-converter/          # 格式转换工具（55%，472行，含测试）
│   │   └── image-understanding/       # 图像理解智能体（65%，530行，含测试）
│   │   │
│   │   └── -- 测试工具（1个） --
│   │       └── test/                  # 工作流测试工具（50%）
│   │
│   ├── patent-tools/                  # 专利专用工具（80%完成，2732行，7个测试）
│   ├── builtin-tools/                 # 内置基础工具（75%完成，4024行，7个测试）
│   ├── document-tools/                # 文档解析工具（80%完成，5245行，12个测试）
│   ├── grpc-server/                   # gRPC服务器（60%完成，427行）
│   │
│   ├── patent-core/                   # Rust CLI + TS桥接（559行）
│   ├── patent-database/               # 专利数据库适配器（75%完成，1245行）
│   ├── patent-knowledge/              # 知识库桥接（75%完成，747行）
│   ├── patent-prompts/                # Prompt模板（85%完成，270行）
│   ├── unified-knowledge-graph/       # 统一知识图谱（75%完成，2186行）
│   ├── image-tools/                   # 图像处理工具集（240行）
│   ├── mcp-server/                    # MCP工具服务器（75%完成，1478行，4个测试）
│   │
│   ├── rust-tools/                    # Rust网关二进制（工具服务）
│   │   ├── tools-service/             # 工具服务
│   │   ├── vector-service/            # 向量服务
│   │   ├── yunpat-similarity/         # 相似度计算
│   │   └── yunpat-tokenizer/          # 分词器
│   │
│   ├── python-tools/                  # Python ML服务
│   │   ├── tools_server.py            # gRPC工具服务端
│   │   └── official_doc_parser.py     # 官方文档解析器
│   │
│   └── cli/                           # 命令行工具
│       └── patent-cli/                # 独立CLI工具（30%）
│
├── knowledge-base/                    # 专利知识库（100%）
│   └── 4,382+ Markdown文件            # 专利知识文档
│
├── services/                          # 独立微服务
│   ├── chemical-structure-service/    # 化学结构识别服务
│   ├── math-formula-service/          # 数学公式解析服务
│   └── patent-download-service/       # 专利文档下载服务
│
├── test/                              # 测试框架（Phase 6新增）
│   ├── integration/                   # 端到端集成测试
│   ├── performance/                   # 性能基准测试
│   └── mocks/                         # Mock测试工具
│
├── docker/                            # Docker配置（Phase 6新增）
│   ├── entrypoint.sh                  # 容器入口脚本
│   ├── grafana/                       # Grafana仪表盘配置
│   ├── prometheus/                    # Prometheus监控配置
│   └── python-tools/                  # Python服务容器配置
│
├── docs/                              # 项目文档（371个文件）
│   ├── architecture/                  # 架构文档
│   ├── guides/                        # 开发指南
│   ├── plans/                         # 实施计划
│   ├── reports/                       # 完成报告
│   ├── analysis/                      # 分析文档
│   ├── testing/                       # 测试文档
│   ├── ci/                            # CI/CD 文档
│   ├── cicd/                          # CI/CD 流水线配置
│   ├── deployment/                    # 部署文档
│   ├── designs/                       # 设计文档
│   ├── knowledge/                     # 知识库文档
│   ├── agents/                        # Agent 文档
│   ├── api/                           # API 文档
│   ├── metrics/                       # 指标文档
│   ├── quality/                       # 质量文档
│   ├── reviews/                       # 代码审查文档
│   ├── progress/                      # 进度文档
│   ├── history/                       # 历史记录
│   ├── summaries/                     # 摘要文档
│   ├── tools/                         # 工具文档
│   ├── meta/                          # 元文档
│   ├── archive/                       # 归档文档
│   └── PROJECT_STRUCTURE.md           # 本文档
│
├── examples/                          # 使用示例（40个文件，16个分类）
│   ├── basic/                         # 基础示例
│   ├── agents/                        # Agent 示例
│   ├── architecture/                  # 架构示例
│   ├── production/                    # 生产示例
│   ├── optimization/                  # 优化示例
│   ├── knowledge/                     # 知识库示例
│   ├── reasoning/                     # 推理示例
│   ├── monitoring/                    # 监控示例
│   ├── patents/                       # 专利示例
│   ├── style/                         # 风格示例
│   ├── mcp/                           # MCP 示例
│   ├── glm/                           # GLM 示例
│   ├── testing/                       # 测试示例
│   ├── data/                          # 数据示例
│   ├── guides/                        # 指南文档
│   └── README.md                      # 示例总览
│
├── scripts/                           # 维护脚本（76个文件，按功能分类）
│   ├── ci/                            # CI/CD 脚本
│   ├── build/                         # 构建脚本
│   ├── deploy/                        # 部署脚本
│   ├── test/                          # 测试脚本
│   ├── check/                         # 检查脚本
│   ├── generate/                      # 生成脚本
│   ├── monitoring/                    # 监控脚本
│   ├── cleanup/                       # 清理脚本
│   ├── legacy/                        # 遗留脚本
│   ├── dev-start.sh                   # 开发环境启动
│   ├── dev-stop.sh                    # 开发环境停止
│   ├── dev-watch.sh                   # 开发热重载
│   └── start-tui.sh                   # TUI启动脚本
│
└── 配置文件
    ├── package.json                   # 根package.json
    ├── pnpm-workspace.yaml            # Monorepo配置
    ├── tsconfig.base.json             # TypeScript配置
    └── .gitignore                     # Git忽略文件
```

---

## 架构演进历程

### Phase 1: 基础Agent框架（已完成）

- 实现Agent抽象基类
- 建立五层架构（Gateway/Reasoning/LLM/Memory/Tools）

### Phase 2: 推理层增强（已完成）

- ReAct循环推理
- PlanAndSolve策略
- 思维树ToT

### Phase 3: 意图识别与任务规划（已完成）

- IntentRecognizer：智能意图识别
- TaskPlanner：动态任务规划
- 智能路由系统

### Phase 4: HITL人机协作（已完成）

- Human-in-the-Loop机制
- 检查点管理
- 交互式工作流

### Phase 5: 专业层Agent重构（已完成）

- 统一Plan-Execute架构
- ProfessionalAgent基类
- 四大专利Agent重构（Writer/Responder/Analyzer/Search）
- 与OrchestratorAgent集成

### Phase 6: 系统集成与部署（已完成）

- 性能测试框架
- Docker容器化
- 一键部署能力
- 监控体系
- Rust工具链替代Python工具

### Phase 7: TUI与真实集成（进行中）

- Claude Code风格TUI界面（React/Ink）
- 真实LLM调用测试
- Agent调用链修复
- 编排器适配层（Rust网关桥接）

---

## 核心包说明

### packages/core（核心框架）

**完成度**: 95%

**包含模块**:

- `agent/`: Agent抽象基类（Plan-Execute架构）
- `gateway/`: 交互层（多模态、HITL、安全网关、BasicAuth + WebSocket 审批）
- `reasoning/`: 推理层（ReAct/PlanAndSolve/ToT/幻觉检测/目标分解）
- `llm/`: LLM适配器（DeepSeek/Qwen/Ollama/语义缓存）
- `memory/`: 记忆层（检查点、时间旅行）
- `tools/`: 工具层（注册表、中间件、选择优化）
- `eventbus/`: 事件总线（53个测试用例）
- `knowledge/`: 知识库系统
- `validation/`: 结果验证与修正
- `observability/`: 可观测性（遥测、告警）

**技术特点**:

- 238个TS源文件，~63,000行代码
- 82个测试文件（总计310个TS文件）
- 100% TypeScript严格模式
- 测试覆盖：1586/1632测试通过（97.2%）

### packages/orchestrator（智能体编排器）

**完成度**: 85%

**核心功能**:

- 意图识别（Call 1）
- 任务规划（Call 2）
- HITL生成（Call 3）
- 结果聚合（Call 4）
- 异常降级（Call 5）

**技术特点**:

- 22个TS源文件，6106行代码
- 15个测试文件
- 完整的5次LLM调用流程
- 与专业层Agent集成
- 性能监控与智能路由

### packages/orchestrator-adapter（编排器适配层）

**完成度**: 70%

**核心功能**:

- Rust网关与Node.js桥接
- 4个TS源文件，836行代码
- 实现Rust工具服务与Node.js编排器的通信

### packages/tui（终端用户界面）

**完成度**: 65%

**核心功能**:

- Claude Code风格终端界面
- React/Ink + Zustand技术栈
- 17个TS/TSX源文件，2288行代码
- 交互式工作流与Agent状态展示

### packages/skills（技能管理系统）

**完成度**: 70%

**核心功能**:

- 模块化技能注册与执行
- 20个TS源文件，2789行代码
- 可插拔架构，支持动态加载

### packages/agents（通用智能体）

**包含智能体**（25个子包）:

**已完成（≥90%）**:

- `patent-analyzer`: 专利分析智能体（V2，真实DB，90%，5415行）
- `patent-responder`: 专利答复智能体（V5，真实DB，95%，8383行）
- `search`: 通用检索智能体（V3，真实DB，95%，1714行）
- `tech-unit`: 最小技术单元提取智能体（90%，~500行，五步识别法，9个测试）
- `invention`: 发明理解智能体（80%，1972行）
- `analysis`: 技术分析智能体（75%，1932行）

**进行中（50-80%）**:

- `patent-manager`: 专利管理智能体（70%，3277行，含DB+状态机+通知）
- `quality-checker`: 质量检查智能体（75%，1597行）
- `quality`: 质量评估智能体（70%，980行）
- `specification-drafter`: 说明书起草智能体（70%，1802行）
- `spec-formality-checker`: 说明书格式检查（70%，632行）
- `subject-matter-checker`: 主题检查智能体（70%，697行）
- `unity-checker`: 一致性检查智能体（70%，687行）
- `prior-art-search`: 先前技术检索（60%，762行）
- `image-understanding`: 图像理解智能体（65%，530行）
- `technical-drawing`: 技术图纸识别（60%，含电气符号识别+OCR）
- `format-converter`: 格式转换工具（55%，472行）
- `writer`: 技术写作助手（60%，911行）
- `researcher`: 研究分析师（40%，409行）
- `claim-generator`: 权利要求生成器（60%，689行）
- `comparison-report-generator`: 对比报告生成器（60%，680行）
- `abstract-drafter`: 摘要起草智能体

### packages/rust-tools（Rust工具服务，新增）

**完成度**: 60%

Rust原生工具服务，替代Python工具链:

- `tools-service`: 核心工具服务
- `vector-service`: 向量计算服务
- `yunpat-similarity`: 相似度计算
- `yunpat-tokenizer`: 中文分词器

### packages/python-tools（Python ML服务，新增）

**完成度**: 40%

- gRPC工具服务端
- 官方文档解析器
- Protocol Buffers定义

---

## 专利业务层

### packages/agents 下的专利智能体

**三大核心专利Agent（已完成）**:

- `patent-analyzer`: 专利分析（V2，真实DB，100%，14个源文件）
- `patent-responder`: 审查答复（V5，真实DB，100%，18个源文件）
- `search`（V3，真实DB，100%，5个源文件）

**进行中的专利Agent**:

- `claim-generator`: 权利要求生成器
- `specification-drafter`: 说明书起草智能体

### packages/patent-prompts（提示词模板系统）

**完成度**: 85%

- 懒加载策略
- 支持专利Agent

### packages/patent-knowledge（知识库集成）

**完成度**: 75%

- ObsidianKnowledgeBridge
- 4,382+ Markdown文件
- 专利知识库完整集成

### packages/patent-database（专利数据库，新增）

**完成度**: 70%

- PatentDatabaseAdapter
- 5个TS源文件
- 真实数据库持久化

### packages/unified-knowledge-graph（统一知识图谱，新增）

**完成度**: 60%

- PostgreSQLClient
- PostgreSQLFirstKnowledgeGraph
- 7个TS源文件
- 统一知识检索接口

---

## 测试框架（Phase 6新增）

**完成度**: 85%

**测试覆盖**:

- 193个测试文件（跨所有packages）
- 1586/1632测试通过（97.2%通过率）
- 代码覆盖率~85%

**测试类型**:

- 单元测试：所有核心模块
- 集成测试：端到端工作流
- 性能测试：基准测试框架
- Mock测试：MockLLMClient

**测试工具**:

- Vitest：测试运行器
- MockLLMClient：LLM Mock机制
- IntegrationTestHelper：测试辅助工具

---

## 部署体系（Phase 6完成）

**完成度**: 80%

**Docker支持**:

- 多阶段构建（优化镜像大小）
- 服务编排（docker-compose）
- 健康检查机制
- 自动重启策略
- Grafana/Prometheus监控集成

**编排服务**:

- OrchestratorAgent
- 专利专业Agent集群
- Redis（缓存）
- PostgreSQL（数据库）
- Prometheus（监控）
- Grafana（可视化）

**独立服务**（services/目录）:

- `chemical-structure-service`: 化学结构识别
- `math-formula-service`: 数学公式解析
- `patent-download-service`: 专利文档下载

**部署工具**:

- `scripts/deploy.sh`: 一键部署脚本
- `scripts/dev-start.sh`: 开发环境启动
- `scripts/start-tui.sh`: TUI启动
- 完整的部署文档

---

## 项目规模统计

| 指标                       | 数值                        |
| -------------------------- | --------------------------- |
| 知识库文件                 | 4,382                       |
| packages/core 源文件       | 237                         |
| packages/core 代码行数     | ~62,084                     |
| 全部 TS 源文件（packages） | 744                         |
| 全部测试文件               | 546                         |
| Agent 子包数量             | 25                          |
| 全部代码行数               | ~161,487                    |
| 文档文件                   | 371                         |
| 示例文件                   | 40（16个分类）              |
| 脚本文件                   | 76                          |
| CI/CD Workflows            | 16                          |
| 服务组件                   | 3（chemical/math/download） |

---

## 当前开发进度

### 已完成

- 核心框架（packages/core）- 95%
  - Gateway 认证体系（BasicAuth + JWT + Session）- 95%
  - WebSocket 审批服务器 - 90%
  - ApprovalFlow PromptTemplate 反馈学习 - 85%
  - LangChainAdapter Embedding 集成 - 90%
  - EnhancedMemoryStore 长期记忆搜索 - 85%
  - IncrementalPlanner 添加逻辑与关键路径 - 85%
- 推理层增强 - 100%
- 意图识别与任务规划 - 100%
- HITL人机协作 - 100%
- 专业层Agent重构（Phase 5）- 100%
- 系统集成与部署（Phase 6）- 100%
- 知识库集成 - 100%
- 编排器（packages/orchestrator）- 85%
- patent-analyzer（V2，真实DB）- 90%
- patent-responder（V5，真实DB）- 95%
- search（V3，真实DB）- 95%
- patent-writer - 85%
- MinimumTechUnitAgent（最小技术单元提取）- 90%
- invention（发明理解）- 80%
- patent-manager（专利管理）- 70%
- 所有检查验证类Agent - 70%
- 测试框架 - 90%（546个测试文件）
- Docker容器化与部署 - 80%
- CI/CD流水线 - 80%（16个workflow文件）

### 进行中

- TUI终端界面实现 - 65%
- MCP服务器 - 75%
- orchestrator-adapter适配层 - 70%
- Rust工具链完善 - 60%
- 通用智能体深度优化（writer/researcher/abstract-drafter）

### 待完成

- CLI高级功能完善（配置管理、日志系统）
- RBAC权限系统
- 可视化报告生成
- Python ML服务完善
- Beta测试准备

---

## 下一步工作

### 立即可做

1. **完善通用智能体深度优化**
   - writer/researcher/abstract-drafter 提升至 70%+
   - MinimumTechUnitAgent 深度优化
   - 补充缺失的测试文件

2. **CLI 高级功能完善**
   - 配置文件管理
   - 进度显示和日志系统
   - 错误处理统一

3. **RBAC 权限系统**
   - 基于已有认证框架扩展角色权限

### 短期目标（1个月）

4. **可视化报告生成**
   - PatentAnalyzerAgent 趋势预测和图表
5. **TUI 高级功能**
   - 文件上传、结果导出
6. **完善测试覆盖率（目标95%）**

### 中期目标（3-6个月）

7. **应用层开发**
8. **服务层开发**
9. **集成测试与优化**
10. **Beta测试准备**

---

**2026 YunPat - 智能专利助手，赋能创新保护**
