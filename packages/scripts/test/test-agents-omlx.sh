#!/bin/bash

# YunPat 智能体 oMLX 集成测试脚本

set -e

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 加载 .env 文件
if [ -f "$PROJECT_ROOT/.env" ]; then
  export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
  echo "✅ 已加载 .env 文件"
else
  echo "❌ 未找到 .env 文件"
  exit 1
fi

# 检查必需的环境变量
if [ -z "$OMLX_API_KEY" ]; then
  echo "❌ OMLX_API_KEY 未设置"
  exit 1
fi

echo "🔑 OMLX_API_KEY: ${OMLX_API_KEY:0:5}..."
echo "🔗 OMLX_BASE_URL: ${OMLX_BASE_URL:-http://localhost:8009/v1}"
echo ""

# 运行测试
cd "$PROJECT_ROOT"
npx tsx scripts/test-agents-omlx.ts
