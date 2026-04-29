#!/bin/bash

# 新文档创建脚本
# 根据文件处置规则创建符合规范的新文档

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs"

# 显示使用说明
show_usage() {
    cat << EOF
📝 新文档创建脚本

用法: $0 <类型> <文件名> [标题]

类型选项:
  report    - 工作报告 (docs/reports/YYYY-MM/)
  plan      - 计划文档 (docs/plans/{category}/)
  guide     - 开发指南 (docs/guides/)
  architecture - 架构文档 (docs/architecture/)

示例:
  $0 report 2026-04-29-work-summary "今日工作总结"
  $0 plan refactor-new-features "新功能重构计划"
  $0 guide testing "测试指南"
  $0 architecture event-system "事件系统设计"

EOF
}

# 检查参数
if [ $# -lt 2 ]; then
    show_usage
    exit 1
fi

DOC_TYPE=$1
FILENAME=$2
TITLE=${3:-"未命名文档"}

# 获取当前日期
CURRENT_DATE=$(date +%Y-%m-%d)
CURRENT_YEAR_MONTH=$(date +%Y-%m)

# 根据类型确定目录
case $DOC_TYPE in
    report)
        TARGET_DIR="$DOCS_DIR/reports/$CURRENT_YEAR_MONTH"
        FULL_FILENAME="$CURRENT_DATE-$FILENAME.md"
        META_TYPE="report"
        ;;
    plan)
        read -p "请输入计划类别 (refactor/optimization/migration/feature): " category
        TARGET_DIR="$DOCS_DIR/plans/$category"
        FULL_FILENAME="$FILENAME.md"
        META_TYPE="plan"
        ;;
    guide)
        TARGET_DIR="$DOCS_DIR/guides"
        FULL_FILENAME="$FILENAME.md"
        META_TYPE="guide"
        ;;
    architecture)
        TARGET_DIR="$DOCS_DIR/architecture"
        FULL_FILENAME="$FILENAME.md"
        META_TYPE="architecture"
        ;;
    *)
        echo "❌ 未知的文档类型: $DOC_TYPE"
        show_usage
        exit 1
        ;;
esac

# 创建目录
mkdir -p "$TARGET_DIR"

# 目标文件路径
TARGET_FILE="$TARGET_DIR/$FULL_FILENAME"

# 检查文件是否已存在
if [ -f "$TARGET_FILE" ]; then
    echo "❌ 文件已存在: $TARGET_FILE"
    exit 1
fi

# 生成文档模板
cat > "$TARGET_FILE" << EOF
# $TITLE

> **创建日期**: $CURRENT_DATE
> **类型**: $META_TYPE
> **状态**: draft
> **标签**: #TODO

---

## 概述

<!-- 简要描述本文档的目的和范围 -->

---

## 正文内容

<!-- 在这里编写文档内容 -->

---

## 总结

<!-- 总结要点和后续行动 -->

---

**文档路径**: \`docs/$(realpath --relative-to="$DOCS_DIR" "$TARGET_FILE")\`
EOF

echo "✅ 文档创建成功: $TARGET_FILE"
echo ""
echo "📋 下一步:"
echo "   1. 编辑文档内容"
echo "   2. 更新状态 (draft → reviewed → archived)"
echo "   3. 添加相关标签"
echo "   4. 如需要，更新 docs/README.md"
