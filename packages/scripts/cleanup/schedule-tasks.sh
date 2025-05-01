#!/bin/bash

# YunPat 定期任务配置脚本
#
# 使用方法：
# 1. 将此脚本添加到 crontab: crontab -e
# 2. 或使用 macOS launchd
# 3. 或使用 GitHub Actions

# 项目根目录
PROJECT_DIR="/Users/xujian/projects/YunPat"

# 日志目录
LOG_DIR="$PROJECT_DIR/logs/scheduled-tasks"

# 创建日志目录
mkdir -p "$LOG_DIR"

echo "=========================================="
echo "YunPat 定期任务"
echo "执行时间: $(date)"
echo "=========================================="
echo ""

# 函数：运行文档同步检查
run_doc_check() {
  echo "📄 运行文档同步检查..."
  cd "$PROJECT_DIR"
  node scripts/check-doc-sync.js > "$LOG_DIR/doc-check-$(date +%Y%m%d).log" 2>&1
  echo "✅ 文档检查完成"
}

# 函数：运行每周审查
run_weekly_review() {
  echo "📅 运行每周审查..."
  cd "$PROJECT_DIR"
  node scripts/weekly-review.js > "$LOG_DIR/weekly-review-$(date +%Y%m%d).log" 2>&1
  echo "✅ 每周审查完成"
}

# 函数：生成文档
generate_docs() {
  echo "📚 生成文档..."
  cd "$PROJECT_DIR"
  node scripts/generate-docs.js > "$LOG_DIR/doc-generation-$(date +%Y%m%d).log" 2>&1
  echo "✅ 文档生成完成"
}

# 函数：评估完成度
evaluate_completion() {
  echo "📊 评估完成度..."
  cd "$PROJECT_DIR"
  node scripts/evaluate-completion.js > "$LOG_DIR/completion-$(date +%Y%m%d).log" 2>&1
  echo "✅ 完成度评估完成"
}

# 主函数
main() {
  local task_type=$1

  case $task_type in
    "doc-check")
      run_doc_check
      ;;
    "weekly-review")
      run_weekly_review
      ;;
    "generate-docs")
      generate_docs
      ;;
    "evaluate-completion")
      evaluate_completion
      ;;
    "all")
      echo "🚀 运行所有任务..."
      run_doc_check
      evaluate_completion
      generate_docs
      run_weekly_review
      ;;
    *)
      echo "使用方法: $0 [task_type]"
      echo ""
      echo "任务类型:"
      echo "  doc-check          - 文档同步检查"
      echo "  weekly-review      - 每周审查"
      echo "  generate-docs      - 生成文档"
      echo "  evaluate-completion - 评估完成度"
      echo "  all                - 运行所有任务"
      echo ""
      echo "示例:"
      echo "  $0 doc-check"
      echo "  $0 weekly-review"
      echo "  $0 all"
      exit 1
      ;;
  esac

  echo ""
  echo "=========================================="
  echo "任务完成: $(date)"
  echo "=========================================="
}

# 运行主函数
main "$@"
