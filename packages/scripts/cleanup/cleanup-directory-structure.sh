#!/bin/bash
# YunPat 目录结构整理脚本
#
# 用途：按照规范整理项目目录结构
# 执行：./scripts/cleanup-directory-structure.sh
# 注意：执行前请先阅读 DIRECTORY_STRUCTURE_AUDIT.md

set -e

echo "🔧 YunPat 目录结构整理脚本"
echo "================================"
echo "⚠️  重要提示："
echo "1. 请确保已提交所有更改"
echo "2. 建议创建备份分支"
echo "3. 执行前请先阅读 DIRECTORY_STRUCTURE_AUDIT.md"
echo ""
read -p "是否继续？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消操作"
    exit 1
fi

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 开始整理...${NC}"
echo ""

# 阶段 1: 清理 .DS_Store 文件
echo "🔍 阶段 1: 清理 .DS_Store 文件"
echo "-----------------------------------"
find . -name ".DS_Store" -type f -print -delete
echo "✅ .DS_Store 文件已清理"
echo ""

# 更新 .gitignore
if ! grep -q "**/.DS_Store" .gitignore; then
    echo "**/.DS_Store" >> .gitignore
    echo "✅ 已添加 **/.DS_Store 到 .gitignore"
else
    echo "ℹ️  .gitignore 已包含 **/.DS_Store"
fi
echo ""

# 阶段 2: 创建目录结构
echo "📁 阶段 2: 创建目录结构"
echo "-----------------------------------"
mkdir -p docs/ci/reports
mkdir -p docs/quality/reports
mkdir -p docs/testing/reports
mkdir -p docs/meta/reports
mkdir -p test/integration
mkdir -p test/unit
mkdir -p test/scripts
echo "✅ 目录结构已创建"
echo ""

# 阶段 3: 移动 CI 相关文件
echo "📦 阶段 3: 移动 CI 相关文件"
echo "-----------------------------------"
if [ -f "CI_MONITORING_GUIDE.md" ]; then
    mv CI_MONITORING_GUIDE.md docs/ci/
    echo "✅ 已移动 CI_MONITORING_GUIDE.md"
fi

if [ -f "CI_FAILURE_INVESTIGATION.md" ]; then
    mv CI_FAILURE_INVESTIGATION.md docs/ci/
    echo "✅ 已移动 CI_FAILURE_INVESTIGATION.md"
fi

if [ -f "CI_OPTIMIZATION_PLAN.md" ]; then
    mv CI_OPTIMIZATION_PLAN.md docs/ci/
    echo "✅ 已移动 CI_OPTIMIZATION_PLAN.md"
fi

if [ -f "CI_OPTIMIZATION_RESULTS.md" ]; then
    mv CI_OPTIMIZATION_RESULTS.md docs/ci/
    echo "✅ 已移动 CI_OPTIMIZATION_RESULTS.md"
fi

if [ -f "CI_MONITORING_REPORT_20260501.md" ]; then
    mv CI_MONITORING_REPORT_20260501.md docs/ci/reports/
    echo "✅ 已移动 CI_MONITORING_REPORT_20260501.md"
fi
echo ""

# 阶段 4: 移动质量相关文件
echo "📦 阶段 4: 移动质量相关文件"
echo "-----------------------------------"
if [ -f "CODE_QUALITY_CHECKLIST.md" ]; then
    mv CODE_QUALITY_CHECKLIST.md docs/quality/
    echo "✅ 已移动 CODE_QUALITY_CHECKLIST.md"
fi

if [ -f "CODE_QUALITY_IMPROVEMENTS.md" ]; then
    mv CODE_QUALITY_IMPROVEMENTS.md docs/quality/
    echo "✅ 已移动 CODE_QUALITY_IMPROVEMENTS.md"
fi

if [ -f "CODE_QUALITY_VERIFICATION_REPORT.md" ]; then
    mv CODE_QUALITY_VERIFICATION_REPORT.md docs/quality/
    echo "✅ 已移动 CODE_QUALITY_VERIFICATION_REPORT.md"
fi

if [ -f "QUALITY_CHECK_SUMMARY.txt" ]; then
    mv QUALITY_CHECK_SUMMARY.txt docs/quality/reports/
    echo "✅ 已移动 QUALITY_CHECK_SUMMARY.txt"
fi

# 移动中文质量报告
if [ -f "代码审查报告.md" ]; then
    mv 代码审查报告.md docs/quality/reports/
    echo "✅ 已移动 代码审查报告.md"
fi

if [ -f "代码质量审查报告.md" ]; then
    mv 代码质量审查报告.md docs/quality/reports/
    echo "✅ 已移动 代码质量审查报告.md"
fi

if [ -f "最终验证报告.md" ]; then
    mv 最终验证报告.md docs/quality/reports/
    echo "✅ 已移动 最终验证报告.md"
fi
echo ""

# 阶段 5: 移动测试相关文件
echo "📦 阶段 5: 移动测试相关文件"
echo "-----------------------------------"
if [ -f "LLM_TESTING_REPORT.md" ]; then
    mv LLM_TESTING_REPORT.md docs/testing/reports/
    echo "✅ 已移动 LLM_TESTING_REPORT.md"
fi
echo ""

# 阶段 6: 移动元信息文件
echo "📦 阶段 6: 移动元信息文件"
echo "-----------------------------------"
if [ -f "DOCS_UPDATE_SUMMARY.md" ]; then
    mv DOCS_UPDATE_SUMMARY.md docs/meta/reports/
    echo "✅ 已移动 DOCS_UPDATE_SUMMARY.md"
fi

if [ -f "项目总结报告.md" ]; then
    mv 项目总结报告.md docs/meta/reports/
    echo "✅ 已移动 项目总结报告.md"
fi

if [ -f "阶段5进度报告.md" ]; then
    mv 阶段5进度报告.md docs/meta/reports/
    echo "✅ 已移动 阶段5进度报告.md"
fi
echo ""

# 阶段 7: 移动根目录测试文件
echo "📦 阶段 7: 移动根目录测试文件"
echo "-----------------------------------"
if [ -f "test-agent-coordination.ts" ]; then
    mv test-agent-coordination.ts test/integration/
    echo "✅ 已移动 test-agent-coordination.ts"
fi

if [ -f "test-integration.js" ]; then
    mv test-integration.js test/integration/
    echo "✅ 已移动 test-integration.js"
fi

if [ -f "test-multi-agent-simple.ts" ]; then
    mv test-multi-agent-simple.ts test/integration/
    echo "✅ 已移动 test-multi-agent-simple.ts"
fi

if [ -f "test-multi-agent-temp.ts" ]; then
    mv test-multi-agent-temp.ts test/integration/
    echo "✅ 已移动 test-multi-agent-temp.ts"
fi

if [ -f "test-code-quality-fixes.ts" ]; then
    mv test-code-quality-fixes.ts test/unit/
    echo "✅ 已移动 test-code-quality-fixes.ts"
fi

if [ -f "test-tool-selection.js" ]; then
    mv test-tool-selection.js test/unit/
    echo "✅ 已移动 test-tool-selection.js"
fi

# 移动测试脚本
for script in test-*.sh; do
    if [ -f "$script" ]; then
        mv "$script" test/scripts/
        echo "✅ 已移动 $script"
    fi
done
echo ""

# 阶段 8: 整理 docs/ 根目录文件
echo "📦 阶段 8: 整理 docs/ 根目录文件"
echo "-----------------------------------"
cd docs

# 创建 reports 目录（如果不存在）
mkdir -p reports

# 移动报告文件
for report in *_REPORT.md *_报告.md; do
    if [ -f "$report" ]; then
        case "$report" in
            "DOCS_UPDATE_SUMMARY.md"|"项目总结报告.md"|"阶段5进度报告.md")
                # 这些已经在 meta/reports 中
                ;;
            *)
                mv "$report" reports/ 2>/dev/null && echo "✅ 已移动 $report"
                ;;
        esac
    fi
done

cd ..
echo ""

# 完成
echo "================================"
echo -e "${GREEN}✅ 目录结构整理完成！${NC}"
echo ""
echo "📊 整理结果："
echo "  - .DS_Store 文件已清理"
echo "  - CI 相关文件已移动到 docs/ci/"
echo "  - 质量相关文件已移动到 docs/quality/"
echo "  - 测试相关文件已移动到 docs/testing/"
echo "  - 元信息文件已移动到 docs/meta/"
echo "  - 根目录测试文件已移动到 test/"
echo ""
echo "🔍 下一步："
echo "  1. 检查文件移动是否正确"
echo "  2. 运行测试确保无破坏："
echo "     pnpm test"
echo "  3. 提交变更："
echo "     git add ."
echo "     git commit -m 'chore: 整理目录结构'"
echo "     git push"
echo ""
echo "📚 详细说明请查看："
echo "  - DIRECTORY_STRUCTURE_AUDIT.md"
echo ""
