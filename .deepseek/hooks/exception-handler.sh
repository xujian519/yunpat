#!/usr/bin/env bash
# exception-handler.sh — 异常恢复 Hook
# 读取 stdin JSON，通过 npx 运行 exception-hook.ts 生成恢复策略
# 输出 JSONL 指令到 stdout
set -euo pipefail

npx --yes tsx /Users/xujian/projects/yunpat-agent/packages/packages/orchestrator-adapter/src/exception-hook.ts
