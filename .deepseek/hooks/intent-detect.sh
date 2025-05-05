#!/usr/bin/env bash
# intent-detect.sh — 专利意图检测 Hook
# 读取 stdin JSON，通过 npx 运行 intent-hook.ts 进行关键词检测
# 输出 JSONL 指令到 stdout
set -euo pipefail

npx --yes tsx /Users/xujian/projects/yunpat-agent/packages/packages/orchestrator-adapter/src/intent-hook.ts
