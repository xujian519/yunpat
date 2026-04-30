#!/bin/bash

# YunPat 记忆层快速验证脚本
#
# 功能：
# 1. 验证 BGE-M3 服务
# 2. 运行 Token 窗口示例
# 3. 显示完整报告

set -e

echo "========================================"
echo "  YunPat 记忆层 - 快速验证脚本"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 验证 BGE-M3 服务
echo "1️⃣  验证 BGE-M3 嵌入模型..."
echo "----------------------------------------"
if npx tsx packages/core/src/memory/integration/verify-bge.ts 2>&1 | grep -q "✅ 所有验证通过"; then
    echo -e "${GREEN}✅ BGE-M3 验证通过${NC}"
else
    echo -e "${RED}❌ BGE-M3 验证失败${NC}"
    exit 1
fi
echo ""

# 2. 运行 Token 窗口示例
echo "2️⃣  运行 Token 窗口示例..."
echo "----------------------------------------"
if npx tsx packages/core/src/memory/short-term/example.ts 2>&1 | grep -q "✅ 所有示例执行完成"; then
    echo -e "${GREEN}✅ Token 窗口示例运行成功${NC}"
else
    echo -e "${RED}❌ Token 窗口示例运行失败${NC}"
    exit 1
fi
echo ""

# 3. 显示完整报告
echo "3️⃣  完整实现报告"
echo "========================================"
cat packages/core/src/memory/完整实现报告.md
echo ""

# 4. 统计信息
echo "4️⃣  统计信息"
echo "--------------------------------========"
echo "总文件数: $(find packages/core/src/memory -name '*.ts' -o -name '*.md' | wc -l)"
echo "代码行数: $(find packages/core/src/memory -name '*.ts' | xargs wc -l | tail -1 | awk '{print $1}')"
echo "文档行数: $(find packages/core/src/memory -name '*.md' | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ 验证完成！记忆层工作正常${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📝 下一步："
echo "   - 运行 RAG 示例: npx tsx packages/core/src/memory/integration/rag-example.ts"
echo "   - 查看集成文档: cat packages/core/src/memory/integration/README.md"
echo "   - 查看向量存储: cat packages/core/src/memory/long-term/README.md"
echo ""
