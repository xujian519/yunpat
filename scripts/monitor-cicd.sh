#!/bin/bash
#
# YunPat CI/CD 持续监控脚本
# 自动监控 CI/CD 运行状态并根据结果处理
#
# 使用方法:
#   ./scripts/monitor-cicd.sh [选项]
#
# 选项:
#   --interval N    检查间隔（秒），默认 30
#   --timeout N     总超时时间（秒），默认 600
#   --auto-fix      自动修复常见问题
#   --notify        发送通知
#   --verbose       详细输出
#

set -e

# 配置
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# 默认参数
CHECK_INTERVAL=30
TIMEOUT=600
AUTO_FIX=false
NOTIFY=false
VERBOSE=false

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --interval)
      CHECK_INTERVAL="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --auto-fix)
      AUTO_FIX=true
      shift
      ;;
    --notify)
      NOTIFY=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --help)
      echo "用法: $0 [选项]"
      echo ""
      echo "选项:"
      echo "  --interval N    检查间隔（秒），默认 30"
      echo "  --timeout N     总超时时间（秒），默认 600"
      echo "  --auto-fix      自动修复常见问题"
      echo "  --notify        发送通知"
      echo "  --verbose       详细输出"
      echo "  --help          显示此帮助信息"
      exit 0
      ;;
    *)
      echo "未知选项: $1"
      exit 1
      ;;
  esac
done

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 辅助函数
log_info() {
  echo -e "${BLUE}[$(date '+%H:%M:%S')] ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $1${NC}"
}

log_verbose() {
  if [ "$VERBOSE" = true ]; then
    echo -e "${BLUE}[$(date '+%H:%M:%S')] 🔍 $1${NC}"
  fi
}

# 检查 m4-air Runner 状态
check_runner_status() {
  log_verbose "检查 Runner 状态..."

  local runner_status=$(ssh xujian@100.91.197.114 '~/manage-runner.sh status' 2>/dev/null || echo "error")

  if echo "$runner_status" | grep -q "Runner 进程运行中"; then
    log_success "Runner 运行正常"
    return 0
  else
    log_error "Runner 状态异常"
    echo "$runner_status"
    return 1
  fi
}

# 获取最新运行信息
get_latest_run() {
  gh run list --limit 1 --json databaseId,status,conclusion,displayTitle,startedAt,workflowName \
    --jq '.[0] | {id: .databaseId, status: .status, conclusion: .conclusion, title: .displayTitle, started: .startedAt, workflow: .workflowName}'
}

# 获取运行日志
get_run_logs() {
  local run_id=$1
  gh run view "$run_id" --log 2>/dev/null || echo "无法获取日志"
}

# 检查运行状态
check_run_status() {
  local run_info=$1
  local status=$(echo "$run_info" | jq -r '.status')
  local conclusion=$(echo "$run_info" | jq -r '.conclusion')

  log_verbose "运行状态: $status, 结论: $conclusion"

  case $status in
    "queued")
      log_warning "运行排队中..."
      return 0
      ;;
    "in_progress")
      log_info "运行进行中..."
      return 0
      ;;
    "completed")
      if [ "$conclusion" = "success" ]; then
        log_success "运行成功！"
        return 0
      elif [ "$conclusion" = "failure" ]; then
        log_error "运行失败！"
        return 1
      elif [ "$conclusion" = "cancelled" ]; then
        log_warning "运行已取消"
        return 2
      else
        log_warning "运行完成，结论: $conclusion"
        return 0
      fi
      ;;
    *)
      log_warning "未知状态: $status"
      return 0
      ;;
  esac
}

# 分析失败原因
analyze_failure() {
  local run_id=$1
  log_info "分析失败原因..."

  local logs=$(get_run_logs "$run_id")

  # 常见失败模式
  if echo "$logs" | grep -q "Cannot find module"; then
    echo "依赖缺失"
  elif echo "$logs" | grep -q "EADDRINUSE\|port.*already.*in.*use"; then
    echo "端口占用"
  elif echo "$logs" | grep -q "ENOSPC\|no.*space.*left"; then
    echo "磁盘空间不足"
  elif echo "$logs" | grep -q "TypeError\|SyntaxError"; then
    echo "代码错误"
  elif echo "$logs" | grep -q "test.*failed\|AssertionError"; then
    echo "测试失败"
  elif echo "$logs" | grep -q "timeout\|TIMEDOUT"; then
    echo "超时"
  else
    echo "未知错误"
  fi
}

# 自动修复问题
auto_fix() {
  local issue=$1
  log_info "尝试自动修复: $issue"

  case $issue in
    "依赖缺失")
      log_info "安装依赖..."
      pnpm install
      ;;
    "端口占用")
      log_warning "需要手动检查端口占用"
      return 1
      ;;
    "磁盘空间不足")
      log_info "清理 Runner 工作目录..."
      ssh xujian@100.91.197.114 '~/manage-runner.sh clean'
      ;;
    "代码错误")
      log_warning "需要手动修复代码错误"
      return 1
      ;;
    "测试失败")
      log_warning "需要检查测试代码"
      return 1
      ;;
    "超时")
      log_info "增加超时时间并重试..."
      return 1
      ;;
    *)
      log_warning "无法自动修复，需要手动处理"
      return 1
      ;;
  esac
}

# 发送通知
send_notification() {
  local status=$1
  local message=$2

  if [ "$NOTIFY" = true ]; then
    # macOS 通知
    if command -v terminal-notifier &>/dev/null; then
      terminal-notifier -title "YunPat CI/CD" -message "$message" -sound default
    elif [[ "$OSTYPE" == "darwin"* ]]; then
      osascript -e "display notification \"$message\" with title \"YunPat CI/CD\" sound name \"default\""
    fi
  fi
}

# 生成报告
generate_report() {
  local run_info=$1
  local status=$2

  local run_id=$(echo "$run_info" | jq -r '.id')
  local title=$(echo "$run_info" | jq -r '.title')
  local workflow=$(echo "$run_info" | jq -r '.workflow')
  local started=$(echo "$run_info" | jq -r '.started')

  cat > "/tmp/cicd-report-$(date +%Y%m%d-%H%M%S).md" << EOF
# CI/CD 运行报告

**时间**: $(date '+%Y-%m-%d %H:%M:%S')
**工作流**: $workflow
**运行**: $title
**运行 ID**: $run_id
**开始时间**: $started
**状态**: $status

## 详情

- GitHub Actions: https://github.com/xujian519/yunpat/actions/runs/$run_id
- 查看日志: \`gh run view $run_id --log\`

EOF

  log_info "报告已生成: /tmp/cicd-report-$(date +%Y%m%d-%H%M%S).md"
}

# 主监控循环
main() {
  local start_time=$(date +%s)
  local check_count=0

  echo ""
  echo "=========================================="
  echo "  🔄 YunPat CI/CD 持续监控"
  echo "=========================================="
  echo ""
  log_info "开始监控..."
  log_info "检查间隔: ${CHECK_INTERVAL}秒"
  log_info "超时时间: ${TIMEOUT}秒"
  log_info "自动修复: $AUTO_FIX"
  echo ""

  # 初始检查 Runner 状态
  if ! check_runner_status; then
    log_error "Runner 状态异常，退出监控"
    exit 1
  fi

  # 获取最新运行
  log_info "获取最新运行信息..."
  local latest_run=$(get_latest_run)
  local run_id=$(echo "$latest_run" | jq -r '.id')
  local title=$(echo "$latest_run" | jq -r '.title')

  log_info "监控运行: $title (ID: $run_id)"
  echo ""

  # 监控循环
  while true; do
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))
    ((check_count++))

    log_verbose "检查 #$check_count (已运行: ${elapsed}秒)"

    # 检查超时
    if [ $elapsed -ge $TIMEOUT ]; then
      log_warning "监控超时 (${TIMEOUT}秒)"
      break
    fi

    # 重新获取运行状态
    latest_run=$(get_latest_run)
    local run_status=$(echo "$latest_run" | jq -r '.status')
    local conclusion=$(echo "$latest_run" | jq -r '.conclusion')

    # 显示当前状态
    case $run_status in
      "queued")
        echo -ne "\r${YELLOW}⏳ 排队中...${NC} (${elapsed}秒)"
        ;;
      "in_progress")
        echo -ne "\r${BLUE}🔄 运行中...${NC} (${elapsed}秒)"
        ;;
      "completed")
        echo -ne "\r"
        if check_run_status "$latest_run"; then
          log_success "CI/CD 运行成功！"
          generate_report "$latest_run" "success"
          send_notification "success" "CI/CD 运行成功"
          exit 0
        else
          log_error "CI/CD 运行失败！"
          local failure_reason=$(analyze_failure "$run_id")
          log_error "失败原因: $failure_reason"

          generate_report "$latest_run" "failure: $failure_reason"

          if [ "$AUTO_FIX" = true ]; then
            if auto_fix "$failure_reason"; then
              log_success "自动修复成功，可以重试"
            else
              log_warning "无法自动修复，需要手动处理"
            fi
          fi

          send_notification "failure" "CI/CD 失败: $failure_reason"
          exit 1
        fi
        ;;
    esac

    # 等待下一次检查
    sleep $CHECK_INTERVAL
  done

  echo ""
  log_warning "监控结束"
}

# 运行主程序
main
