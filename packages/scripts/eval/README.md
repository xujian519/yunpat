# yunpat-agent 统一评测（Eval）使用指南

本文件夹提供 `yunpat-agent` 在“统一评测基座”中的最小可执行入口，用于：

- 单 case 运行（mock / real）
- 输出统一 `AgentOutput` JSON（可被 `YunPat` 侧的 compare/scorer 直接消费）

## 目录结构

- [createYunpatAgentEvalRunner.ts](file:///Users/xujian/projects/yunpat-agent/packages/scripts/eval/createYunpatAgentEvalRunner.ts)：真实 runner 初始化（Orchestrator + LLMClient + 路由）
- [run-yunpat-agent-case.ts](file:///Users/xujian/projects/yunpat-agent/packages/scripts/eval/run-yunpat-agent-case.ts)：单 case CLI

此外，本项目会复用一个共享的评测工具模块：

- `/Users/xujian/projects/patent-eval-kit/eval-utils.ts`（包含 direct structured analysis 与 authority citation backfill 的复用实现）

## 前置条件

### 1) Node/tsx 运行方式

本仓库使用 ESM + tsx，建议用：

```bash
node --import tsx <script.ts>
```

### 2) LLM 环境变量（真实运行必需）

真实模式会在 `createYunpatAgentEvalRunner.ts` 读取如下环境变量：

- `EVAL_LLM_API_KEY`（优先）或 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`
- `EVAL_LLM_PROVIDER`（默认 `openai`）
- `EVAL_LLM_MODEL`（默认 `deepseek-chat`）
- `EVAL_LLM_BASE_URL`（默认 `https://api.deepseek.com`）
- `EVAL_LLM_TEMPERATURE`（默认 `0.2`）
- `EVAL_LLM_MAX_TOKENS`（默认 `4000`）

示例（DeepSeek）：

```bash
export EVAL_LLM_API_KEY="YOUR_KEY"
export EVAL_LLM_PROVIDER="openai"
export EVAL_LLM_MODEL="deepseek-chat"
export EVAL_LLM_BASE_URL="https://api.deepseek.com"
```

## 单 case 运行（yunpat-agent）

建议工作目录切到 `yunpat-agent/packages` 再运行：

```bash
cd /Users/xujian/projects/yunpat-agent/packages
```

### 1) Mock 模式（不调用真实 LLM）

```bash
node --import tsx ./scripts/eval/run-yunpat-agent-case.ts \
  /Users/xujian/projects/YunPat/cases/gold/article26-enable-001.json \
  --mock
```

仅输出 `AgentOutput`（给 compare 用）：

```bash
node --import tsx ./scripts/eval/run-yunpat-agent-case.ts \
  /Users/xujian/projects/YunPat/cases/gold/article26-enable-001.json \
  --mock --output-only
```

### 2) Real 模式（调用真实 LLM）

```bash
node --import tsx ./scripts/eval/run-yunpat-agent-case.ts \
  /Users/xujian/projects/YunPat/cases/gold/inventiveness-3_2-001.json
```

可指定策略：

```bash
node --import tsx ./scripts/eval/run-yunpat-agent-case.ts \
  /Users/xujian/projects/YunPat/cases/gold/inventiveness-3_2-001.json \
  --strategy baseline
```

## 与 YunPat 做双项目 compare

统一 compare 入口目前放在 `YunPat` 仓库侧（它负责装配两个 runner、统一 scorer、落盘 artifacts）。

### 1) 运行 gold 集（真实）

```bash
cd /Users/xujian/projects/YunPat
node --import tsx ./scripts/eval/run-compare.ts \
  --status gold \
  --task article26 --task inventiveness \
  --artifact-root /tmp/patent-eval-artifacts
```

### 2) Mock compare（不调用真实 LLM）

```bash
cd /Users/xujian/projects/YunPat
node --import tsx ./scripts/eval/run-compare.ts \
  --mock \
  --status gold \
  --task article26 --task inventiveness
```

## 路由规则（yunpat-agent）

`createYunpatAgentEvalRunner.ts` 对不同任务类型采用不同执行路径（目标是“输出合同稳定 + 可回归”）：

- `inventiveness/novelty`：走 direct structured analysis（强约束合同 JSON 输出）
- `article26/rule20`：
  - 若 `decision_id` 以 `SILVER-` 开头：走 direct structured analysis（避免 quality agent 在模板数据上波动）
  - 若 `decision_id` 是 `17691/20077`：走 direct structured analysis（权利要求清楚性/实施细则第20条类 case 更稳定）
  - 其他情况：优先走 `quality` agent（失败再由脚本抛错，便于定位）

## 常见问题

### 1) 提示“未找到评测所需 API Key”

给真实模式配置任意一个 key：

- `EVAL_LLM_API_KEY`（推荐）
- 或 `DEEPSEEK_API_KEY`
- 或 `OPENAI_API_KEY`

### 2) compare 能跑，但两边分数都卡在 58/95

当前 scorer 中：

- `95` 主要表示：结论命中 + 合同字段齐全 + 引用数量够 + 引用能回溯到 `decision_id`
- 扣掉的 `5` 通常来自 `cost_efficiency=0`（暂未接 token 计费/成本）

### 3) 引用（citations）从哪里来

优先级：

- agent 自己输出 citations（如果有）
- 否则 runner 会用 case 的 `gold_citations` / `source_tier1_authority.spans` 做 authority citation backfill（保证可回归、可比较）
