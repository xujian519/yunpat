#!/bin/bash
# CI/CD 健康检查脚本
# 用法: ./scripts/ci-health-check.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCORE=100

echo -e "${BLUE}=== CI/CD 系统健康检查 ===${NC}"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 检查 1: Workflow 文件
echo -e "${BLUE}## 1. Workflow 文件检查${NC}"
WORKFLOW_FILES=(
    ".github/workflows/ci-stable.yml"
    ".github/workflows/deploy.yml"
    ".github/workflows/monitoring.yml"
)

for file in "${WORKFLOW_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ✅ $file"
    else
        echo -e "  ❌ $file (缺失)"
        SCORE=$((SCORE - 10))
    fi
done
echo ""

# 检查 2: 脚本文件
echo -e "${BLUE}## 2. 脚本文件检查${NC}"
SCRIPT_FILES=(
    "scripts/deploy.sh"
    "scripts/monitor-resources.sh"
    "scripts/monitoring.sh"
    "scripts/build-rust.sh"
)

for script in "${SCRIPT_FILES[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            echo -e "  ✅ $script (可执行)"
        else
            echo -e "  ⚠️  $script (不可执行)"
            chmod +x "$script"
            echo -e "     已修复为可执行"
        fi
    else
        echo -e "  ❌ $script (缺失)"
        SCORE=$((SCORE - 10))
    fi
done
echo ""

# 检查 3: Runner 状态
echo -e "${BLUE}## 3. Runner 状态检查${NC}"
RUNNER_INFO=$(gh api repos/xujian519/yunpat/actions/runners 2>/dev/null)
if [ $? -eq 0 ]; then
    RUNNER_NAME=$(echo "$RUNNER_INFO" | jq -r '.runners[0].name')
    RUNNER_STATUS=$(echo "$RUNNER_INFO" | jq -r '.runners[0].status')
    RUNNER_OS=$(echo "$RUNNER_INFO" | jq -r '.runners[0].os')
    
    if [ "$RUNNER_STATUS" = "online" ]; then
        echo -e "  ✅ Runner: $RUNNER_NAME"
        echo -e "     状态: $RUNNER_STATUS"
        echo -e "     平台: $RUNNER_OS"
    else
        echo -e "  ⚠️  Runner: $RUNNER_NAME (状态: $RUNNER_STATUS)"
        SCORE=$((SCORE - 20))
    fi
else
    echo -e "  ❌ 无法获取 Runner 状态"
    SCORE=$((SCORE - 20))
fi
echo ""

# 检查 4: 最近 CI 运行
echo -e "${BLUE}## 4. 最近 CI 运行检查${NC}"
RECENT_RUNS=$(gh run list --repo xujian519/yunpat --limit 10 --json conclusion | jq 'length')
if [ "$RECENT_RUNS" -gt 0 ]; then
    SUCCESS_COUNT=$(gh run list --repo xujian519/yunpat --limit 10 --json conclusion | jq '[.[] | select(.conclusion == "success")] | length')
    SUCCESS_RATE=$((SUCCESS_COUNT * 100 / RECENT_RUNS))
    
    echo -e "  📊 最近 10 次运行: $RECENT_RUNS"
    echo -e "  ✅ 成功: $SUCCESS_COUNT"
    echo -e "  📈 成功率: ${SUCCESS_RATE}%"
    
    if [ "$SUCCESS_RATE" -lt 80 ]; then
        echo -e "  ⚠️  成功率低于 80%"
        SCORE=$((SCORE - 15))
    elif [ "$SUCCESS_RATE" -lt 95 ]; then
        echo -e "  🟡 成功率未达 95%"
        SCORE=$((SCORE - 5))
    fi
else
    echo -e "  ⚠️  没有找到最近的 CI 运行"
    SCORE=$((SCORE - 10))
fi
echo ""

# 检查 5: 磁盘空间
echo -e "${BLUE}## 5. 磁盘空间检查${NC}"
DISK_INFO=$(df -h . | tail -1 | awk '{print $4}')
# 提取数字部分 (处理 "473G" 或 "473i" 等格式)
DISK_AVAILABLE=$(echo "$DISK_INFO" | sed 's/[^0-9.]//g' | sed 's/i//g' | cut -d'.' -f1)

if [ -n "$DISK_AVAILABLE" ] && [ "$DISK_AVAILABLE" -lt 10 ]; then
    echo -e "  ❌ 磁盘空间不足: ${DISK_AVAILABLE}GB 可用"
    SCORE=$((SCORE - 20))
elif [ -n "$DISK_AVAILABLE" ] && [ "$DISK_AVAILABLE" -lt 20 ]; then
    echo -e "  🟡 磁盘空间较少: ${DISK_AVAILABLE}GB 可用"
    SCORE=$((SCORE - 10))
else
    echo -e "  ✅ 磁盘空间充足: ${DISK_INFO} 可用"
fi
echo ""

# 检查 6: 文档完整性
echo -e "${BLUE}## 6. 文档完整性检查${NC}"
DOCS=(
    "docs/runner-configuration.md"
    "docs/reports/cicd-status-report-2026-05-03.md"
    "docs/cicd-monitoring-guide.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "  ✅ $doc"
    else
        echo -e "  ⚠️  $doc (缺失)"
        SCORE=$((SCORE - 5))
    fi
done
echo ""

# 健康评分
echo -e "${BLUE}## 健康评分${NC}"
if [ $SCORE -ge 90 ]; then
    echo -e "${GREEN}✅ 健康评分: $SCORE/100 - 优秀${NC}"
    echo -e "${GREEN}系统运行良好，可以正常使用${NC}"
elif [ $SCORE -ge 70 ]; then
    echo -e "${YELLOW}🟡 健康评分: $SCORE/100 - 良好${NC}"
    echo -e "${YELLOW}系统基本正常，建议关注以下问题${NC}"
else
    echo -e "${RED}🔴 健康评分: $SCORE/100 - 需要关注${NC}"
    echo -e "${RED}系统存在问题，需要立即处理${NC}"
fi
echo ""

# 建议
echo -e "${BLUE}## 建议${NC}"
if [ $SCORE -lt 90 ]; then
    if [ $SCORE -lt 70 ]; then
        echo -e "${RED}•${NC} 立即检查并解决严重问题"
    fi
    
    if [ ! -f ".github/workflows/ci-stable.yml" ]; then
        echo -e "${YELLOW}•${NC} 考虑使用稳定版 CI workflow"
    fi
    
    if [ "$DISK_AVAILABLE" -lt 20 ]; then
        echo -e "${YELLOW}•${NC} 清理磁盘空间"
    fi
    
    if [ "$SUCCESS_RATE" -lt 95 ]; then
        echo -e "${YELLOW}•${NC} 检查失败原因并优化"
    fi
else
    echo -e "${GREEN}✅ 系统运行良好，无需优化${NC}"
fi

echo ""
echo -e "${BLUE}=== 检查完成 ===${NC}"
