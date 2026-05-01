#!/bin/bash
#
# YunPat 项目清理脚本
# 安全清理项目中的冗余文件和临时文件
#
# 使用方法:
#   ./scripts/cleanup.sh [--dry-run] [--safe] [--aggressive]
#
# 选项:
#   --dry-run      预览将要执行的操作（不实际执行）
#   --safe         只执行安全清理（默认）
#   --aggressive   执行所有清理（包括归档）
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# 模式
DRY_RUN=false
MODE="safe"

# 解析参数
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --safe)
      MODE="safe"
      shift
      ;;
    --aggressive)
      MODE="aggressive"
      shift
      ;;
    --help)
      echo "用法: $0 [选项]"
      echo ""
      echo "选项:"
      echo "  --dry-run      预览将要执行的操作（不实际执行）"
      echo "  --safe         只执行安全清理（默认）"
      echo "  --aggressive   执行所有清理（包括归档）"
      echo "  --help         显示此帮助信息"
      exit 0
      ;;
  esac
done

# 辅助函数
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

# 执行命令（支持 dry-run）
run_cmd() {
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN]${NC} $1"
  else
    eval "$1"
  fi
}

# 统计函数
count_files() {
  find . -name "$1" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l
}

# ==================== 主要清理逻辑 ====================

echo ""
echo "=========================================="
echo "  🧹 YunPat 项目清理脚本"
echo "=========================================="
echo ""
echo "项目目录: $PROJECT_DIR"
echo "模式: $MODE"
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}⚠️  DRY-RUN 模式：不会实际执行删除操作${NC}"
fi
echo ""

# ==================== 阶段 1: 安全清理 ====================

log_info "阶段 1: 安全清理（无风险操作）"
echo ""

# 1.1 清理构建产物
log_info "清理构建产物..."

dist_count=$(find packages/ examples/ -type d -name "dist" 2>/dev/null | wc -l)
log_info "找到 $dist_count 个 dist/ 目录"

if [ "$dist_count" -gt 0 ]; then
  run_cmd "find packages/ examples/ -type d -name 'dist' -exec rm -rf {} + 2>/dev/null || true"
  log_success "已清理 dist/ 目录"
fi

# 1.2 清理 Rust 编译产物
if [ -d "packages/rust-tools/target" ]; then
  log_info "清理 Rust 编译产物..."
  run_cmd "rm -rf packages/rust-tools/target/"
  log_success "已清理 target/ 目录"
fi

# 1.3 删除备份文件
backup_count=$(find . -name "*.bak" -o -name "*.backup" -o -name "*.old" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l)
if [ "$backup_count" -gt 0 ]; then
  log_info "找到 $backup_count 个备份文件"
  run_cmd "find . -name '*.bak' -o -name '*.backup' -o -name '*.old' | xargs rm -f 2>/dev/null || true"
  log_success "已删除备份文件"
fi

# 1.4 清理空目录
empty_count=$(find . -type d -empty -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l)
if [ "$empty_count" -gt 0 ]; then
  log_info "找到 $empty_count 个空目录"
  run_cmd "find . -type d -empty -not -path '*/node_modules/*' -not -path '*/.git/*' -delete 2>/dev/null || true"
  log_success "已清理空目录"
fi

echo ""

# ==================== 阶段 2: 归档（仅 aggressive 模式） ====================

if [ "$MODE" = "aggressive" ]; then
  log_info "阶段 2: 归档临时文档"
  echo ""

  # 2.1 创建归档目录
  archive_dir_reports="docs/archive/reports-$(date +%Y-%m)"
  archive_dir_plans="docs/archive/plans-$(date +%Y-%m-%d)"

  run_cmd "mkdir -p $archive_dir_reports"
  run_cmd "mkdir -p $archive_dir_plans"

  # 2.2 归档临时报告
  log_info "归档临时报告..."

  temp_reports=(
    "test-fix-instructions.md"
    "test-timeout-fix.md"
    "git-commit-report-20260501.md"
    "env-update-20260501.md"
    "cicd-fix-progress-20260501.md"
    "test-fixes-final-20260501.md"
  )

  archived_count=0
  for report in "${temp_reports[@]}"; do
    if [ -f "docs/reports/$report" ]; then
      run_cmd "mv docs/reports/$report $archive_dir_reports/"
      ((archived_count++))
    fi
  done

  log_success "已归档 $archived_count 个临时报告"

  # 2.3 归档碎片化进度更新
  log_info "归档碎片化进度更新..."

  progress_count=$(find docs/plans/ -name "progress-*.md" 2>/dev/null | wc -l)
  if [ "$progress_count" -gt 0 ]; then
    run_cmd "find docs/plans/ -name 'progress-*.md' -exec mv {} $archive_dir_plans/ \\; 2>/dev/null || true"
    log_success "已归档 $progress_count 个进度文件"
  fi

  echo ""
fi

# ==================== 阶段 3: Git 优化（仅 aggressive 模式） ====================

if [ "$MODE" = "aggressive" ]; then
  log_info "阶段 3: Git 优化"
  echo ""

  # 3.1 从 git 跟踪中移除知识库
  if [ -d "knowledge-base" ]; then
    log_info "从 git 跟踪中移除知识库..."
    run_cmd "git rm -r --cached knowledge-base/ 2>/dev/null || true"
    log_success "已从 git 跟踪中移除知识库"
  fi

  echo ""
fi

# ==================== 清理统计 ====================

echo "=========================================="
echo "  📊 清理统计"
echo "=========================================="
echo ""

if [ "$DRY_RUN" = false ]; then
  # 统计当前状态
  current_dist=$(find packages/ examples/ -type d -name "dist" 2>/dev/null | wc -l)
  current_backups=$(find . -name "*.bak" -o -name "*.backup" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l)
  current_empty=$(find . -type d -empty -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l)

  log_success "清理完成！"
  echo ""
  echo "当前状态:"
  echo "  • dist/ 目录: $current_dist"
  echo "  • 备份文件: $current_backups"
  echo "  • 空目录: $current_empty"
  echo ""

  if [ "$MODE" = "aggressive" ]; then
    log_info "下一步:"
    echo "  1. 检查 git diff 确认更改"
    echo "  2. 运行测试确保功能正常: pnpm test"
    echo "  3. 提交更改: git add . && git commit -m 'chore: 项目清理'"
    echo ""
  fi
else
  log_warning "DRY-RUN 模式：未实际执行删除操作"
  echo ""
  echo "要执行实际清理，请运行:"
  echo "  ./scripts/cleanup.sh --safe"
  echo "  或"
  echo "  ./scripts/cleanup.sh --aggressive"
  echo ""
fi

echo "=========================================="
