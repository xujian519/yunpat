# YunPat 示例代码

包含 43 个文件，分布在 16 个分类目录中，展示 YunPat 各模块的用法。

---

## 目录索引

### agents/ -- 智能体使用示例（6 个文件）

| 文件                                    | 说明                   |
| --------------------------------------- | ---------------------- |
| `agent-collaboration.ts`                | 多智能体协作示例       |
| `agent-with-approval-and-checkpoint.ts` | 带审批和检查点的智能体 |
| `integrated-agents-simple.js`           | 简单集成示例（JS）     |
| `integrated-agents.ts`                  | 完整集成示例           |
| `patent-agents-usage.ts`                | 专利智能体使用示例     |

### architecture/ -- 架构示例（3 个文件）

| 文件                           | 说明                 |
| ------------------------------ | -------------------- |
| `five-layer-architecture.ts`   | 五层架构使用示例     |
| `orchestrator-with-metrics.ts` | 带指标的中枢调度示例 |
| `workflow-engine-usage.ts`     | 工作流引擎使用示例   |

### basic/ -- 基础用法示例（4 个文件 + 1 个说明文档）

| 文件                             | 说明               |
| -------------------------------- | ------------------ |
| `basic-usage.ts`                 | 基础使用入门       |
| `checkpoint-filesystem-usage.ts` | 文件系统检查点使用 |
| `ipc-classification-example.ts`  | IPC 分类示例       |
| `tools-usage.ts`                 | 工具系统使用       |

### glm/ -- GLM 模型示例（1 个文件）

| 文件           | 说明                  |
| -------------- | --------------------- |
| `glm-usage.ts` | 智谱 GLM 模型集成使用 |

### guides/ -- 使用指南（2 个文件）

| 文件                                        | 说明                    |
| ------------------------------------------- | ----------------------- |
| `phase2-interactive-cli-guide.md`           | 第二阶段交互式 CLI 指南 |
| `phase2-invention-understanding-example.md` | 发明理解示例说明        |

### knowledge/ -- 知识库示例（2 个文件）

| 文件                               | 说明                 |
| ---------------------------------- | -------------------- |
| `knowledge-graph-usage.ts`         | 知识图谱使用示例     |
| `unified-knowledge-graph-usage.ts` | 统一知识图谱使用示例 |

### mcp/ -- MCP 协议示例（1 个文件）

| 文件           | 说明                      |
| -------------- | ------------------------- |
| `mcp-usage.ts` | MCP Server 客户端调用示例 |

### monitoring/ -- 监控示例（2 个文件）

| 文件                       | 说明                 |
| -------------------------- | -------------------- |
| `simple-metrics-server.ts` | 简易指标服务器       |
| `with-metrics.ts`          | 带指标集成的使用示例 |

### optimization/ -- 优化示例（4 个文件）

| 文件                                      | 说明               |
| ----------------------------------------- | ------------------ |
| `agent-tool-selection-integration.ts`     | 工具选择集成示例   |
| `test-tool-selection-optimization.ts`     | 工具选择优化测试   |
| `tool-selection-optimization.ts`          | 工具选择优化使用   |
| `usage-agent-performance-optimization.ts` | Agent 性能优化使用 |

### patents/ -- 专利处理示例（3 个文件 + 1 个说明文档）

| 文件                               | 说明               |
| ---------------------------------- | ------------------ |
| `claims-generation-example.ts`     | 权利要求生成示例   |
| `enhanced-oa-responder-example.ts` | 增强 OA 答复示例   |
| `disclosure-example.md`            | 技术交底书示例文档 |

### production/ -- 生产环境示例（3 个文件）

| 文件                              | 说明             |
| --------------------------------- | ---------------- |
| `integration-test.ts`             | 完整集成测试     |
| `production-usage-demo-simple.ts` | 简化生产环境演示 |
| `production-usage-demo.ts`        | 完整生产环境演示 |

### reasoning/ -- 推理引擎示例（5 个文件）

| 文件                                      | 说明                  |
| ----------------------------------------- | --------------------- |
| `usage-chain-of-thought.ts`               | Chain-of-Thought 使用 |
| `usage-glm-4-7-patent.ts`                 | GLM-4-7 专利写作示例  |
| `usage-hallucination-detection.ts`        | 幻觉检测使用          |
| `usage-patent-writer-hallucination.ts`    | 专利写作幻觉检测      |
| `usage-result-validator-hallucination.ts` | 结果验证器幻觉检测    |
| `usage-task-decomposition.ts`             | 任务分解使用          |

### style/ -- 风格相关示例（3 个文件）

| 文件                     | 说明               |
| ------------------------ | ------------------ |
| `test-style-mimicry.ts`  | 风格模仿测试       |
| `usage-style-mimicry.ts` | 风格模仿使用       |
| `verify-style-config.js` | 风格配置验证（JS） |

### testing/ -- 测试相关

测试辅助数据和工具。

### data/ -- 数据文件

示例数据集和配置。

---

## 快速开始

```bash
# 安装依赖（在项目根目录）
pnpm install
pnpm build

# 运行示例（需要先构建）
npx ts-node examples/basic/basic-usage.ts
```

大多数示例需要设置以下环境变量：

```bash
DEEPSEEK_API_KEY=sk-your-key    # DeepSeek API Key
```

---

## 许可证

MIT

---

最后更新: 2026-05-06
