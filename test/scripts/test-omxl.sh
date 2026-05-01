#!/bin/bash
# OMLX 本地模型测试脚本

# 设置 OMLX 环境变量
export OMXL_API_KEY="xj781102@"
export OMXL_BASE_URL="http://localhost:8009/v1"

echo "🚀 开始测试 OMLX 本地模型..."
echo "📍 OMLX 服务: $OMXL_BASE_URL"
echo "📅 时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 检查 OMLX 服务
echo "🔍 检查 OMLX 服务状态..."
curl -s "$OMXL_BASE_URL/models" \
  -H "Authorization: Bearer $OMXL_API_KEY" \
  | head -20 || echo "❌ OMLX 服务未运行或 API key 错误"

echo ""
echo "✅ 如果看到模型列表，说明 OMLX 服务正常"
echo ""
echo "运行完整测试："
echo "  pnpm --filter @yunpat/core exec tsx examples/patent-reasoning-omxl.ts"
