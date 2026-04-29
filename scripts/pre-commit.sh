#!/bin/bash
# YunPat pre-commit hook
# 每次 commit 前自动执行：类型检查 + 测试
# 安装: cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

echo "🔍 pre-commit: 类型检查..."
pnpm --filter @yunpat/core build 2>&1 | tail -1

echo "🧪 pre-commit: 运行测试..."
pnpm --filter @yunpat/core exec vitest run --reporter=dot 2>&1 | tail -3

echo "✅ pre-commit 检查通过"
