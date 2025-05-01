# YunPat 目录结构整理方案

**创建时间**: 2026-05-05
**状态**: 待执行
**目标**: 使项目结构更清晰、可视化好、有利于长期发展

---

## 一、问题诊断

### 1.1 根目录问题

| 问题     | 严重程度 | 描述                                                       |
| -------- | -------- | ---------------------------------------------------------- |
| 文件过多 | 高       | 根目录有 20+ 个文档文件，影响可读性                        |
| 配置重复 | 中       | `drizzle.config.js` 和 `drizzle.config.ts` 重复            |
| 临时文件 | 中       | `.tsbuildinfo`, `performance-baseline.json` 应移到适当位置 |
| 过时文档 | 中       | 多个完成报告应归档到 `docs/reports/`                       |

### 1.2 子目录问题

| 目录               | 问题                                | 严重程度 |
| ------------------ | ----------------------------------- | -------- |
| `docs/`            | 文件过多（100+），子目录组织不清晰  | 高       |
| `examples/`        | 文件过多（40+），缺少分类           | 中       |
| `scripts/`         | 文件过多（60+），缺少分类           | 中       |
| `cli/`             | 只有一个子目录，结构扁平            | 低       |
| `data/`            | 包含运行时数据，应考虑 `.gitignore` | 中       |
| `packages/agents/` | 25+ 个子目录，缺少分组              | 高       |

---

## 二、目标目录结构

### 2.1 根目录（精简版）

```
yunpat/
├── .github/                   # GitHub 配置
├── .husky/                    # Git hooks
├── packages/                  # 核心代码包
├── cli/                       # CLI 入口
├── docs/                      # 项目文档
├── examples/                  # 使用示例
├── scripts/                   # 维护脚本
├── test/                      # 测试套件
├── knowledge-base/            # 专利知识库
├── docker/                    # Docker 配置
├── config/                    # 配置文件
├── services/                  # 微服务
├── protos/                    # Protobuf 定义
├── .gitignore
├── .env.example
├── .prettierrc.json
├── .eslintrc.json
├── tsconfig.json
├── tsconfig.base.json
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── Makefile
├── Dockerfile
├── docker-compose.yml
├── README.md                  # 项目主文档
├── CHANGELOG.md               # 版本历史
├── LICENSE
└── AGENTS.md                  # Agent 技术参考
```

### 2.2 docs 目录结构

```
docs/
├── README.md                  # 文档索引
├── architecture/              # 架构文档
│   ├── overview.md
│   ├── five-layer-architecture.md
│   ├── multi-language-architecture.md
│   └── diagrams/
├── guides/                    # 用户指南
│   ├── CLAUDE.md              # Claude Code 协作指南
│   ├── AGENTS.md              # AI 编程助手指南
│   ├── quick-start.md
│   ├── development.md
│   ├── api.md
│   ├── deployment.md
│   ├── monitoring.md
│   ├── skills-quickstart.md
│   ├── glm-setup.md
│   └── writing-style.md
├── plans/                     # 开发计划
│   ├── phase1-*.md
│   ├── phase2-*.md
│   ├── phase4-*.md
│   ├── phase6-*.md
│   ├── optimization/
│   │   └── prompt-system-optimization-plan.md
│   └── roadmap.md
├── reports/                   # 完成报告
│   ├── 2026-04/
│   ├── 2026-05/
│   └── ARCHIVE/
├── analysis/                  # 分析文档
│   ├── prompt-system-*.md
│   └── performance-*.md
├── testing/                   # 测试文档
│   ├── testing-strategy.md
│   └── coverage.md
├── ci/                        # CI/CD 文档
│   └── cicd-monitoring-guide.md
├── api/                       # API 文档
│   └── (API 详细文档)
├── agents/                    # Agent 文档
│   └── (Agent 详细文档)
├── meta/                      # 元文档
│   ├── FILE_MANAGEMENT_RULES.md
│   ├── SECURITY_GUIDELINES.md
│   └── CONTRIBUTING.md
└── archive/                   # 归档文档
    └── (过时文档)
```

### 2.3 examples 目录结构

```
examples/
├── README.md
├── basic/                     # 基础示例
│   ├── basic-usage.ts
│   ├── checkpoint-filesystem-usage.ts
│   └── tools-usage.ts
├── agents/                    # Agent 示例
│   ├── agent-with-approval-and-checkpoint.ts
│   ├── patent-agents-usage.ts
│   └── agent-collaboration.ts
├── architecture/              # 架构示例
│   ├── five-layer-architecture.ts
│   └── orchestrator-with-metrics.ts
├── production/                # 生产示例
│   ├── production-usage-demo.ts
│   ├── production-usage-demo-simple.ts
│   └── integration-test.ts
├── optimization/              # 优化示例
│   ├── tool-selection-optimization.ts
│   └── usage-agent-performance-optimization.ts
├── knowledge/                 # 知识库示例
│   ├── knowledge-graph-usage.ts
│   └── unified-knowledge-graph-usage.ts
├── reasoning/                 # 推理示例
│   ├── usage-chain-of-thought.ts
│   └── usage-task-decomposition.ts
├── monitoring/                # 监控示例
│   ├── simple-metrics-server.ts
│   └── with-metrics.ts
├── patents/                   # 专利示例
│   ├── disclosure-example.md
│   ├── claims-generation-example.ts
│   ├── enhanced-oa-responder-example.ts
│   └── patent-agents-usage.README.md
├── style/                     # 风格示例
│   ├── usage-style-mimicry.ts
│   └── test-style-mimicry.ts
├── mcp/                       # MCP 示例
│   └── mcp-usage.ts
├── glm/                       # GLM 示例
│   └── glm-usage.ts
├── guides/                    # 指南文档
│   ├── phase2-interactive-cli-guide.md
│   └── phase2-invention-understanding-example.md
└── data/                      # 示例数据
    └── (测试数据)
```

### 2.4 scripts 目录结构

```
scripts/
├── README.md
├── ci/                        # CI/CD 脚本
│   ├── ci.sh
│   ├── ci-local.sh
│   ├── ci-health-check.sh
│   ├── ci-monitor.sh
│   ├── ci-performance-report.sh
│   ├── ci-cicd-status.sh
│   └── cicd-status.sh
├── build/                     # 构建脚本
│   ├── build-rust.sh
│   └── benchmark.cjs
├── deploy/                    # 部署脚本
│   ├── deploy.sh
│   ├── deploy-local.sh
│   └── import-grafana-dashboards.sh
├── test/                      # 测试脚本
│   ├── test-agents-omlx.sh
│   ├── test-agents-runtime.js
│   ├── test-alerts.sh
│   ├── test-metrics.cjs
│   └── verify-agents.js
├── check/                     # 检查脚本
│   ├── check-api-key.js
│   ├── check-doc-sync.js
│   ├── check-glm-api.js
│   ├── check-table-structure.js
│   ├── check-performance-regression.sh
│   ├── verify-env.sh
│   ├── verify-env.js
│   └── verify-env.cjs
├── generate/                  # 生成脚本
│   ├── generate-docs.js
│   ├── generate-cards.ts
│   ├── evaluate-completion.js
│   ├── quality-metrics.js
│   └── generate-invalid-decision-embeddings*.py
├── monitoring/                # 监控脚本
│   ├── monitoring.sh
│   ├── monitor-cicd.sh
│   ├── monitor-resources.sh
│   ├── quick-monitor.sh
│   └── start-metrics-server.sh
├── cleanup/                   # 清理脚本
│   ├── cleanup.sh
│   ├── cleanup-directory-structure.sh
│   └── schedule-tasks.sh
└── legacy/                    # 遗留/未分类脚本
    └── (其他脚本)
```

### 2.5 packages 目录结构

```
packages/
├── core/                      # 核心框架
├── orchestrator/              # 编排器
├── agents/                    # 通用智能体
│   ├── base/                  # 基础 Agent
│   ├── writing/               # 写作相关
│   │   ├── writer/
│   │   ├── specification/
│   │   ├── abstract-drafter/
│   │   └── spec-formality-checker/
│   ├── analysis/              # 分析相关
│   │   ├── analysis/
│   │   ├── patent-analyzer/
│   │   └── subject-matter-checker/
│   ├── search/                # 检索相关
│   │   ├── search/
│   │   ├── prior-art-search/
│   │   └── researcher/
│   ├── quality/               # 质量相关
│   │   ├── quality/
│   │   ├── quality-checker/
│   │   └── unity-checker/
│   ├── invention/             # 发明相关
│   │   ├── invention/
│   │   ├── invention-understanding/
│   │   └── claims/
│   ├── patent/                # 专利专用
│   │   ├── patent-writer/
│   │   ├── patent-manager/
│   │   ├── patent-responder/
│   │   └── patent-drafter/
│   ├── format/                # 格式相关
│   │   ├── format-converter/
│   │   └── claims-formality-checker/
│   ├── comparison/            # 对比相关
│   │   ├── comparison-report-generator/
│   │   └── spec-formality-checker/
│   ├── image/                 # 图像相关
│   │   ├── image-understanding/
│   │   └── technical-drawing/
│   ├── test/                  # 测试相关
│   │   ├── test/
│   │   └── integration-tests/
│   └── examples/              # 示例
├── tools/                     # 工具包
│   ├── builtin-tools/
│   ├── patent-tools/
│   ├── document-tools/
│   └── image-tools/
├── database/                  # 数据库
│   ├── patent-database/
│   └── patent-knowledge/
├── prompts/                   # 提示词
│   └── patent-prompts/
├── types/                     # 类型定义
│   └── patent-core/
├── server/                    # 服务器
│   ├── mcp-server/
│   ├── grpc-server/
│   └── unified-knowledge-graph/
├── skills/                    # Skills
├── cli/                       # CLI
└── rust-tools/                # Rust 工具
```

---

## 三、执行计划

### Phase 1: 根目录整理（优先级：高）

1. **移动文档文件**：
   - `AGENTS.md` → `docs/guides/AGENTS.md`（保留软链接在根目录）
   - `DOC_MAINTENANCE_GUIDE.md` → `docs/meta/`
   - `README.DOCKER.md` → `docs/guides/deployment.md`
   - `QUICK_START.md` → `docs/guides/quick-start.md`

2. **归档完成报告**：
   - 所有 `*_COMPLETION_REPORT.md` → `docs/reports/2026-05/`
   - `FINAL_COMPLETION_REPORT.md` → `docs/reports/2026-05/`
   - `PROJECT_COMPLETION_*.md` → `docs/reports/2026-05/`

3. **归档其他文档**：
   - `BUG_FIX_LOG.md` → `docs/reports/`
   - `P0-CRITICAL-FIXES-REPORT.md` → `docs/reports/2026-05/`
   - `GETTING_STARTED_WITH_MONITORING.md` → `docs/guides/monitoring.md`
   - `MODULE_COMPLETION_*.md` → `docs/reports/2026-05/`
   - `MCP_COMPLETION_REPORT.md` → `docs/reports/2026-05/`

4. **清理临时文件**：
   - `.tsbuildinfo` → 添加到 `.gitignore`
   - `performance-baseline.json` → `config/`

5. **合并重复配置**：
   - 保留 `drizzle.config.ts`，删除 `drizzle.config.js`

### Phase 2: docs 目录整理（优先级：高）

1. **创建新子目录**：
   - `docs/architecture/`
   - `docs/guides/`
   - `docs/plans/`
   - `docs/reports/`
   - `docs/analysis/`
   - `docs/testing/`
   - `docs/ci/`
   - `docs/meta/`
   - `docs/archive/`

2. **移动文件到新结构**：
   - 按 2.2 节定义的结构重新组织

3. **更新 docs/README.md**：
   - 添加新的目录索引
   - 更新文件链接

### Phase 3: examples 目录整理（优先级：中）

1. **创建分类子目录**：
   - `examples/basic/`
   - `examples/agents/`
   - `examples/architecture/`
   - `examples/production/`
   - `examples/optimization/`
   - `examples/knowledge/`
   - `examples/reasoning/`
   - `examples/monitoring/`
   - `examples/patents/`
   - `examples/style/`
   - `examples/mcp/`
   - `examples/glm/`

2. **移动文件到对应分类**：
   - 按 2.3 节定义的分类重新组织

3. **更新 examples/README.md**

### Phase 4: scripts 目录整理（优先级：中）

1. **创建分类子目录**：
   - `scripts/ci/`
   - `scripts/build/`
   - `scripts/deploy/`
   - `scripts/test/`
   - `scripts/check/`
   - `scripts/generate/`
   - `scripts/monitoring/`
   - `scripts/cleanup/`
   - `scripts/legacy/`

2. **移动脚本到对应分类**：
   - 按 2.4 节定义的分类重新组织

3. **更新脚本中的相对路径引用**

4. **更新 scripts/README.md**

### Phase 5: packages 目录整理（优先级：低）

1. **重组 agents 包**：
   - 创建分类子目录
   - 移动现有 agent 包到对应分类

2. **更新包引用**：
   - 更新 `package.json` 中的依赖路径
   - 更新 TypeScript `import` 语句

3. **更新构建配置**

### Phase 6: 文档更新（优先级：高）

1. **更新 README.md**：
   - 更新项目结构图
   - 更新文档链接
   - 更新快速开始指南

2. **更新 AGENTS.md**：
   - 更新 Agent 文档链接

3. **创建 DIRECTORY_STRUCTURE.md**：
   - 详细说明新的目录结构
   - 添加文件放置规则

---

## 四、风险评估

| 风险            | 影响 | 缓解措施                                  |
| --------------- | ---- | ----------------------------------------- |
| 破坏现有链接    | 高   | 使用 Git 移动（保留历史），创建软链接过渡 |
| CI/CD 失败      | 中   | 同步更新 CI 配置中的路径                  |
| import 路径失效 | 高   | 更新所有 `import` 语句                    |
| 文档链接失效    | 中   | 批量更新文档中的链接                      |

---

## 五、执行检查清单

### 执行前

- [ ] 创建备份分支
- [ ] 记录当前所有关键路径
- [ ] 通知团队成员

### 执行中

- [ ] 使用 Git 移动（保留历史）
- [ ] 每个阶段完成后提交
- [ ] 运行测试验证
- [ ] 检查 CI/CD 状态

### 执行后

- [ ] 更新所有文档链接
- [ ] 运行完整测试套件
- [ ] 验证构建成功
- [ ] 通知团队成员

---

## 六、后续维护

1. **文件放置规则**：
   - 新文档按类型放入 `docs/` 对应子目录
   - 新示例按类型放入 `examples/` 对应子目录
   - 新脚本按类型放入 `scripts/` 对应子目录

2. **定期审查**：
   - 每季度检查目录结构
   - 归档过时文档到 `docs/archive/`
   - 清理临时文件

3. **文档同步**：
   - 更新目录结构时同步更新 README
   - 保持文档链接有效性

---

**附录：文件移动清单**

详细的文件移动清单将在执行阶段生成，包括：

- 源路径
- 目标路径
- 是否需要更新引用
- 相关测试文件
