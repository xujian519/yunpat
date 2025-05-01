#!/bin/bash
# CI 性能报告生成器
#
# 生成详细的 CI 性能分析报告

set -e

REPORT_FILE="ci-performance-report-$(date +%Y%m%d).md"

echo "📊 生成 CI 性能报告..."
echo "报告文件: $REPORT_FILE"
echo ""

# 获取最近100次运行数据
RUNS=$(gh run list --json databaseId,conclusion,name,status,durationMs,updatedAt,createdAt --limit 100)

# 计算统计数据
TOTAL_COUNT=$(echo "$RUNS" | jq 'length')
SUCCESS_COUNT=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "success")] | length')
FAILED_COUNT=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "failure")] | length')
SUCCESS_RATE=$(echo "scale=1; $SUCCESS_COUNT * 100 / $TOTAL_COUNT" | bc)

# 计算平均耗时
AVG_DURATION_MS=$(echo "$RUNS" | jq '[.[] | select(.durationMs != null)] | .durationMs | add / length')
AVG_DURATION_SECONDS=$(echo "scale=0; $AVG_DURATION_MS / 1000" | bc)

# 生成报告
cat > "$REPORT_FILE" << EOF
# CI/CD 性能报告

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
**统计周期**: 最近 100 次运行
**报告范围**: 所有 workflows

---

## 📊 总体概况

| 指标 | 数值 | 状态 |
|------|------|------|
| **总运行次数** | $TOTAL_COUNT 次 | - |
| **成功次数** | $SUCCESS_COUNT 次 | - |
| **失败次数** | $FAILED_COUNT 次 | - |
| **成功率** | ${SUCCESS_RATE}% | $(if (( $(echo "$SUCCESS_RATE >= 95" | bc -l) )); then echo "✅ 优秀"; elif (( $(echo "$SUCCESS_RATE >= 90" | bc -l) )); then echo "⚠️ 良好"; else echo "❌ 需改进"; fi) |
| **平均构建时间** | ${AVG_DURATION_SECONDS}秒 | $(if (( $(echo "$AVG_DURATION_SECONDS <= 180" | bc -l) )); then echo "✅ 优秀"; elif (( $(echo "$AVG_DURATION_SECONDS <= 300" | bc -l) )); then echo "⚠️ 可接受"; else echo "❌ 需优化"; fi) |

---

## 📈 性能趋势分析

### 成功率趋势

\`\`\`
成功率: ${SUCCESS_RATE}%
目标值: ≥95%
状态: $(if (( $(echo "$SUCCESS_RATE >= 95" | bc -l) )); then echo "✅ 达标"; else echo "❌ 未达标"; fi)
\`\`\`

### 构建时间趋势

\`\`\`
平均耗时: ${AVG_DURATION_SECONDS}秒
目标值: ≤180秒 (3分钟)
状态: $(if (( $(echo "$AVG_DURATION_SECONDS <= 180" | bc -l) )); then echo "✅ 达标"; else echo "❌ 未达标"; fi)
\`\`\`

---

## 🔍 详细分析

### 按工作流分类

EOF

# 分析不同工作流的性能
for workflow in "CI (Simplified)" "CI (Optimized)"; do
    echo "分析工作流: $workflow"
    WORKFLOW_RUNS=$(echo "$RUNS" | jq "[.[] | select(.name == \"$workflow\")]")

    WF_TOTAL=$(echo "$WORKFLOW_RUNS" | jq 'length')
    WF_SUCCESS=$(echo "$WORKFLOW_RUNS" | jq '[.[] | select(.conclusion == "success")] | length')
    WF_AVG_DURATION=$(echo "$WORKFLOW_RUNS" | jq '[.[] | select(.durationMs != null)] | .durationMs | add / length')

    if [ "$WF_TOTAL" -gt 0 ]; then
        WF_RATE=$(echo "scale=1; $WF_SUCCESS * 100 / $WF_TOTAL" | bc)
        WF_AVG_SEC=$(echo "scale=0; $WF_AVG_DURATION / 1000" | bc)

        cat >> "$REPORT_FILE" << EOF
#### $workflow

- 运行次数: $WF_TOTAL 次
- 成功率: ${WF_RATE}%
- 平均耗时: ${WF_AVG_SEC}秒

EOF
    fi
done

# 添加失败分析
cat >> "$REPORT_FILE" << EOF
---

## ❌ 失败分析

### 最近失败运行

EOF

# 列出最近10次失败运行
FAILED_RUNS=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "failure")] | .[:10]')
FAILED_COUNT=$(echo "$FAILED_RUNS" | jq 'length')

if [ "$FAILED_COUNT" -gt 0 ]; then
    echo "$FAILED_RUNS" | jq -r '.[] | "- **\(.name)** (\(.updatedAt))"' >> "$REPORT_FILE"
else
    echo "暂无失败运行" >> "$REPORT_FILE"
fi

# 添加优化建议
cat >> "$REPORT_FILE" << EOF
---

## 💡 优化建议

### 短期优化 (1-2周)

EOF

# 根据当前指标提供优化建议
if (( $(echo "$SUCCESS_RATE < 95" | bc -l) )); then
    cat >> "$REPORT_FILE" << EOF
1. **提高成功率**
   - 分析失败原因并修复
   - 添加更多单元测试
   - 加强代码审查

EOF
fi

if (( $(echo "$AVG_DURATION_SECONDS > 180" | bc -l) )); then
    cat >> "$REPORT_FILE" << EOF
2. **优化构建时间**
   - 使用 pnpm 缓存优化
   - 并行化独立任务
   - 优化依赖安装

EOF
fi

cat >> "$REPORT_FILE" << EOF
### 长期优化 (1-3个月)

1. **自动化监控**
   - 设置性能告警阈值
   - 建立自动报告机制
   - 集成到开发流程

2. **持续改进**
   - 定期审查 CI 配置
   - 评估新的优化工具
   - 收集团队反馈

---

## 📋 监控检查清单

### 每日检查
- [ ] 查看最新 CI 运行状态
- [ ] 检查是否有失败构建
- [ ] 关注构建时间变化

### 每周检查
- [ ] 分析成功率趋势
- [ ] 识别性能瓶颈
- [ ] 审查失败原因

### 每月检查
- [ ] 生成性能报告
- [ ] 评估优化效果
- [ ] 调整监控策略

---

## 🎯 下月目标

| 指标 | 当前值 | 目标值 | 行动计划 |
|------|--------|--------|----------|
| **成功率** | ${SUCCESS_RATE}% | ≥98% | 加强测试，修复失败 |
| **构建时间** | ${AVG_DURATION_SECONDS}秒 | ≤150秒 | 优化依赖，并行化 |

---

**报告生成**: 自动化生成
**数据来源**: GitHub Actions API
**更新频率**: 建议每周生成一次

EOF

echo "✅ 报告已生成: $REPORT_FILE"
echo ""
echo "📄 查看报告: cat $REPORT_FILE"
echo "🌍 在 GitHub 上查看: (可上传到仓库)"

# 显示报告摘要
echo ""
echo "📊 报告摘要:"
echo "  成功率: ${SUCCESS_RATE}%"
echo "  平均耗时: ${AVG_DURATION_SECONDS}秒"
echo "  总运行次数: $TOTAL_COUNT"

echo ""
echo "✅ 性能报告生成完成！"