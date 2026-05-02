#!/bin/bash
# GLM 配置验证脚本

echo "🔍 验证 GLM 配置..."
echo ""

# 检查 API Key
if [ -z "$GLM_API_KEY" ]; then
  echo "❌ GLM_API_KEY 未设置"
  echo ""
  echo "请设置 API Key:"
  echo "  export GLM_API_KEY=your_api_key_here"
  echo ""
  exit 1
fi

echo "✅ GLM_API_KEY 已设置"
echo "   API Key: ${GLM_API_KEY:0:10}...${GLM_API_KEY: -4}"
echo ""

# 检查必要文件
echo "📁 检查必要文件..."
files=(
  "test-glm.ts"
  "test-glm.sh"
  "examples/glm-usage.ts"
  "docs/guides/glm-usage.md"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (缺失)"
  fi
done

echo ""

# 检查包依赖
echo "📦 检查包依赖..."
if [ -d "node_modules" ]; then
  echo "  ✅ node_modules 已安装"
else
  echo "  ⚠️  node_modules 未找到，运行: pnpm install"
fi

echo ""

# 检查 TypeScript 编译
echo "🔧 检查 TypeScript..."
if pnpm --filter @yunpat/core exec tsc --noEmit 2>&1 | grep -q "error"; then
  echo "  ⚠️  TypeScript 编译有错误"
else
  echo "  ✅ TypeScript 编译通过"
fi

echo ""
echo "✅ 配置验证完成"
echo ""
echo "🚀 运行测试:"
echo "  ./test-glm.sh"
echo ""
echo "📖 查看文档:"
echo "  cat docs/guides/glm-usage.md"
echo ""
