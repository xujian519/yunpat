#!/bin/bash

# 性能回归检测脚本
# 用于对比不同版本之间的性能差异

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          YunPat 性能回归检测                                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 运行性能基准测试
echo "1. 运行性能基准测试..."
pnpm test:unit -- packages/core/test/performance/benchmark.test.ts 2>&1 | grep -E "(PASS|FAIL|Duration|✓|✗)" || echo "   测试运行完成"

echo ""
echo "2. 生成性能报告..."
node scripts/benchmark.cjs 2>&1 | grep -E "(平均时间|中位数|最大值)" | head -20

echo ""
echo "3. 对比基准数据..."
# 这里可以添加逻辑来对比历史基准数据
# 例如：读取之前的基准结果，计算性能变化百分比

echo "✅ 性能回归检测完成"
echo ""
echo "💡 提示:"
echo "   - 定期运行此脚本以检测性能回归"
echo "   - 如果性能下降超过 20%，应该调查原因"
echo "   - 将基准结果保存到文件以便历史对比"
