# YunPat 维护脚本

包含 74 个脚本文件，按功能分为 10 个类别，用于项目的构建、检查、部署、测试、监控等日常维护任务。

---

## 目录索引

### build/ -- 构建脚本（2 个文件）

| 文件            | 说明              |
| --------------- | ----------------- |
| `benchmark.cjs` | 性能基准测试      |
| `build-rust.sh` | Rust 组件构建脚本 |

### check/ -- 检查与验证脚本（15 个文件）

| 文件                              | 说明                         |
| --------------------------------- | ---------------------------- |
| `check-api-key.js`                | API Key 有效性检查           |
| `check-doc-sync.js`               | 文档同步检查                 |
| `check-file-placement.sh`         | 文件放置规则检查             |
| `check-glm-api.js`                | GLM API 连通性检查           |
| `check-performance-regression.sh` | 性能回归检测                 |
| `check-runner-remote.sh`          | 远程 Runner 状态检查         |
| `check-table-structure.js`        | 数据库表结构检查             |
| `verify-env.cjs`                  | 环境变量验证（CommonJS）     |
| `verify-env.js`                   | 环境变量验证（ESM）          |
| `verify-env.sh`                   | 环境变量验证（Shell）        |
| `verify-env.ts`                   | 环境变量验证（TypeScript）   |
| `verify-glm-setup.sh`             | GLM 配置验证                 |
| `verify-mvp.js`                   | MVP 功能验证                 |
| `verify-tools.sh`                 | 工具完整性验证               |
| `verify-tools.ts`                 | 工具完整性验证（TypeScript） |

### ci/ -- CI/CD 脚本（8 个文件）

| 文件                       | 说明                |
| -------------------------- | ------------------- |
| `ci.sh`                    | 主 CI 流程          |
| `ci-check.sh`              | CI 检查步骤         |
| `ci-health-check.sh`       | CI 健康检查         |
| `ci-local.sh`              | 本地 CI 模拟        |
| `ci-monitor.sh`            | CI 监控             |
| `ci-performance-report.sh` | CI 性能报告         |
| `cicd-status.sh`           | CI/CD 状态查询      |
| `pre-commit.sh`            | Git pre-commit 钩子 |

### cleanup/ -- 清理脚本（3 个文件）

| 文件                             | 说明         |
| -------------------------------- | ------------ |
| `cleanup.sh`                     | 通用清理     |
| `cleanup-directory-structure.sh` | 目录结构整理 |
| `schedule-tasks.sh`              | 定时任务调度 |

### deploy/ -- 部署脚本（3 个文件）

| 文件                           | 说明               |
| ------------------------------ | ------------------ |
| `deploy.sh`                    | 生产部署           |
| `deploy-local.sh`              | 本地部署           |
| `import-grafana-dashboards.sh` | Grafana 仪表盘导入 |

### generate/ -- 生成脚本（7 个文件）

| 文件                                           | 说明                   |
| ---------------------------------------------- | ---------------------- |
| `generate-cards.ts`                            | 知识卡片生成           |
| `generate-docs.js`                             | 文档生成               |
| `generate-invalid-decision-embeddings.ts`      | 无效判决嵌入向量生成   |
| `generate-invalid-decision-embeddings-test.ts` | 嵌入向量生成测试       |
| `generate_invalid_decision_embeddings.py`      | 嵌入向量生成（Python） |
| `evaluate-completion.js`                       | 补全质量评估           |
| `quality-metrics.js`                           | 质量指标生成           |

### legacy/ -- 历史遗留脚本（4 个文件）

| 文件                        | 说明                        |
| --------------------------- | --------------------------- |
| `convert_openclaw_graph.py` | OpenClaw 图谱转换（Python） |
| `diagnose-runner.sh`        | Runner 诊断                 |
| `fix-runner-git-config.sh`  | Runner Git 配置修复         |
| `new-doc-template.sh`       | 新文档模板生成              |
| `weekly-review.js`          | 周报生成                    |

### monitoring/ -- 监控脚本（5 个文件）

| 文件                      | 说明           |
| ------------------------- | -------------- |
| `monitoring.sh`           | 主监控脚本     |
| `monitor-cicd.sh`         | CI/CD 监控     |
| `monitor-resources.sh`    | 资源监控       |
| `quick-monitor.sh`        | 快速监控       |
| `start-metrics-server.sh` | 启动指标服务器 |

### test/ -- 测试脚本（17 个文件）

| 文件                                          | 说明                 |
| --------------------------------------------- | -------------------- |
| `test-agents-omlx.sh` / `test-agents-omlx.ts` | OMLX Agent 测试      |
| `test-agents-runtime.js`                      | Agent 运行时测试     |
| `test-alerts.sh`                              | 告警测试             |
| `test-cost-optimization.mjs`                  | 成本优化测试         |
| `test-cost-quick.mjs`                         | 快速成本测试         |
| `test-invalid-decisions-simple.js`            | 无效判决简单测试     |
| `test-invalid-decisions.ts`                   | 无效判决测试         |
| `test-knowledge-graph-integration.ts`         | 知识图谱集成测试     |
| `test-metrics.cjs`                            | 指标测试             |
| `test-multiling.mjs`                          | 多语言测试           |
| `test-omlx-integration.ts`                    | OMLX 集成测试        |
| `test-omlx.sh`                                | OMLX Shell 测试      |
| `test-omxl-writer.mjs`                        | OMLX Writer 测试     |
| `test-omxl.ts`                                | OMLX TypeScript 测试 |
| `test-p1-optimization.mjs`                    | P1 优化测试          |
| `test-stability-e2e.mjs`                      | 端到端稳定性测试     |
| `verify-agents.js`                            | Agent 验证           |
| `performance-test-knowledge-graph.ts`         | 知识图谱性能测试     |

### 根目录脚本（7 个文件）

| 文件                  | 说明               |
| --------------------- | ------------------ |
| `dev-start.sh`        | 启动开发环境       |
| `dev-stop.sh`         | 停止开发环境       |
| `dev-watch.sh`        | 监听模式启动       |
| `start-tui.sh`        | 启动 TUI 界面      |
| `fix-dist-imports.js` | 修复 dist 导入路径 |
| `fix-esm-imports.js`  | 修复 ESM 导入      |
| `fix-imports.js`      | 修复通用导入       |

---

## 常用操作

### 开发环境

```bash
./scripts/dev-start.sh     # 启动开发环境
./scripts/dev-watch.sh     # 监听模式
./scripts/dev-stop.sh      # 停止开发环境
```

### 检查与验证

```bash
./scripts/check/verify-env.sh          # 验证环境变量
./scripts/check/verify-tools.sh        # 验证工具完整性
./scripts/check/check-file-placement.sh # 检查文件组织
```

### 测试

```bash
./scripts/test/verify-agents.js         # 验证所有 Agent
./scripts/test/test-stability-e2e.mjs   # 端到端稳定性测试
```

### 部署

```bash
./scripts/deploy/deploy-local.sh  # 本地部署
./scripts/deploy/deploy.sh        # 生产部署
```

---

## 添加新脚本的规范

1. **命名** -- 使用 kebab-case，名称清晰描述功能，添加适当扩展名
2. **结构** -- Shell 脚本使用 `set -e`；添加注释说明用途
3. **权限** -- `chmod +x scripts/your-script.sh`
4. **文档** -- 在本 README 中添加说明

---

## 许可证

MIT

---

最后更新: 2026-05-06
