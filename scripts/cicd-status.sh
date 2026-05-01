#!/bin/bash
#
# 快速 CI/CD 状态检查
#

echo "═══════════════════════════════════════════════════════════════"
echo "  📊 YunPat CI/CD 状态"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "🖥️  Runner 状态:"
ssh xujian@100.91.197.114 '~/manage-runner.sh status' 2>/dev/null | grep -E "Runner|磁盘|进程" | head -10
echo ""

echo "🔄 最新运行:"
gh run list --limit 3 --json status,conclusion,displayTitle,updatedAt \
  --jq '.[] | "  \(.status): \(.displayTitle) | \(.updatedAt)"' 2>/dev/null
echo ""

echo "📈 运行统计:"
total_runs=$(gh run list --limit 100 2>/dev/null | wc -l)
success_runs=$(gh run list --limit 100 2>/dev/null | grep -c "success" || echo 0)
failed_runs=$(gh run list --limit 100 2>/dev/null | grep -c "failure" || echo 0)

echo "  • 总运行数: $total_runs"
echo "  • 成功: $success_runs"
echo "  • 失败: $failed_runs"
if [ $total_runs -gt 0 ]; then
  success_rate=$((success_runs * 100 / total_runs))
  echo "  • 成功率: ${success_rate}%"
fi
echo ""

echo "🔗 快速链接:"
echo "  • Actions: https://github.com/xujian519/yunpat/actions"
echo "  • Runner 设置: https://github.com/xujian519/yunpat/settings/actions"
echo ""

# 检查监控进程
monitor_pid=$(pgrep -f "monitor-cicd.sh" | head -1)
if [ -n "$monitor_pid" ]; then
  echo "👀 监控进程: 运行中 (PID: $monitor_pid)"
else
  echo "⚠️  监控进程: 未运行"
fi

echo "═══════════════════════════════════════════════════════════════"
