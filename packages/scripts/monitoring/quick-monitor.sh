#!/bin/bash
# 快速 CI/CD 状态检查（无延迟版本）

echo "🔄 CI/CD 快速状态检查"
echo "===================="
echo ""

# 检查 Runner 实际状态
echo "🖥️  Runner 实际状态:"
RUNNER_LOG=$(ssh xujian@100.91.197.114 "tail -5 ~/actions-runner/_diag/Runner_*.log 2>/dev/null" | grep -E "Running job|Job completed" | tail -1)

if [ -n "$RUNNER_LOG" ]; then
  echo "  $RUNNER_LOG"
else
  echo "  无活动任务"
fi
echo ""

# 检查最新运行
echo "📊 GitHub API 状态:"
LATEST_RUN=$(gh run list --limit 1 --json status,conclusion,displayTitle --jq '.[0]')
echo "$LATEST_RUN" | jq -r '"  状态: \(.status)\n  结论: \(.conclusion // "进行中")\n  运行: \(.displayTitle)"'
echo ""

echo "💡 建议:"
echo "  • GitHub API 可能有延迟"
echo "  • 请在浏览器中查看实时状态:"
echo "    https://github.com/xujian519/yunpat/actions"
echo ""

# 检查工作目录
echo "📂 工作目录:"
WORK_COUNT=$(ssh xujian@100.91.197.114 "ls ~/actions-runner/_work/_temp/ 2>/dev/null | wc -l")
echo "  临时目录数: $WORK_COUNT"
