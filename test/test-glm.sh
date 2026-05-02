#!/bin/bash
# GLM 模型测试脚本

set -e

echo "🔑 检查 API Key..."
if [ -z "$GLM_API_KEY" ]; then
  echo "❌ 错误: 请设置 GLM_API_KEY 环境变量"
  echo ""
  echo "使用方式:"
  echo "  export GLM_API_KEY=your_api_key_here"
  echo "  ./test-glm.sh"
  echo ""
  echo "或者加载 .env.glm 文件:"
  echo "  source .env.glm"
  echo "  ./test-glm.sh"
  exit 1
fi

echo "✅ API Key 已设置"
echo ""
echo "🧪 开始测试 GLM-4-Flash 模型..."
echo ""

# 运行测试（从项目根目录）
cd "$(dirname "$0")" && pnpm --filter @yunpat/core exec tsx test-glm.ts

echo ""
echo "✅ 测试完成"
