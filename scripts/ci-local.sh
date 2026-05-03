#!/bin/bash
#
# 本地 CI 检查脚本
# 用法: ./scripts/ci-local.sh [full|quick]
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
MODE=${1:-"quick"}
START_TIME=$(date +%s)

echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════════════════"
echo "   🚀 YunPat 本地 CI 检查"
echo "   模式: $MODE"
echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════════"
echo -e "${NC}"

# 统计变量
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
SKIPPED_CHECKS=0

# 检查函数
check() {
    local name=$1
    local command=$2
    local critical=${3:-true}  # 是否关键检查（失败则终止）

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    echo -e "${BLUE}[$TOTAL_CHECKS] 检查:${NC} $name"

    if eval "$command" > /tmp/ci_check_output.log 2>&1; then
        echo -e "  ${GREEN}✓ 通过${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "  ${RED}✗ 失败${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))

        # 显示错误详情
        if [ -s /tmp/ci_check_output.log ]; then
            echo -e "  ${YELLOW}错误信息:${NC}"
            tail -5 /tmp/ci_check_output.log | sed 's/^/    /'
        fi

        if [ "$critical" = "true" ]; then
            echo -e "  ${RED}❌ 关键检查失败，终止 CI${NC}"
            return 1
        fi
        return 0
    fi
}

# 检查是否可以跳过
can_skip() {
    local check_name=$1
    local reason=$2

    if [ "$MODE" = "quick" ]; then
        echo -e "  ${YELLOW}⊘ 跳过 ($reason)${NC}"
        SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
        return 0
    fi
    return 1
}

# ========== 1. 环境检查 ==========
echo -e "\n${CYAN}📋 环境检查${NC}"

check "Node.js 版本" "node --version | grep -qE 'v(18|20|22)' || (echo '需要 Node.js 18+ 版本' && exit 1)"
check "pnpm 版本" "pnpm --version | grep -qE '[89]|10' || (echo '需要 pnpm 8+ 版本' && exit 1)"
check "Git 状态" "git diff --quiet || git diff --cached --quiet || (echo '有未提交的变更' && exit 1)" false

# ========== 2. 代码质量检查 ==========
echo -e "\n${CYAN}🔍 代码质量检查${NC}"

# Prettier 格式检查
if [ -f ".prettierrc" ] || [ -f ".prettierrc.json" ] || [ -f ".prettier.config.js" ]; then
    check "Prettier 格式检查" "pnpm format:check"
else
    can_skip "Prettier" "未配置"
fi

# ESLint 检查
check "ESLint 代码质量" "pnpm lint"

# TypeScript 类型检查
if [ "$MODE" = "full" ]; then
    check "TypeScript 类型检查" "pnpm type-check"
else
    can_skip "TypeScript" "快速模式"
fi

# ========== 3. 测试检查 ==========
echo -e "\n${CYAN}🧪 测试检查${NC}"

# 单元测试
if can_skip "单元测试" "快速模式（运行核心测试）"; then
    check "核心单元测试" "pnpm test:unit" false
else
    check "完整单元测试" "pnpm test" false
fi

# 测试覆盖率（仅完整模式）
if [ "$MODE" = "full" ]; then
    check "测试覆盖率" "pnpm test:coverage" false
else
    can_skip "测试覆盖率" "快速模式"
fi

# ========== 4. 构建检查 ==========
echo -e "\n${CYAN}🏗️  构建检查${NC}"

# 清理旧构建
echo -e "  ${BLUE}清理旧构建...${NC}"
rm -rf packages/*/dist node_modules/.cache 2>/dev/null || true

# 构建项目
check "项目构建" "pnpm build"

# 验证构建产物
echo -e "  ${BLUE}验证构建产物...${NC}"
BUILD_ERRORS=0
if [ ! -d "packages/core/dist" ]; then
    echo -e "    ${RED}✗ 核心包构建产物缺失${NC}"
    BUILD_ERRORS=$((BUILD_ERRORS + 1))
fi

if [ $BUILD_ERRORS -eq 0 ]; then
    echo -e "    ${GREEN}✓ 构建产物验证通过${NC}"
else
    echo -e "    ${RED}✗ 构建产物验证失败${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# ========== 5. 安全检查（完整模式） ==========
if [ "$MODE" = "full" ]; then
    echo -e "\n${CYAN}🔒 安全检查${NC}"

    check "依赖安全审计" "pnpm audit --audit-level moderate" false

    # 检查敏感文件
    echo -e "  ${BLUE}检查敏感文件...${NC}"
    SENSITIVE_FILES=$(git ls-files | grep -E '\.(env|pem|key)$' || true)
    if [ -n "$SENSITIVE_FILES" ]; then
        echo -e "    ${YELLOW}⚠ 发现敏感文件:${NC}"
        echo "$SENSITIVE_FILES" | sed 's/^/      /'
        echo -e "    ${YELLOW}请确保这些文件应该被提交${NC}"
    else
        echo -e "    ${GREEN}✓ 未发现敏感文件${NC}"
    fi
fi

# ========== 6. 代码统计 ==========
echo -e "\n${CYAN}📊 代码统计${NC}"

# 统计变更
if git rev-parse --git-dir > /dev/null 2>&1; then
    CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | wc -l | tr -d ' ')
    ADDED_LINES=$(git diff HEAD~1 HEAD 2>/dev/null | grep -c "^+" || echo "0")
    DELETED_LINES=$(git diff HEAD~1 HEAD 2>/dev/null | grep -c "^-" || echo "0")

    echo "  变更文件: $CHANGED_FILES 个"
    echo "  新增代码: +$ADDED_LINES 行"
    echo "  删除代码: -$DELETED_LINES 行"
fi

# 统计包数量
PACKAGES=$(find packages -name "package.json" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "  项目包数: $PACKAGES 个"

# ========== 总结 ==========
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   📊 CI 检查总结${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  总检查数: $TOTAL_CHECKS"
echo -e "  ${GREEN}通过: $PASSED_CHECKS${NC}"
echo -e "  ${RED}失败: $FAILED_CHECKS${NC}"
echo -e "  ${YELLOW}跳过: $SKIPPED_CHECKS${NC}"
echo "  执行时间: ${DURATION}s"
echo ""

# 判断总体状态
if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "  ${GREEN}✅ CI 检查全部通过${NC}"
    echo ""
    echo "  🎉 可以安全提交和推送代码"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "  ${RED}❌ CI 检查失败${NC}"
    echo ""
    echo "  建议："
    echo "    • 运行 'pnpm lint:fix' 修复 lint 问题"
    echo "    • 运行 'pnpm format' 修复格式问题"
    echo "    • 运行 'pnpm test' 查看测试详情"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    exit 1
fi
