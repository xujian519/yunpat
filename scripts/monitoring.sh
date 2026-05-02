#!/bin/bash
# CI/CD 高级监控脚本
# 用法: ./scripts/monitoring.sh [slack_webhook_url]

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

WEBHOOK_URL=${1:-""}

echo -e "${BLUE}=== CI/CD 高级监控 ===${NC}"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 函数：获取 CI 统计
get_ci_stats() {
    echo -e "${BLUE}## CI 统计${NC}"
    
    # 最近 20 次运行
    TOTAL_RUNS=$(gh run list --repo xujian519/yunpat --limit 20 --json conclusion | jq 'length')
    SUCCESS_RUNS=$(gh run list --repo xujian519/yunpat --limit 20 --json conclusion | jq '[.[] | select(.conclusion == "success")] | length')
    FAILED_RUNS=$(gh run list --repo xujian519/yunpat --limit 20 --json conclusion | jq '[.[] | select(.conclusion == "failure")] | length')
    CANCELLED_RUNS=$(gh run list --repo xujian519/yunpat --limit 20 --json conclusion | jq '[.[] | select(.conclusion == "cancelled")] | length')
    
    SUCCESS_RATE=$(echo "scale=1; $SUCCESS_RUNS * 100 / $TOTAL_RUNS" | bc 2>/dev/null || echo "0")
    
    echo "总运行数: $TOTAL_RUNS"
    echo "成功: $SUCCESS_RUNS (${SUCCESS_RATE}%)"
    echo "失败: $FAILED_RUNS"
    echo "取消: $CANCELLED_RUNS"
    echo ""
}

# 函数：获取平均执行时间
get_avg_duration() {
    echo -e "${BLUE}## 平均执行时间${NC}"
    
    # 获取最近 10 次成功运行的耗时
    DURATIONS=$(gh run list --repo xujian519/yunpat --limit 10 --json conclusion,updatedAt | \
        jq -r '.[] | select(.conclusion == "success") | .updatedAt' | \
        while read timestamp; do
            # 计算运行时长（简化版）
            echo "$timestamp"
        done | wc -l)
    
    echo "最近 10 次成功运行: $DURATIONS 次"
    echo ""
}

# 函数：检查 Runner 健康
check_runner_health() {
    echo -e "${BLUE}## Runner 健康检查${NC}"
    
    # 执行资源监控
    if [ -f "./scripts/monitor-resources.sh" ]; then
        ./scripts/monitor-resources.sh | head -20
    fi
    
    echo ""
}

# 函数：检测异常模式
detect_anomalies() {
    echo -e "${BLUE}## 异常检测${NC}"
    
    # 检查是否有连续失败
    RECENT_FAILURES=$(gh run list --repo xujian519/yunpat --limit 5 --json conclusion | \
        jq -r '[.[] | select(.conclusion == "failure")] | length')
    
    if [ "$RECENT_FAILURES" -ge 3 ]; then
        echo -e "${RED}⚠️ 警告: 最近 5 次运行中有 $RECENT_FAILURES 次失败${NC}"
    fi
    
    # 检查是否有长时间运行
    LONG_RUNNING=$(gh run list --repo xujian519/yunpat --limit 3 --json status,createdAt | \
        jq -r '.[] | select(.status == "in_progress") | .createdAt' | \
        while read created; do
            # 计算运行时长（分钟）
            created_ts=$(date -j "$created" +%s)
            now_ts=$(date +%s)
            duration=$(( (now_ts - created_ts) / 60 ))
            if [ $duration -gt 60 ]; then
                echo -e "${YELLOW}⚠️ 警告: 有运行已进行 $duration 分钟${NC}"
            fi
        done)
    
    echo ""
}

# 函数：发送通知
send_notification() {
    local status=$1
    local message=$2
    
    if [ -z "$WEBHOOK_URL" ]; then
        echo "⚠️ 未配置 Webhook URL，跳过通知"
        return
    fi
    
    echo "📢 发送通知..."
    
    # 根据状态设置颜色
    case $status in
        "success")
            color="#36a64f"  # 蓝色
            emoji="✅"
            ;;
        "failure")
            color="#ef4444"  # 红色
            emoji="❌"
            ;;
        "warning")
            color="#f59e0b"  # 橙色
            emoji="⚠️"
            ;;
        *)
            color="#6b7280"  # 灰色
            emoji="ℹ️"
            ;;
    esac
    
    # 发送 Slack 通知
    curl -X POST "$WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"$emoji CI/CD $message\",
            \"attachments\": [{
                \"color\": \"$color\",
                \"title\": \"YunPat CI/CD 通知\",
                \"text\": \"$message\n时间: $(date '+%Y-%m-%d %H:%M:%S')\n仓库: xujian519/yunpat\"
            }]
        }" 2>/dev/null || echo "⚠️ 通知发送失败"
}

# 主监控流程
main() {
    # 检查异常
    detect_anomalies
    
    # 获取统计
    get_ci_stats
    
    # 检查 Runner
    check_runner_health
    
    # 获取执行时间
    get_avg_duration
    
    echo -e "${GREEN}=== 监控完成 ===${NC}"
    
    # 如果检测到问题，发送警告通知
    if [ "$RECENT_FAILURES" -ge 3 ]; then
        send_notification "warning" "最近失败率较高，需要关注"
    fi
}

# 运行监控
main "$@"
